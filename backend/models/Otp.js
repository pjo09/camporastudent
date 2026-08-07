const mongoose = require("mongoose");

const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: true,
        lowercase: true,
        trim: true,
        index: true
    },
    code: {
        type: String,
        required: true
    },
    // Distinguishes the flow this OTP belongs to: "register" (default)
    // for new-account verification/login, or "reset" for password reset.
    // Defaults to "register" so pre-existing OTP documents remain fully
    // compatible with existing register/login verification flows.
    purpose: {
        type: String,
        enum: ["register", "reset"],
        default: "register"
    },
    // Number of failed verification attempts against this OTP.
    attempts: {
        type: Number,
        default: 0
    },
    // Timestamp of the last time a new OTP was generated for this email.
    // Used to enforce a resend cooldown.
    lastSentAt: {
        type: Date,
        default: Date.now
    },
    // Set to true once the OTP has been successfully used.
    // Enforces single-use even if the TTL has not yet expired.
    used: {
        type: Boolean,
        default: false
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// TTL index — documents automatically expire after 300 seconds (5 min)
otpSchema.index({ createdAt: 1 }, { expireAfterSeconds: 300 });

module.exports = mongoose.model("Otp", otpSchema);

