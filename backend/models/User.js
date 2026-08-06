const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        default: null
    },
    authProvider: {
        type: String,
        enum: ["password", "google", "otp"],
        default: "password"
    },
    phone: {
        type: String,
        trim: true,
        default: ""
    },
    role: {
        type: String,
        enum: ["student", "owner", "admin"],
        default: "student"
    },
    verified: {
        type: Boolean,
        default: false
    },
    provider: {
        type: String,
        enum: ["local", "google"],
        default: "local"
    },
    googleId: {
        type: String,
        default: ""
    },
    avatar: {
        type: String,
        default: ""
    },
    college: {
        type: String,
        trim: true,
        default: ""
    },
    course: {
        type: String,
        trim: true,
        default: ""
    },
    year: {
        type: String,
        trim: true,
        default: ""
    },
    businessName: {
        type: String,
        trim: true,
        default: ""
    },
    city: {
        type: String,
        trim: true,
        default: ""
    },
    profileImage: {
        type: String,
        default: ""
    },
    bio: {
        type: String,
        trim: true,
        default: ""
    },
status: {
        type: String,
        enum: ["active", "inactive", "blocked", "suspended"],
        default: "active"
    },
    accountStatus: {
        type: String,
        enum: ["ACTIVE", "PENDING", "REJECTED", "BANNED", "DELETED"],
        default: "ACTIVE"
    },
    lastLogin: {
        type: Date,
        default: null
    },
    emailVerified: {
        type: Boolean,
        default: false
    },
    phoneVerified: {
        type: Boolean,
        default: false
    },
    savedProperties: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property"
    }],
    recentlyViewed: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property"
    }],
    bookingHistory: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking"
    }],
    emergencyContact: {
        name: { type: String, default: "" },
        phone: { type: String, default: "" }
    },
    kycVerified: {
        type: Boolean,
        default: false
    },
    gstNumber: {
        type: String,
        trim: true,
        default: ""
    },
    propertyCount: {
        type: Number,
        default: 0,
        min: 0
    },
    rating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    notificationSettings: {
        email: { type: Boolean, default: true },
        sms: { type: Boolean, default: true },
        push: { type: Boolean, default: true }
    }
}, {
    timestamps: true
});

// Indexes for performance
UserSchema.index({ email: 1 });
UserSchema.index({ role: 1, status: 1 });
UserSchema.index({ createdAt: -1 });

UserSchema.virtual("fullProfile").get(function () {
    return {
        id: this._id,
        name: this.name,
        email: this.email,
        role: this.role,
        avatar: this.profileImage || this.avatar
    };
});

UserSchema.set("toJSON", { virtuals: true });
UserSchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("User", UserSchema);

