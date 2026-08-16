const mongoose = require("mongoose");

const TenancySchema = new mongoose.Schema({
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
    startDate: {
        type: Date,
        required: true
    },
    endDate: {
        type: Date
    },
    status: {
        type: String,
        enum: ["ACTIVE", "ENDED", "CANCELLED"],
        default: "ACTIVE",
        index: true
    },
    source: {
        type: String,
        enum: ["BOOKING", "EXISTING_RESIDENT"],
        required: true,
        index: true
    },
    verifiedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User"
    },
    verifiedAt: {
        type: Date
    }
}, {
    timestamps: true
});

module.exports = mongoose.model("Tenancy", TenancySchema);
