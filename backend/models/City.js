const mongoose = require("mongoose");

const CitySchema = new mongoose.Schema({

    state: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "State"
    },

    name: {
        type: String,
        required: true
    }

});

module.exports = mongoose.model("City", CitySchema);