const mongoose = require("mongoose");

// ======================================================
// CAMPORA INVOICE / RENT TRACKING MODEL
// ======================================================

const invoiceSchema = new mongoose.Schema({

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
        required: true,
        index: true
    },

    bookingId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Booking",
        default: null
    },

    invoiceNumber: {
        type: String,
        required: true,
        unique: true
    },

    // Period this invoice covers
    periodFrom: {
        type: Date,
        required: true
    },

    periodTo: {
        type: Date,
        required: true
    },

    dueDate: {
        type: Date,
        required: true
    },

    rentAmount: {
        type: Number,
        required: true,
        min: 0
    },

    maintenanceCharge: {
        type: Number,
        default: 0,
        min: 0
    },

    electricityCharge: {
        type: Number,
        default: 0,
        min: 0
    },

    foodCharge: {
        type: Number,
        default: 0,
        min: 0
    },

    otherCharges: {
        type: Number,
        default: 0,
        min: 0
    },

    discount: {
        type: Number,
        default: 0,
        min: 0
    },

    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },

    amountPaid: {
        type: Number,
        default: 0,
        min: 0
    },

    status: {
        type: String,
        enum: ["PENDING", "SUCCESS", "FAILED", "REFUNDED", "pending", "partial", "paid", "overdue", "cancelled"],
        default: "PENDING",
        index: true
    },

    paymentMethod: {
        type: String,
        enum: ["Cash", "UPI", "Card", "Net Banking", "Wallet", "Razorpay"],
        default: "Cash"
    },

    paidAt: {
        type: Date,
        default: null
    },

    transactionId: {
        type: String,
        default: ""
    },

    notes: {
        type: String,
        default: ""
    },

    // Payment history
    transactions: [{
        amount: {
            type: Number,
            required: true
        },
        method: {
            type: String,
            default: "Cash"
        },
        transactionId: {
            type: String,
            default: ""
        },
        paidAt: {
            type: Date,
            default: Date.now
        },
        note: {
            type: String,
            default: ""
        }
    }]

}, {
    timestamps: true
});

invoiceSchema.index({ ownerId: 1, status: 1, dueDate: 1 });
invoiceSchema.index({ studentId: 1, status: 1 });
invoiceSchema.index({ propertyId: 1, status: 1 });

module.exports = mongoose.model("Invoice", invoiceSchema);
