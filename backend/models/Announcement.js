const mongoose = require("mongoose");

const announcementSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true,
        index: true
    },
    owner: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    targetStudents: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    }],
    active: {
        type: Boolean,
        default: true
    },
    expiresAt: {
        type: Date,
        default: null
    }
}, {
    timestamps: true
});

announcementSchema.index({ property: 1, active: 1, createdAt: -1 });

module.exports = mongoose.model("Announcement", announcementSchema);
