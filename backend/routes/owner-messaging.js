// ======================================================
// CAMPORA OWNER MESSAGING ROUTES
// Owner ↔ Student messaging + broadcast announcements
// ======================================================

const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const { MessageConversation, Message } = require("../models/Message");

// ======================================================
// OWNER AUTH CHECK (same pattern as owner.js)
// ======================================================

router.use(auth);

router.use(async (req, res, next) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner) return res.status(404).json({ success: false, message: "User not found" });
        if (owner.role !== "owner") return res.status(403).json({ success: false, message: "Only PG Owners can access this route" });
        req.owner = owner;
        return next();
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Helper: get or create a conversation between owner and student
async function getOrCreateConversation(ownerId, studentId, propertyId) {
    let conv = await MessageConversation.findOne({ ownerId, studentId });
    if (!conv) {
        conv = await MessageConversation.create({ ownerId, studentId, propertyId: propertyId || null });
    } else if (propertyId && !conv.propertyId) {
        conv.propertyId = propertyId;
        await conv.save();
    }
    return conv;
}

// ======================================================
// LIST CONVERSATIONS (inbox)
// ======================================================

router.get("/conversations", async (req, res) => {
    try {
        const conversations = await MessageConversation.find({ ownerId: req.owner._id })
            .populate("studentId", "name email phone profileImage college")
            .populate("propertyId", "propertyName city")
            .sort({ lastMessageAt: -1 })
            .limit(100);

        return res.json({ success: true, conversations });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// GET / CREATE CONVERSATION WITH A STUDENT
// ======================================================

router.post("/conversation/start", async (req, res) => {
    try {
        const { studentId, propertyId } = req.body;
        if (!studentId) return res.status(400).json({ success: false, message: "studentId is required" });

        const student = await User.findById(studentId);
        if (!student || student.role !== "student") {
            return res.status(404).json({ success: false, message: "Student not found" });
        }

        const conv = await getOrCreateConversation(req.owner._id, studentId, propertyId);
        if (!conv) return res.status(500).json({ success: false, message: "Failed to create conversation" });

        return res.json({ success: true, conversation: conv });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// GET MESSAGES FOR A CONVERSATION
// ======================================================

router.get("/conversation/:id/messages", async (req, res) => {
    try {
        const conv = await MessageConversation.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

        const messages = await Message.find({ conversationId: conv._id })
            .sort({ createdAt: 1 })
            .limit(200);

        // Mark messages from student as read for owner
        await Message.updateMany(
            { conversationId: conv._id, sender: "student", isRead: false },
            { isRead: true, readAt: new Date() }
        );
        conv.unreadByOwner = 0;
        await conv.save();

        return res.json({ success: true, messages });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// SEND MESSAGE TO ONE STUDENT
// ======================================================

router.post("/conversation/:id/send", async (req, res) => {
    try {
        const conv = await MessageConversation.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

        const { text, attachment } = req.body;
        if (!text && !attachment) return res.status(400).json({ success: false, message: "Message text is required" });

        const message = await Message.create({
            conversationId: conv._id,
            sender: "owner",
            senderId: req.owner._id,
            text: text || "",
            attachment: attachment || {},
            isRead: false
        });

        conv.lastMessage = text || "📎 Attachment";
        conv.lastMessageAt = new Date();
        conv.lastSender = "owner";
        conv.unreadByStudent = (conv.unreadByStudent || 0) + 1;
        await conv.save();

        // Create a notification for the student
        try {
            await Notification.create({
                receiverId: conv.studentId,
                title: "New Message from " + (req.owner.name || "Owner"),
                message: text || "You received an attachment",
                type: "general"
            });
        } catch (e) { /* non-fatal */ }

        return res.status(201).json({ success: true, message });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// BROADCAST MESSAGE (to one student / property / all students)
// ======================================================

router.post("/broadcast", async (req, res) => {
    try {
        const { text, audience, propertyId, studentIds, broadcastType } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Message text is required" });

        // Determine target students
        let studentIdsList = [];
        const ownerId = req.owner._id;

        if (audience === "single" && studentIds && studentIds.length) {
            studentIdsList = studentIds;
        } else if (audience === "property" && propertyId) {
            const bookings = await Booking.find({ ownerId, propertyId, bookingStatus: { $in: ["confirmed", "checked-in"] } });
            studentIdsList = bookings.map(b => b.userId);
        } else if (audience === "all") {
            const bookings = await Booking.find({ ownerId, bookingStatus: { $in: ["confirmed", "checked-in"] } });
            studentIdsList = [...new Set(bookings.map(b => String(b.userId)))];
        } else {
            return res.status(400).json({ success: false, message: "Please specify a valid audience" });
        }

        if (!studentIdsList.length) {
            return res.status(400).json({ success: false, message: "No students found for this audience" });
        }

        // Deduplicate
        const uniqueIds = [...new Set(studentIdsList.map(String))];

        const created = [];
        for (const studentId of uniqueIds) {
            const conv = await getOrCreateConversation(ownerId, studentId, propertyId);
            const message = await Message.create({
                conversationId: conv._id,
                sender: "owner",
                senderId: ownerId,
                text,
                isBroadcast: true,
                broadcastType: broadcastType || "general",
                deliveredTo: [studentId]
            });
            conv.lastMessage = text;
            conv.lastMessageAt = new Date();
            conv.lastSender = "owner";
            conv.unreadByStudent = (conv.unreadByStudent || 0) + 1;
            await conv.save();

            try {
                await Notification.create({
                    receiverId: studentId,
                    title: "📢 " + (broadcastType || "Announcement"),
                    message: text,
                    type: "general"
                });
            } catch (e) { /* non-fatal */ }

            created.push(message);
        }

        return res.status(201).json({ success: true, total: created.length });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// MARK CONVERSATION READ
// ======================================================

router.patch("/conversation/:id/read", async (req, res) => {
    try {
        const conv = await MessageConversation.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!conv) return res.status(404).json({ success: false, message: "Conversation not found" });

        await Message.updateMany(
            { conversationId: conv._id, sender: "student", isRead: false },
            { isRead: true, readAt: new Date() }
        );
        conv.unreadByOwner = 0;
        await conv.save();

        return res.json({ success: true, message: "Conversation marked as read" });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// UNREAD COUNT
// ======================================================

router.get("/unread-count", async (req, res) => {
    try {
        const conversations = await MessageConversation.find({ ownerId: req.owner._id });
        const unread = conversations.reduce((sum, c) => sum + (c.unreadByOwner || 0), 0);
        return res.json({ success: true, unreadCount: unread });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
