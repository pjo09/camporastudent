const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const User = require("../models/User");
const Property = require("../models/Property");
const ResidentRequest = require("../models/ResidentRequest");
const Tenancy = require("../models/Tenancy");
const PropertyInvite = require("../models/PropertyInvite");
const Notification = require("../models/Notification");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// Helper to send success responses
function sendSuccess(res, data = {}, status = 200) {
    return res.status(status).json({
        success: true,
        ...data
    });
}

// Helper to send error responses
function sendError(res, message, status = 500) {
    return res.status(status).json({
        success: false,
        message
    });
}

// ======================================================
// PUBLIC: RESOLVE INVITE TOKEN
// GET /api/join-pg/:token
// ======================================================
router.get("/join-pg/:token", async (req, res) => {
    try {
        const { token } = req.params;

        const invite = await PropertyInvite.findOne({ token, status: "ACTIVE" })
            .populate({
                path: "property",
                select: "propertyName address city state images owner",
                populate: {
                    path: "owner",
                    select: "name email phone"
                }
            });

        if (!invite) {
            return sendError(res, "Invalid or expired invite link.", 404);
        }

        // Check expiration
        if (invite.expiresAt && new Date() > invite.expiresAt) {
            await PropertyInvite.updateOne({ _id: invite._id }, { $set: { status: "REVOKED" } });
            return sendError(res, "Invite link has expired.", 410);
        }

        return sendSuccess(res, {
            invite: {
                property: invite.property,
                token: invite.token
            }
        });
    } catch (err) {
        return sendError(res, err.message);
    }
});

// ======================================================
// STUDENT: CREATE RESIDENT REQUEST
// POST /api/residents/requests
// ======================================================
router.post("/residents/requests", auth, requireRole("student"), async (req, res) => {
    try {
        const { property, room, bed, moveInDate, expectedMoveOutDate, residenceSource, proofDocument, message, inviteToken } = req.body;

        if (!property || !isValidObjectId(property)) {
            return sendError(res, "A valid property is required.", 400);
        }

        if (!room) {
            return sendError(res, "Room number is required.", 400);
        }

        if (!moveInDate) {
            return sendError(res, "Move-in date is required.", 400);
        }

        if (!residenceSource || !["DIRECT_OWNER", "OTHER_PLATFORM", "FRIEND", "OFFLINE", "OTHER"].includes(residenceSource)) {
            return sendError(res, "A valid residence source is required.", 400);
        }

        const moveIn = new Date(moveInDate);
        if (isNaN(moveIn.getTime())) {
            return sendError(res, "Invalid move-in date format.", 400);
        }

        let expectedMoveOut = null;
        if (expectedMoveOutDate) {
            expectedMoveOut = new Date(expectedMoveOutDate);
            if (isNaN(expectedMoveOut.getTime())) {
                return sendError(res, "Invalid move-out date format.", 400);
            }
            if (expectedMoveOut <= moveIn) {
                return sendError(res, "Move-out date must be after the move-in date.", 400);
            }
        }

        const propertyDoc = await Property.findById(property);
        if (!propertyDoc) {
            return sendError(res, "Property not found.", 404);
        }

        // Prevent duplicate requests
        const existingRequest = await ResidentRequest.findOne({
            student: req.user.id,
            property,
            status: { $in: ["PENDING", "APPROVED"] }
        });

        if (existingRequest) {
            return sendError(res, "You already have a pending or approved resident request for this property.", 400);
        }

        // Prevent duplicate active tenancy at the property
        const activeTenancy = await Tenancy.findOne({
            student: req.user.id,
            property,
            status: "ACTIVE"
        });

        if (activeTenancy) {
            return sendError(res, "You are already registered as an active resident at this property.", 400);
        }

        // Create Request
        const request = await ResidentRequest.create({
            student: req.user.id,
            property,
            room,
            bed: bed || "",
            moveInDate: moveIn,
            expectedMoveOutDate: expectedMoveOut,
            residenceSource,
            proofDocument: proofDocument || "",
            message: message || "",
            status: "PENDING",
            requestedAt: new Date()
        });

        // Notify Owner
        try {
            await Notification.create({
                receiverId: propertyDoc.owner,
                title: "New Resident Request 👥",
                message: `A student has requested to join "${propertyDoc.propertyName}" as an existing resident.`,
                type: "NEW_RESIDENT_REQUEST"
            });
        } catch (notifErr) {
            console.error("Failed to create notification for owner:", notifErr.message);
        }

        return sendSuccess(res, { request }, 201);
    } catch (err) {
        return sendError(res, err.message);
    }
});

// ======================================================
// STUDENT: GET MY REQUESTS
// GET /api/residents/requests/my
// ======================================================
router.get("/residents/requests/my", auth, requireRole("student"), async (req, res) => {
    try {
        const requests = await ResidentRequest.find({ student: req.user.id })
            .populate("property", "propertyName address city state images")
            .sort({ requestedAt: -1 });

        return sendSuccess(res, { requests });
    } catch (err) {
        return sendError(res, err.message);
    }
});

// ======================================================
// STUDENT: GET SPECIFIC REQUEST
// GET /api/residents/requests/:id
// ======================================================
router.get("/residents/requests/:id", auth, requireRole("student"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return sendError(res, "Invalid request ID format.", 400);
        }

        const request = await ResidentRequest.findById(id)
            .populate("property", "propertyName address city state images owner");

        if (!request) {
            return sendError(res, "Request not found.", 404);
        }

        if (String(request.student) !== String(req.user.id)) {
            return sendError(res, "Unauthorized to access this request.", 403);
        }

        return sendSuccess(res, { request });
    } catch (err) {
        return sendError(res, err.message);
    }
});

// ======================================================
// STUDENT: CANCEL REQUEST
// DELETE /api/residents/requests/:id
// ======================================================
router.delete("/residents/requests/:id", auth, requireRole("student"), async (req, res) => {
    try {
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return sendError(res, "Invalid request ID format.", 400);
        }

        const request = await ResidentRequest.findById(id);
        if (!request) {
            return sendError(res, "Request not found.", 404);
        }

        if (String(request.student) !== String(req.user.id)) {
            return sendError(res, "Unauthorized to cancel this request.", 403);
        }

        if (request.status !== "PENDING") {
            return sendError(res, "Only pending requests can be cancelled.", 400);
        }

        request.status = "CANCELLED";
        await request.save();

        return sendSuccess(res, { message: "Request cancelled successfully." });
    } catch (err) {
        return sendError(res, err.message);
    }
});

module.exports = router;
