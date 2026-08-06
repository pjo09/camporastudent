// ======================================================
// CAMPORA ADMIN DASHBOARD
// ======================================================

const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");

exports.dashboard = async (req, res) => {

    try {

        // ==========================================
        // USERS
        // ==========================================

        const totalStudents = await User.countDocuments({

            role: "student"

        });

        const totalOwners = await User.countDocuments({

            role: "owner"

        });

        const totalAdmins = await User.countDocuments({

            role: "admin"

        });

        // ==========================================
        // PROPERTIES
        // ==========================================

        const totalProperties = await Property.countDocuments();

        const approvedProperties = await Property.countDocuments({

            status: "approved"

        });

        const pendingProperties = await Property.countDocuments({

            status: "pending"

        });

        const rejectedProperties = await Property.countDocuments({

            status: "rejected"

        });

        // ==========================================
        // BOOKINGS
        // ==========================================

        const totalBookings = await Booking.countDocuments();

        const confirmedBookings = await Booking.countDocuments({

            bookingStatus: "confirmed"

        });

        const pendingBookings = await Booking.countDocuments({

            bookingStatus: "pending"

        });

        // ==========================================
        // REVENUE
        // ==========================================

        const paidBookings = await Booking.find({

            paymentStatus: "paid"

        });

        const totalRevenue = paidBookings.reduce(

            (sum, booking) => sum + booking.price,

            0

        );

        // ==========================================
        // RECENT USERS
        // ==========================================

        const recentUsers = await User.find()

        .sort({

            createdAt: -1

        })

        .limit(10)

        .select("-password");

        // ==========================================
        // RECENT PROPERTIES
        // ==========================================

        const recentProperties = await Property.find()

        .populate("owner", "name email")

        .sort({

            createdAt: -1

        })

        .limit(10);

        // ==========================================
        // RESPONSE
        // ==========================================

        res.json({

            success: true,

            stats: {

                totalStudents,

                totalOwners,

                totalAdmins,

                totalProperties,

                approvedProperties,

                pendingProperties,

                rejectedProperties,

                totalBookings,

                confirmedBookings,

                pendingBookings,

                totalRevenue

            },

            recentUsers,

            recentProperties

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

};