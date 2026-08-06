// ======================================================
// CAMPORA STUDENT MESSAGING ROUTES
// Student ↔ Owner messaging
// ======================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const User = require("../models/User");
const { MessageConversation, Message } = require("../models/Message");
const Notification = require("../models/Notification");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ======================================================
// STUDENT AUTH
// ======================================================

router.use(auth);
router.use(requireRole("student"));

// ======================================================
// LIST CONVERSATIONS (inbox)
// ======================================================

router.get("/conversations", async (req, res) => {
    try {
        const conversations = await MessageConversation.find({ studentId: req.user.id })
            .populate("ownerId", "name email phone profileImage businessName city")
            .populate("propertyId", "propertyName city images")
            .sort({ lastMessageAt: -1 })
            .limit(100);

        return res.json({ success: true, conversations });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// GET / CREATE CONVERSATION WITH AN OWNER
// ======================================================

router.post("/conversation/start", async (req, res) => {
    try {
        const { ownerId, propertyId } = req.body;
        if (!ownerId || !isValidObjectId(ownerId)) {
            return res.status(400).json({ success: false, message: "Valid ownerId is required" });
        }

        const owner = await User.findById(ownerId);
        if (!owner || owner.role !== "owner") {
            return res.status(404).json({ success: false, message: "Owner not found" });
        }

        let conv = await MessageConversation.findOne({
            ownerId,
            studentId: req.user.id,
        });

        if (!conv) {
            conv = await MessageConversation.create({
                ownerId,
                studentId: req.user.id,
                propertyId: propertyId || null,
            });
        } else if (propertyId && !conv.propertyId) {
            conv.propertyId = propertyId;
            await conv.save();
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

        const conv = await MessageConversation.findOne({
            _id: req.params.id,
            studentId: req.user.id,
        });

        if (!conv) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        const messages = await Message.find({ conversationId: conv._id })
            .sort({ createdAt: 1 })
            .limit(200);

        // Mark messages from owner as read for student
        await Message.updateMany(
            { conversationId: conv._id, sender: "owner", isRead: false },
            { isRead: true, readAt: new Date() }
        );
        conv.unreadByStudent = 0;
        await conv.save();

        return res.json({ success: true, messages });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// SEND MESSAGE TO OWNER
// ======================================================

router.post("/conversation/:id/send", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid conversation ID" });
        }

        const conv = await MessageConversation.findOne({
            _id: req.params.id,
            studentId: req.user.id,
        });

        if (!conv) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        const { text, attachment } = req.body;
        if (!text && !attachment) {
            return res.status(400).json({ success: false, message: "Message text is required" });
        }

        const message = await Message.create({
            conversationId: conv._id,
            sender: "student",
            senderId: req.user.id,
            text: text || "",
            attachment: attachment || {},
            isRead: false,
        });

        conv.lastMessage = text || "📎 Attachment";
        conv.lastMessageAt = new Date();
        conv.lastSender = "student";
        conv.unreadByOwner = (conv.unreadByOwner || 0) + 1;
        await conv.save();

        // Notify the owner
        try {
            const student = await User.findById(req.user.id);
            await Notification.create({
                receiverId: conv.ownerId,
                title: "New Message from " + (student?.name || "Student"),
                message: text || "You received an attachment",
                type: "general",
            });
        } catch (e) { /* non-fatal */ }

        return res.status(201).json({ success: true, message });
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

        const conv = await MessageConversation.findOne({
            _id: req.params.id,
            studentId: req.user.id,
        });

        if (!conv) {
            return res.status(404).json({ success: false, message: "Conversation not found" });
        }

        await Message.updateMany(
            { conversationId: conv._id, sender: "owner", isRead: false },
            { isRead: true, readAt: new Date() }
        );
        conv.unreadByStudent = 0;
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
        const conversations = await MessageConversation.find({ studentId: req.user.id });
        const unread = conversations.reduce((sum, c) => sum + (c.unreadByStudent || 0), 0);
        return res.json({ success: true, unreadCount: unread });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

