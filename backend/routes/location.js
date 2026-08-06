const express = require("express");

const router = express.Router();

const State = require("../models/State");
const City = require("../models/City");
const College = require("../models/College");

// =======================================
// GET ALL STATES
// =======================================

router.get("/states", async (req, res) => {

    try {

        const states = await State.find().sort({ name: 1 });

        res.json(states);

    }

    catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// =======================================
// GET CITIES BY STATE
// =======================================

router.get("/cities/:stateId", async (req, res) => {

    try {

        const cities = await City.find({

            state: req.params.stateId

        }).sort({ name: 1 });

        res.json(cities);

    }

    catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// =======================================
// GET COLLEGES BY CITY
// =======================================

router.get("/colleges/:cityId", async (req, res) => {

    try {

        const colleges = await College.find({

            city: req.params.cityId

        }).sort({ name: 1 });

        res.json(colleges);

    }

    catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

module.exports = router;