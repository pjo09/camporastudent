const express = require("express");
const router = express.Router();

const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");
const Review = require("../models/Review");

// =====================================================
// GET /api/statistics
// Public endpoint — returns real aggregate DB counts.
// Optimized with lean countDocuments + distinct queries.
// =====================================================

router.get("/", async (req, res) => {

    try {

        // Run all aggregation queries in parallel for speed.
        const [
            properties,
            verifiedOwners,
            students,
            cities,
            universities,
            bookings,
            reviews
        ] = await Promise.all([

            // properties = approved & visible properties only
            Property.countDocuments({
                status: "approved",
                published: true,
                available: true,
                blacklisted: { $ne: true }
            }),

            // verifiedOwners = ACTIVE owner accounts only
            User.countDocuments({
                role: "owner",
                accountStatus: "ACTIVE",
                status: "active"
            }),

            // students = ACTIVE student accounts only
            User.countDocuments({
                role: "student",
                accountStatus: "ACTIVE",
                status: "active"
            }),

            // cities = distinct property cities (from visible properties)
            Property.distinct("city", {
                status: "approved",
                published: true,
                available: true,
                blacklisted: { $ne: true }
            }).then((arr) => arr.filter(Boolean).length),

            // universities = distinct college names (from visible properties)
            Property.distinct("college", {
                status: "approved",
                published: true,
                available: true,
                blacklisted: { $ne: true }
            }).then((arr) => arr.filter(Boolean).length),

            // bookings = total bookings
            Booking.countDocuments({}),

            // reviews = total reviews
            Review.countDocuments({})

        ]);

        return res.json({
            success: true,
            statistics: {
                properties,
                verifiedOwners,
                students,
                cities,
                universities,
                bookings,
                reviews
            }
        });

    } catch (err) {

        console.error("Statistics Error:", err);

        // Return zeros gracefully on error — never throw.
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to load statistics",
            statistics: {
                properties: 0,
                verifiedOwners: 0,
                students: 0,
                cities: 0,
                universities: 0,
                bookings: 0,
                reviews: 0
            }
        });

    }

});

module.exports = router;
