// ======================================================
// CAMPORA OWNER MESSAGING ROUTES
// Owner ↔ Student messaging + broadcast announcements
// ======================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const { MessageConversation, Message } = require("../models/Message");
const { syncBookingConversation } = require("../utils/bookingHelper");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

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

// ======================================================
// LIST CONVERSATIONS (inbox)
// ======================================================
router.get("/conversations", async (req, res) => {
    try {
        const conversations = await MessageConversation.find({ ownerId: req.owner._id })
            .populate("studentId", "name email phone profileImage college")
            .populate("propertyId", "propertyName city")
            .populate("bookingId", "bookingStatus checkIn checkOut")
            .sort({ lastMessageAt: -1 })
            .limit(100);

        // Filter out invalid/empty booking-linked conversations
        const validConversations = conversations.filter(c => c.bookingId);

        return res.json({ success: true, conversations: validConversations });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// GET / CREATE CONVERSATION WITH A STUDENT (Requires confirmed booking)
// ======================================================
router.post("/conversation/start", async (req, res) => {
    try {
        const { studentId, propertyId, bookingId } = req.body;

        let booking = null;
        if (bookingId && isValidObjectId(bookingId)) {
            booking = await Booking.findOne({
                _id: bookingId,
                ownerId: req.owner._id,
                bookingStatus: "confirmed"
            });
        } else if (studentId && isValidObjectId(studentId) && propertyId && isValidObjectId(propertyId)) {
            booking = await Booking.findOne({
                userId: studentId,
                propertyId,
                ownerId: req.owner._id,
                bookingStatus: "confirmed"
            });
        }

        if (!booking) {
            return res.status(403).json({
                success: false,
                message: "Your booking is no longer active."
            });
        }

        const conv = await syncBookingConversation(booking);
        if (!conv) {
            return res.status(500).json({ success: false, message: "Failed to create conversation" });
        }

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
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conv = await MessageConversation.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!conv || !conv.bookingId) return res.status(404).json({ success: false, message: "Conversation unavailable." });

        // Validate booking relationship and property ownership
        const booking = await Booking.findById(conv.bookingId);
        if (!booking || String(booking.ownerId) !== String(req.owner._id)) {
            return res.status(403).json({ success: false, message: "Conversation unavailable." });
        }

        const property = await Property.findById(booking.propertyId);
        if (!property || String(property.owner) !== String(req.owner._id)) {
            return res.status(403).json({ success: false, message: "Conversation unavailable." });
        }

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
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conv = await MessageConversation.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!conv || !conv.bookingId) return res.status(404).json({ success: false, message: "Conversation unavailable." });

        // Validate booking relationship and property ownership
        const booking = await Booking.findById(conv.bookingId);
        if (!booking || String(booking.ownerId) !== String(req.owner._id)) {
            return res.status(403).json({ success: false, message: "Conversation unavailable." });
        }

        const property = await Property.findById(booking.propertyId);
        if (!property || String(property.owner) !== String(req.owner._id)) {
            return res.status(403).json({ success: false, message: "Conversation unavailable." });
        }

        // Enforce cancelled booking rule: blocked from sending new messages
        if (booking.bookingStatus === "cancelled") {
            return res.status(403).json({ success: false, message: "Your booking is no longer active." });
        }

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
                type: "NEW_MESSAGE"
            });
        } catch (e) { /* non-fatal */ }

        return res.status(201).json({ success: true, message });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// BROADCAST ANNOUNCEMENT MESSAGE
// ======================================================
router.post("/broadcast", async (req, res) => {
    try {
        const { text, audience, propertyId, studentIds, broadcastType } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Message text is required" });

        let studentIdsList = [];
        const ownerId = req.owner._id;

        if (audience === "single" && studentIds && studentIds.length) {
            studentIdsList = studentIds;
        } else if (audience === "property" && propertyId) {
            // Verify property ownership
            const property = await Property.findById(propertyId);
            if (!property || String(property.owner) !== String(ownerId)) {
                return res.status(403).json({ success: false, message: "Unauthorized property access" });
            }

            const bookings = await Booking.find({ ownerId, propertyId, bookingStatus: { $in: ["confirmed", "checked-in"] } });
            studentIdsList = bookings.map(b => b.userId);
        } else if (audience === "all") {
            const bookings = await Booking.find({ ownerId, bookingStatus: { $in: ["confirmed", "checked-in"] } });
            studentIdsList = [...new Set(bookings.map(b => String(b.userId)))];
        } else {
            return res.status(400).json({ success: false, message: "Please specify a valid audience" });
        }

        if (!studentIdsList.length) {
            return res.status(400).json({ success: false, message: "No active students found" });
        }

        const uniqueIds = [...new Set(studentIdsList.map(String))];
        const created = [];

        for (const studentId of uniqueIds) {
            // Get booking for each student to confirm it exists and is active
            const booking = await Booking.findOne({
                userId: studentId,
                ownerId,
                bookingStatus: { $in: ["confirmed", "checked-in"] }
            });

            if (!booking) continue;

            const conv = await syncBookingConversation(booking);
            if (!conv) continue;

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
                    type: "NEW_ANNOUNCEMENT"
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
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conv = await MessageConversation.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!conv) return res.status(404).json({ success: false, message: "Conversation unavailable." });

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
