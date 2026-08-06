// ======================================================
// CAMPORA STUDENT MAINTENANCE ROUTES
// ======================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const Maintenance = require("../models/Maintenance");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ======================================================
// STUDENT AUTH
// ======================================================

router.use(auth);
router.use(requireRole("student"));

// ======================================================
// LIST MY MAINTENANCE REQUESTS
// ======================================================

router.get("/", async (req, res) => {
    try {
        const { status, category } = req.query;
        const filter = { studentId: req.user.id };

        if (status) filter.status = status;
        if (category) filter.category = category;

        const requests = await Maintenance.find(filter)
            .populate("propertyId", "propertyName city address images")
            .populate("ownerId", "name phone")
            .sort({ createdAt: -1 });

        return res.json({ success: true, total: requests.length, requests });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// CREATE MAINTENANCE REQUEST (student)
// ======================================================

router.post("/", async (req, res) => {
    try {
        const { propertyId, bookingId, category, title, description, priority, images } = req.body;

        if (!propertyId || !isValidObjectId(propertyId)) {
            return res.status(400).json({ success: false, message: "Valid propertyId is required" });
        }
        if (!title) {
            return res.status(400).json({ success: false, message: "Title is required" });
        }

        // Verify the student has a confirmed/active booking at this property
        const property = await require("../models/Property").findById(propertyId).select("owner");

        // Fallback: any non-cancelled booking on the property
        const anyBooking = await Booking.findOne({
            userId: req.user.id,
            propertyId,
            bookingStatus: { $nin: ["cancelled", "checked-out"] },
        }).select("ownerId");

        const ownerId =
            (anyBooking && anyBooking.ownerId) ||
            (property && property.owner) || null;

        if (!ownerId) {
            return res.status(403).json({
                success: false,
                message: "You can only raise maintenance for a property you have booked.",
            });
        }

        const allowedCategories = ["Electrical", "Internet", "Cleaning", "Furniture", "Plumbing", "Water", "Appliance", "Pest Control", "Other"];
        const allowedPriorities = ["Low", "Medium", "High", "Urgent"];

        const request = await Maintenance.create({
            propertyId,
            ownerId,
            studentId: req.user.id,
            category: allowedCategories.includes(category) ? category : "Other",
            title,
            description: description || "",
            priority: allowedPriorities.includes(priority) ? priority : "Medium",
            status: "open",
            images: images || [],
        });

        // Notify the owner
        try {
            await Notification.create({
                receiverId: ownerId,
                title: "New Maintenance Request",
                message: `A student raised: "${title}"`,
                type: "general",
            });
        } catch (e) { /* non-fatal */ }

        return res.status(201).json({ success: true, request });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// GET SINGLE MAINTENANCE REQUEST
// ======================================================

router.get("/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid ID" });
        }

        const request = await Maintenance.findOne({
            _id: req.params.id,
            studentId: req.user.id,
        })
            .populate("propertyId", "propertyName city address images")
            .populate("ownerId", "name phone email");

        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        return res.json({ success: true, request });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// ADD COMMENT (student)
// ======================================================

router.post("/:id/comments", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid ID" });
        }

        const request = await Maintenance.findOne({
            _id: req.params.id,
            studentId: req.user.id,
        });

        if (!request) {
            return res.status(404).json({ success: false, message: "Request not found" });
        }

        const { text } = req.body;
        if (!text) {
            return res.status(400).json({ success: false, message: "Comment text is required" });
        }

        const User = require("../models/User");
        const me = await User.findById(req.user.id);

        request.comments.push({
            author: req.user.id,
            authorName: me?.name || "Student",
            text,
        });
        await request.save();

        return res.status(201).json({ success: true, request });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// MAINTENANCE STATS
// ======================================================

router.get("/stats/summary", async (req, res) => {
    try {
        const studentId = req.user.id;
        const [open, inProgress, resolved, rejected, urgent] = await Promise.all([
            Maintenance.countDocuments({ studentId, status: "open" }),
            Maintenance.countDocuments({ studentId, status: { $in: ["assigned", "in-progress"] } }),
            Maintenance.countDocuments({ studentId, status: "resolved" }),
            Maintenance.countDocuments({ studentId, status: "rejected" }),
            Maintenance.countDocuments({ studentId, priority: "Urgent", status: { $ne: "resolved" } }),
        ]);

        return res.json({
            success: true,
            statistics: { open, inProgress, resolved, rejected, urgent },
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;

