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
const Booking = require("../models/Booking");
const { MessageConversation, Message } = require("../models/Message");
const Notification = require("../models/Notification");
const { syncBookingConversation } = require("../utils/bookingHelper");

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
        // Find conversations matching studentId
        const conversations = await MessageConversation.find({ studentId: req.user.id })
            .populate("ownerId", "name email phone profileImage businessName city")
            .populate("propertyId", "propertyName city images")
            .populate("bookingId", "bookingStatus checkIn checkOut")
            .sort({ lastMessageAt: -1 })
            .limit(100);

        // Filter out conversations where the booking doesn't exist or is invalid
        const validConversations = conversations.filter(c => c.bookingId);

        return res.json({ success: true, conversations: validConversations });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// START CONVERSATION WITH AN OWNER (Requires confirmed booking)
// ======================================================
router.post("/conversation/start", async (req, res) => {
    try {
        const { ownerId, propertyId, bookingId } = req.body;

        let booking = null;
        if (bookingId && isValidObjectId(bookingId)) {
            booking = await Booking.findOne({
                _id: bookingId,
                userId: req.user.id,
                bookingStatus: "confirmed"
            });
        } else if (propertyId && isValidObjectId(propertyId)) {
            // Find active confirmed booking for this property
            booking = await Booking.findOne({
                propertyId,
                userId: req.user.id,
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
            return res.status(500).json({ success: false, message: "Failed to sync conversation." });
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
            studentId: req.user.id
        });

        if (!conv || !conv.bookingId) {
            return res.status(404).json({ success: false, message: "Conversation unavailable." });
        }

        // Validate booking relationship
        const booking = await Booking.findById(conv.bookingId);
        if (!booking || String(booking.userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: "Conversation unavailable." });
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
            studentId: req.user.id
        });

        if (!conv || !conv.bookingId) {
            return res.status(404).json({ success: false, message: "Conversation unavailable." });
        }

        // Validate booking relationship
        const booking = await Booking.findById(conv.bookingId);
        if (!booking || String(booking.userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: "Conversation unavailable." });
        }

        // Enforce cancelled booking rule: blocked from sending new messages
        if (booking.bookingStatus === "cancelled") {
            return res.status(403).json({ success: false, message: "Your booking is no longer active." });
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
            isRead: false
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
                type: "NEW_MESSAGE"
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
            studentId: req.user.id
        });

        if (!conv) {
            return res.status(404).json({ success: false, message: "Conversation unavailable." });
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
