const mongoose = require("mongoose");

const CollegeSchema = new mongoose.Schema({

    state: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "State",
        required: true
    },

    city: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "City",
        required: true
    },

    name: {
        type: String,
        required: true
    },

    latitude: Number,

    longitude: Number

}, { timestamps: true });

module.exports = mongoose.model("College", CollegeSchema);