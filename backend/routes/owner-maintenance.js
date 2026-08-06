// ======================================================
// CAMPORA OWNER MAINTENANCE ROUTES
// ======================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const User = require("../models/User");
const Property = require("../models/Property");
const Maintenance = require("../models/Maintenance");
const Notification = require("../models/Notification");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ======================================================
// OWNER AUTH
// ======================================================

router.use(auth);

router.use(async (req, res, next) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner) return res.status(404).json({ success: false, message: "User not found" });
        if (owner.role !== "owner") return res.status(403).json({ success: false, message: "Only PG Owners can access this route" });
        req.owner = owner;
        return next();
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// LIST MAINTENANCE REQUESTS
// ======================================================

router.get("/", async (req, res) => {
    try {
        const { status, priority, category, propertyId } = req.query;
        const filter = { ownerId: req.owner._id };

        if (status) filter.status = status;
        if (priority) filter.priority = priority;
        if (category) filter.category = category;
        if (propertyId) filter.propertyId = propertyId;

        const requests = await Maintenance.find(filter)
            .populate("propertyId", "propertyName city")
            .populate("studentId", "name phone")
            .sort({ createdAt: -1 });

        return res.json({ success: true, total: requests.length, requests });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// CREATE MAINTENANCE REQUEST (owner-initiated)
// ======================================================

router.post("/", async (req, res) => {
    try {
        const { propertyId, category, title, description, priority, assignedTo, images, studentId } = req.body;

        if (!propertyId || !isValidObjectId(propertyId)) {
            return res.status(400).json({ success: false, message: "Valid propertyId is required" });
        }
        if (!title) return res.status(400).json({ success: false, message: "Title is required" });

        const property = await Property.findOne({ _id: propertyId, owner: req.owner._id });
        if (!property) return res.status(404).json({ success: false, message: "Property not found" });

        const request = await Maintenance.create({
            propertyId,
            ownerId: req.owner._id,
            studentId: studentId || null,
            category: category || "Other",
            title,
            description: description || "",
            priority: priority || "Medium",
            status: "open",
            assignedTo: assignedTo || "",
            images: images || []
        });

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
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const request = await Maintenance.findOne({ _id: req.params.id, ownerId: req.owner._id })
            .populate("propertyId", "propertyName city address")
            .populate("studentId", "name phone email");
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });
        return res.json({ success: true, request });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// UPDATE STATUS (assign / resolve / reject)
// ======================================================

router.patch("/:id/status", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const request = await Maintenance.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        const { status, assignedTo, reason } = req.body;
        const allowedStatuses = ["open", "assigned", "in-progress", "resolved", "rejected"];
        if (!allowedStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: "Invalid status" });
        }

        request.status = status;
        if (assignedTo) request.assignedTo = assignedTo;
        if (status === "resolved") request.resolvedAt = new Date();
        if (status === "rejected") request.rejectedReason = reason || "";
        await request.save();

        // Notify student if present
        if (request.studentId) {
            try {
                await Notification.create({
                    receiverId: request.studentId,
                    title: "Maintenance Update",
                    message: `Your maintenance request "${request.title}" is now ${status}.`,
                    type: "general"
                });
            } catch (e) { /* non-fatal */ }
        }

        return res.json({ success: true, request });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// ADD COMMENT
// ======================================================

router.post("/:id/comments", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const request = await Maintenance.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        const { text } = req.body;
        if (!text) return res.status(400).json({ success: false, message: "Comment text is required" });

        request.comments.push({
            author: req.owner._id,
            authorName: req.owner.name || "Owner",
            text
        });
        await request.save();

        return res.status(201).json({ success: true, request });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// SET PRIORITY
// ======================================================

router.patch("/:id/priority", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const request = await Maintenance.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!request) return res.status(404).json({ success: false, message: "Request not found" });

        const { priority } = req.body;
        if (!["Low", "Medium", "High", "Urgent"].includes(priority)) {
            return res.status(400).json({ success: false, message: "Invalid priority" });
        }
        request.priority = priority;
        await request.save();

        return res.json({ success: true, request });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// MAINTENANCE STATISTICS
// ======================================================

router.get("/stats/summary", async (req, res) => {
    try {
        const ownerId = req.owner._id;
        const [open, assigned, inProgress, resolved, rejected, urgent, high] = await Promise.all([
            Maintenance.countDocuments({ ownerId, status: "open" }),
            Maintenance.countDocuments({ ownerId, status: "assigned" }),
            Maintenance.countDocuments({ ownerId, status: "in-progress" }),
            Maintenance.countDocuments({ ownerId, status: "resolved" }),
            Maintenance.countDocuments({ ownerId, status: "rejected" }),
            Maintenance.countDocuments({ ownerId, priority: "Urgent", status: { $ne: "resolved" } }),
            Maintenance.countDocuments({ ownerId, priority: "High", status: { $ne: "resolved" } })
        ]);

        return res.json({
            success: true,
            statistics: { open, assigned, inProgress, resolved, rejected, urgent, high }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
