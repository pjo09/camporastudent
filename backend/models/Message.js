const mongoose = require("mongoose");

// ======================================================
// CAMPORA MESSAGING MODEL
// Author: owner. Recipient: student (or broadcast).
// ======================================================

const messageConversationSchema = new mongoose.Schema({

    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        default: null
    },

    lastMessage: {
        type: String,
        default: ""
    },

    lastMessageAt: {
        type: Date,
        default: Date.now
    },

    lastSender: {
        type: String,
        enum: ["owner", "student"],
        default: "owner"
    },

    unreadByOwner: {
        type: Number,
        default: 0
    },

    unreadByStudent: {
        type: Number,
        default: 0
    }

}, {
    timestamps: true
});

const messageSchema = new mongoose.Schema({

    conversationId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MessageConversation",
        required: true,
        index: true
    },

    sender: {
        type: String,
        enum: ["owner", "student", "system"],
        required: true
    },

    senderId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },

    text: {
        type: String,
        default: "",
        trim: true
    },

    attachment: {
        url: { type: String, default: "" },
        type: { type: String, default: "" }
    },

    isRead: {
        type: Boolean,
        default: false
    },

    readAt: {
        type: Date,
        default: null
    },

    isBroadcast: {
        type: Boolean,
        default: false
    },

    broadcastType: {
        type: String,
        default: ""
    },

    // For broadcasts delivered to many students
    deliveredTo: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }]

}, {
    timestamps: true
});

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ senderId: 1, createdAt: -1 });

module.exports = {
    MessageConversation: mongoose.model("MessageConversation", messageConversationSchema),
    Message: mongoose.model("Message", messageSchema)
};
