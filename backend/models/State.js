const mongoose = require("mongoose");

const StateSchema = new mongoose.Schema({

    name: {
        type: String,
        required: true,
        unique: true
    }

});

module.exports = mongoose.model("State", StateSchema);