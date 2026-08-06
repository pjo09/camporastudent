const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");

const Contact = require("../models/Contact");

// =======================================
// GET ALL MESSAGES (admin only)
// =======================================

router.get("/", auth, async (req, res) => {

    try {

        if (req.user.role !== "admin") {

            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });

        }

        const messages = await Contact.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            total: messages.length,
            messages
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

// =======================================
// SEND MESSAGE
// =======================================

router.post("/", async (req, res) => {

    try {

        const { name, email, message } = req.body;

        if (!name || !email || !message) {

            return res.status(400).json({
                success: false,
                message: "Please fill all fields."
            });

        }

        const newMessage = await Contact.create({ name, email, message });

        res.json({

            success: true,

            message: "Message Sent Successfully",

            data: newMessage

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

// =======================================
// DELETE MESSAGE
// =======================================

router.delete("/:id", auth, async (req, res) => {

    try {

        if (req.user.role !== "admin") {

            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });

        }

        const deleted = await Contact.findByIdAndDelete(req.params.id);

        if (!deleted) {

            return res.status(404).json({
                success: false,
                message: "Message not found"
            });

        }

        res.json({
            success: true,
            message: "Message Deleted"
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: "Server Error"
        });

    }

});

module.exports = router;

