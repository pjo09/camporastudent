const mongoose = require("mongoose");

// ======================================================
// CAMPORA MAINTENANCE REQUEST MODEL
// ======================================================

const maintenanceSchema = new mongoose.Schema({

    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true,
        index: true
    },

    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },

    studentId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null
    },

    category: {
        type: String,
        enum: ["Electrical", "Internet", "Cleaning", "Furniture", "Plumbing", "Water", "Appliance", "Pest Control", "Other"],
        default: "Other"
    },

    title: {
        type: String,
        required: true,
        trim: true
    },

    description: {
        type: String,
        default: "",
        trim: true
    },

    priority: {
        type: String,
        enum: ["Low", "Medium", "High", "Urgent"],
        default: "Medium"
    },

    status: {
        type: String,
        enum: ["open", "assigned", "in-progress", "resolved", "rejected"],
        default: "open"
    },

    assignedTo: {
        type: String,
        default: ""
    },

    images: [String],

    comments: [{
        author: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        authorName: {
            type: String,
            default: ""
        },
        text: {
            type: String,
            default: ""
        },
        createdAt: {
            type: Date,
            default: Date.now
        }
    }],

    resolvedAt: {
        type: Date,
        default: null
    },

    rejectedReason: {
        type: String,
        default: ""
    }

}, {
    timestamps: true
});

maintenanceSchema.index({ status: 1, createdAt: -1 });
maintenanceSchema.index({ priority: 1, status: 1 });

module.exports = mongoose.model("Maintenance", maintenanceSchema);
