const express = require("express");
const router = express.Router();

const auth = require("../middleware/auth");
const User = require("../models/User");
const Booking = require("../models/Booking");
const Notification = require("../models/Notification");
const Property = require("../models/Property");

router.get("/", auth, async (req, res) => {

    try {

        const userId = req.user.id;

        const user = await User.findById(userId);

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }

        const saved = user.savedProperties ? user.savedProperties.length : 0;

        const bookings = await Booking.countDocuments({ userId });

        const viewed = user.recentlyViewed ? user.recentlyViewed.length : 0;

        const contacts = 0;

        const properties = await Property.find({ available: true, published: true })
            .populate("owner", "name phone email")
            .sort({ featured: -1, averageRating: -1, createdAt: -1 })
            .limit(8);

        const recentBookings = await Booking.find({ userId })
            .populate("propertyId", "propertyName city state images")
            .sort({ createdAt: -1 })
            .limit(5);

        const notifications = await Notification.find({ receiverId: userId })
            .sort({ createdAt: -1 })
            .limit(10);

        const unreadNotifications = await Notification.countDocuments({ receiverId: userId, isRead: false });

        res.json({

            success: true,

            user: {
                id: user._id,
                name: user.name,
                email: user.email,
                avatar: user.profileImage || user.avatar,
                role: user.role,
                college: user.college,
                course: user.course
            },

            stats: {
                saved,
                bookings,
                viewed,
                contacts,
                unreadNotifications
            },

            properties,
            recentBookings,
            notifications

        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

module.exports = router;
