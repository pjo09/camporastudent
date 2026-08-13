const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");

const Booking = require("../models/Booking");
const Property = require("../models/Property");
const sendEmail = require("../utils/sendEmail");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

async function safelySendEmail(...args) {

    try {

        await sendEmail(...args);

    } catch (error) {

        console.error("Booking created, but notification email failed:", error.message);

    }

}

// =====================================
// CREATE BOOKING
// =====================================

router.post("/", auth, async (req, res) => {

    try {

        const { propertyId, property, moveInDate, duration, specialRequest } = req.body;

        const student = await require("../models/User").findById(req.user.id).select("-password");

        if (!student) {

            return res.status(401).json({

                success: false,
                message: "User not found"

            });

        }

        const selectedProperty = await Property.findById(propertyId || property);

        if (!selectedProperty) {

            return res.status(404).json({

                success: false,
                message: "Property not found"

            });

        }

        await selectedProperty.populate("owner", "email");

        const booking = await Booking.create({

            propertyId: selectedProperty._id,

            propertyName: selectedProperty.propertyName || selectedProperty.title,

            userId: student._id,

            userName: student.name,

            userEmail: student.email,

            price: selectedProperty.rent || selectedProperty.price,

            ownerId: selectedProperty.owner && selectedProperty.owner._id
                ? selectedProperty.owner._id
                : selectedProperty.owner,

            checkIn: moveInDate ? new Date(moveInDate) : null,

            duration: duration || "",

            status: "pending",

            bookingStatus: "pending",

            specialRequest: specialRequest || ""

        });

        // =====================================
        // EMAIL TO STUDENT
        // =====================================

        await safelySendEmail(

            student.email,

            "🎉 Booking Confirmed - Campora",

            `
            <div style="font-family:Arial;padding:25px">

                <h2>Hello ${student.name} 👋</h2>

                <p>

                Your booking request for

                <b>${selectedProperty.propertyName || selectedProperty.title}</b>

                has been received successfully.

                </p>

                <p>

                <b>Status:</b> Pending Approval

                </p>

                <br>

                <p>

                We will notify you once the owner responds.

                </p>

                <hr>

                <h3>Campora</h3>

            </div>
            `

        );

        // =====================================
        // EMAIL TO OWNER
        // =====================================

        await safelySendEmail(

            selectedProperty.owner && selectedProperty.owner.email
                ? selectedProperty.owner.email
                : process.env.FROM_EMAIL,

            "📢 New Booking Received",

            `
            <div style="font-family:Arial;padding:25px">

                <h2>New Booking Request</h2>

                <p>

                <b>Property:</b>

                ${selectedProperty.propertyName || selectedProperty.title}

                </p>

                <p>

                <b>Student:</b>

                ${student.name}

                </p>

                <p>

                <b>Email:</b>

                ${student.email}

                </p>

                <p>

                Please login to Campora dashboard.

                </p>

            </div>
            `

        );

        res.json({

            success: true,

            message: "Booking created successfully",

            booking

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Booking failed"

        });

    }

});

// =====================================
// GET ALL BOOKINGS (scoped by role)
// =====================================

router.get("/", auth, async (req, res) => {

    try {

        const isAdmin = req.user.role === "admin";

        const filter = {};

        if (!isAdmin) {

            if (req.user.role === "owner") {

                // Owners see bookings for their own properties
                const ownedProperties = await Property.find({ owner: req.user.id }).select("_id");

                filter.propertyId = { $in: ownedProperties.map((p) => p._id) };

                if (ownedProperties.length === 0) {

                    return res.json({ success: true, bookings: [] });

                }

            } else {

                // Students see only their own bookings
                filter.userId = req.user.id;

            }

        }

        const bookings = await Booking.find(filter)

            .populate("userId", "name email")

            .populate("propertyId", "propertyName city state rent images")

            .sort({

                createdAt: -1

            });

        res.json({

            success: true,

            bookings

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

// =====================================
// CHECK DUPLICATE BOOKING
// =====================================

router.get("/check", auth, async (req, res) => {
    try {
        const { propertyId } = req.query;
        if (!propertyId) {
            return res.status(400).json({ success: false, message: "Property ID required" });
        }
        const existing = await Booking.findOne({
            propertyId,
            userId: req.user.id,
            bookingStatus: { $nin: ["cancelled"] }
        });
        res.json({ success: true, exists: !!existing });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: "Server Error" });
    }
});

// =====================================
// GET BOOKING BY ID (auth + ownership)
// =====================================

router.get("/:id", auth, async (req, res) => {

    try {

        const { id } = req.params;

        if (!isValidObjectId(id)) {

            return res.status(400).json({

                success: false,

                message: "Invalid booking ID"

            });

        }

        const booking = await Booking.findById(id)
            .populate("userId", "name email phone")
            .populate("propertyId", "propertyName propertyType city state rent deposit images sharing gender");

        if (!booking) {

            return res.status(404).json({

                success: false,

                message: "Booking not found"

            });

        }

        const isAdmin = req.user.role === "admin";

        const isOwner = req.user.role === "owner" &&
            String(booking.ownerId) === String(req.user.id);

        const isStudent = req.user.role === "student" &&
            String(booking.userId) === String(req.user.id);

        if (!isAdmin && !isOwner && !isStudent) {

            return res.status(403).json({

                success: false,

                message: "You are not allowed to view this booking"

            });

        }

        res.json({

            success: true,

            booking

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Server Error"

        });

    }

});

// =====================================
// UPDATE STATUS (auth + ownership + no payment bypass)
// =====================================

router.put("/:id", auth, async (req, res) => {

    try {

        const { id } = req.params;

        if (!isValidObjectId(id)) {

            return res.status(400).json({

                success: false,

                message: "Invalid booking ID"

            });

        }

        const booking = await Booking.findById(id);

        if (!booking) {

            return res.status(404).json({

                success: false,

                message: "Booking not found"

            });

        }

        const isAdmin = req.user.role === "admin";

        const isOwner = req.user.role === "owner" &&
            String(booking.ownerId) === String(req.user.id);

        const isStudent = req.user.role === "student" &&
            String(booking.userId) === String(req.user.id);

        if (!isAdmin && !isOwner && !isStudent) {

            return res.status(403).json({

                success: false,

                message: "You are not allowed to update this booking"

            });

        }

        // Students can cancel + update request details only.
        // They can NEVER set payment fields (prevents payment bypass).
        let allowedFields = [
            "checkIn",
            "checkOut",
            "numberOfGuests",
            "specialRequest"
        ];

        if (isOwner || isAdmin) {

            allowedFields = [
                ...allowedFields,
                "cancelReason",
                "bookingStatus"
            ];

        }

        if (isAdmin) {

            allowedFields = [
                ...allowedFields,
                "paymentStatus",
                "paymentId",
                "paymentDate",
                "paymentMethod"
            ];

        }

        const updates = {};

        allowedFields.forEach((field) => {

            if (req.body[field] !== undefined) {

                updates[field] = req.body[field];

            }

        });

        // Legacy `status` field maps to bookingStatus for non-admins
        if (req.body.status !== undefined && updates.bookingStatus === undefined && (isOwner || isStudent)) {

            updates.status = req.body.status;
            updates.bookingStatus = req.body.status;

        }

        Object.assign(booking, updates);

        await booking.save();

        if (booking.bookingStatus === "confirmed") {
            try {
                const { syncBookingConversation } = require("../utils/bookingHelper");
                await syncBookingConversation(booking);
            } catch (e) {
                console.error("Booking status update sync failed:", e.message);
            }
        }

        res.json({

            success: true,

            booking

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Update failed"

        });

    }

});

module.exports = router;
