const mongoose = require("mongoose");

const ResidentRequestSchema = new mongoose.Schema({
    student: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true,
        index: true
    },
    room: {
        type: String,
        required: true,
        trim: true
    },
    bed: {
        type: String,
        trim: true,
        default: ""
    },
    moveInDate: {
        type: Date,
        required: true
    },
    expectedMoveOutDate: {
        type: Date
    },
    residenceSource: {
        type: String,
        enum: ["DIRECT_OWNER", "OTHER_PLATFORM", "FRIEND", "OFFLINE", "OTHER"],
        required: true
    },
    proofDocument: {
        type: String,
        default: ""
    },
    message: {
        type: String,
        trim: true,
        default: ""
    },
    status: {
        type: String,
        enum: ["PENDING", "APPROVED", "REJECTED", "CANCELLED"],
        default: "PENDING",
        index: true
    },
    requestedAt: {
        type: Date,
        default: Date.now
    },
    reviewedAt: {
        type: Date
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    rejectionReason: {
        type: String,
        trim: true,
        default: ""
    }
}, {
    timestamps: true
});

// A student cannot have multiple pending or approved requests for the same property.
ResidentRequestSchema.index({ student: 1, property: 1, status: 1 });

module.exports = mongoose.model("ResidentRequest", ResidentRequestSchema);
