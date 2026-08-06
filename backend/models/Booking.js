const mongoose = require("mongoose");

const bookingSchema = new mongoose.Schema({
    propertyId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Property",
        index: true
    },
    propertyName: String,
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },
    userName: String,
    userEmail: String,
    price: {
        type: Number,
        default: 0
    },
    ownerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        index: true
    },
    checkIn: Date,
    checkOut: Date,
    duration: {
        type: String,
        default: ""
    },
    numberOfGuests: {
        type: Number,
        default: 1
    },
    paymentStatus: {
        type: String,
        enum: ["pending", "paid", "failed", "refunded"],
        default: "pending",
        index: true
    },
    bookingStatus: {
        type: String,
        enum: ["pending", "confirmed", "checked-in", "checked-out", "cancelled"],
        default: "pending",
        index: true
    },
    paymentId: {
        type: String,
        default: ""
    },
    paymentDate: {
        type: Date,
        default: null
    },
    paymentMethod: {
        type: String,
        enum: ["Cash", "UPI", "Card", "Net Banking", "Wallet"],
        default: "UPI"
    },
    specialRequest: {
        type: String,
        default: ""
    },
    cancelReason: {
        type: String,
        default: ""
    }
}, {
    timestamps: true
});

// Compound indexes for common queries
bookingSchema.index({ ownerId: 1, bookingStatus: 1, createdAt: -1 });
bookingSchema.index({ userId: 1, bookingStatus: 1, createdAt: -1 });
bookingSchema.index({ propertyId: 1, bookingStatus: 1 });
bookingSchema.index({ paymentStatus: 1, createdAt: -1 });

module.exports = mongoose.model("Booking", bookingSchema);

