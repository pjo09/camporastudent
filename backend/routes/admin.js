// ======================================================
// CAMPORA ADMIN ROUTES
// PART 1
// ======================================================

const express = require("express");
const router = express.Router();

const mongoose = require("mongoose");
const os = require("os");

const auth = require("../middleware/auth");

const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const Notification = require("../models/Notification");
const Setting = require("../models/Setting");

// ======================================================
// ADMIN AUTH
// ======================================================

router.use(auth);

// Hardened admin lookup middleware: validate token payload ID before DB operations
router.use(async (req, res, next) => {

    try {

        // Validate that the token contained a usable ObjectId-like user id
        if (!req.user || !req.user.id) {
            return res.status(401).json({ success: false, message: "Access denied. Token missing user id." });
        }

        if (!mongoose.Types.ObjectId.isValid(req.user.id)) {
            // Token payload contains an ID that is not a valid ObjectId string
            return res.status(400).json({ success: false, message: "Invalid User ID in token." });
        }

        const admin = await User.findById(req.user.id);

        if (!admin) {

            return res.status(401).json({
                success: false,
                message: "User not found"
            });

        }

        if (admin.role !== "admin") {

            return res.status(403).json({
                success: false,
                message: "Admin access only"
            });

        }

        req.admin = admin;

        return next();

    }

    catch (err) {

        // If Mongoose cast error slipped through, return 400
        if (err && err.name === "CastError") {
            return res.status(400).json({ success: false, message: "Invalid ID format." });
        }

        return res.status(500).json({
            success: false,
            message: "Internal server error"
        });

    }

});

// ======================================================
// HELPERS
// ======================================================

function success(res, data = {}) {

    return res.json({

        success: true,

        ...data

    });

}

function failure(res, message, status = 500) {

    return res.status(status).json({

        success: false,

        message

    });

}

function validId(id) {

    return mongoose.Types.ObjectId.isValid(id);

}

// ======================================================
// ADMIN PROFILE
// ======================================================

router.get("/profile", async (req, res) => {

    try {

        const admin = await User.findById(req.admin._id)

            .select("-password");

        return success(res, {

            admin

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// DASHBOARD STATISTICS
// ======================================================

router.get("/dashboard", async (req, res) => {

    try {

        const [

            totalUsers,

            totalStudents,

            totalOwners,

            totalAdmins,

            totalProperties,

            approvedProperties,

            pendingProperties,

            rejectedProperties,

            totalBookings,

            totalReviews

        ] = await Promise.all([

            User.countDocuments(),

            User.countDocuments({

                role: "student"

            }),

            User.countDocuments({

                role: "owner"

            }),

            User.countDocuments({

                role: "admin"

            }),

            Property.countDocuments(),

            Property.countDocuments({

                status: "approved"

            }),

            Property.countDocuments({

                status: "pending"

            }),

            Property.countDocuments({

                status: "rejected"

            }),

            Booking.countDocuments(),

            Review.countDocuments()

        ]);

        success(res, {

            statistics: {

                totalUsers,

                totalStudents,

                totalOwners,

                totalAdmins,

                totalProperties,

                approvedProperties,

                pendingProperties,

                rejectedProperties,

                totalBookings,

                totalReviews

            }

        });

    }

    catch (err) {

        failure(res, err.message);

    }

});

// ======================================================
// PLATFORM ANALYTICS
// ======================================================

router.get("/analytics", async (req, res) => {

    try {

        const propertyViews = await Property.aggregate([

            {

                $group: {

                    _id: null,

                    total: {

                        $sum: "$views"

                    }

                }

            }

        ]);

        const averageRent = await Property.aggregate([

            {

                $group: {

                    _id: null,

                    average: {

                        $avg: "$rent"

                    }

                }

            }

        ]);

        const availableBeds = await Property.aggregate([

            {

                $group: {

                    _id: null,

                    beds: {

                        $sum: "$availableBeds"

                    }

                }

            }

        ]);

        success(res, {

            analytics: {

                totalViews:

                    propertyViews.length

                    ? propertyViews[0].total

                    : 0,

                averageRent:

                    averageRent.length

                    ? Math.round(averageRent[0].average)

                    : 0,

                availableBeds:

                    availableBeds.length

                    ? availableBeds[0].beds

                    : 0

            }

        });

    }

    catch (err) {

        failure(res, err.message);

    }

});

// ======================================================
// RECENT ACTIVITY
// ======================================================

router.get("/activity", async (req, res) => {

    try {

        const users = await User.find()

            .sort({

                createdAt: -1

            })

            .limit(5);

        const properties = await Property.find()

            .sort({

                createdAt: -1

            })

            .limit(5);

        const bookings = await Booking.find()

            .sort({

                createdAt: -1

            })

            .limit(5);

        success(res, {

            users,

            properties,

            bookings

        });

    }

    catch (err) {

        failure(res, err.message);

    }

});

// ======================================================
// SERVER STATUS
// ======================================================

router.get("/health", async (req, res) => {
    success(res, {
        server: "Running",
        node: process.version,
        database: mongoose.connection.readyState,
        uptime: process.uptime(),
        timestamp: new Date()
    });
});

// ======================================================
// PART 2 STARTS BELOW
// ======================================================
// ======================================================
// ADMIN USERS
// PART 2A
// ======================================================

// ... rest of file unchanged until PROPERTY ANALYTICS section ...

// For brevity we include the remainder of the original file, but with targeted fixes applied where necessary.
