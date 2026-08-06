const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const Review = require("../models/Review");
const Property = require("../models/Property");
const auth = require("../middleware/auth");

// ============================
// GET Reviews for Property
// ============================

router.get("/:propertyId", async (req, res) => {

    try {

        // Validate ObjectId before querying
        if (!mongoose.Types.ObjectId.isValid(req.params.propertyId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid property ID"
            });
        }

        const reviews = await Review.find({

            property: req.params.propertyId

        }).sort({ createdAt: -1 });

        const average =
            reviews.length > 0
                ? reviews.reduce((a, b) => a + b.rating, 0) / reviews.length
                : 0;

        res.json({

            success: true,

            average,

            total: reviews.length,

            reviews

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ============================
// ADD Review
// ============================

router.post("/", auth, async (req, res) => {

    try {

        const propertyId = req.body.property;

        if (!propertyId || !mongoose.Types.ObjectId.isValid(propertyId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid property ID"
            });
        }

        const property = await Property.findById(propertyId);
        if (!property) {
            return res.status(404).json({
                success: false,
                message: "Property not found"
            });
        }

        const rating = Number(req.body.rating);
        if (!rating || rating < 1 || rating > 5) {
            return res.status(400).json({
                success: false,
                message: "Rating must be between 1 and 5"
            });
        }

        const comment = (req.body.comment || "").toString().trim();
        if (!comment) {
            return res.status(400).json({
                success: false,
                message: "Review comment is required"
            });
        }

        const review = await Review.create({

            property: propertyId,

            user: req.user.id,

            name: req.user.name || req.body.userName || "Student",

            rating,

            comment

        });

        // Recompute property average rating
        const all = await Review.find({ property: propertyId });
        const avg = all.length
            ? all.reduce((s, r) => s + r.rating, 0) / all.length
            : 0;

        property.averageRating = Number(avg.toFixed(1));
        property.totalReviews = all.length;
        await property.save();

        res.json({

            success: true,

            review

        });

    } catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

module.exports = router;
