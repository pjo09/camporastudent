const mongoose = require("mongoose");

const PropertyInviteSchema = new mongoose.Schema({
    property: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        required: true,
        index: true
    },
    token: {
        type: String,
        required: true,
        unique: true,
        index: true
    },
    expiresAt: {
        type: Date
    },
    status: {
        type: String,
        enum: ["ACTIVE", "REVOKED"],
        default: "ACTIVE"
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("PropertyInvite", PropertyInviteSchema);
