const mongoose = require("mongoose");

const AuditLogSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true
    },
    userEmail: {
        type: String,
        default: ""
    },
    role: {
        type: String,
        required: true
    },
    action: {
        type: String,
        required: true,
        enum: [
            "ADMIN_LOGIN",
            "OWNER_APPROVAL",
            "OWNER_REJECTION",
            "PROPERTY_APPROVAL",
            "PROPERTY_REJECTION",
            "PROPERTY_BLACKLISTED",
            "USER_BAN",
            "USER_UNBAN",
            "PROPERTY_DELETION",
            "BOOKING_APPROVAL",
            "BOOKING_REJECTION",
            "REVIEW_DELETION",
            "CONTACT_RESOLUTION"
        ]
    },
    resource: {
        type: String,
        required: true
    },
    resourceId: {
        type: String,
        default: ""
    },
    details: {
        type: Object,
        default: {}
    },
    ipAddress: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

AuditLogSchema.index({ userId: 1 });
AuditLogSchema.index({ action: 1 });
AuditLogSchema.index({ createdAt: -1 });

module.exports = mongoose.model("AuditLog", AuditLogSchema);
