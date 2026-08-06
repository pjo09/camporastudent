const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");

// ==========================================
// STUDENT DASHBOARD
// ==========================================

exports.dashboard = async (req, res) => {

    try {

        const userId = req.user.id;

        const user = await User.findById(userId);

        if (!user) {

            return res.status(404).json({
                success: false,
                message: "User not found"
            });

        }

        const savedCount = user.savedProperties
            ? user.savedProperties.length
            : 0;

        const bookingCount = await Booking.countDocuments({

            student: userId

        });

        const viewedCount = user.viewedProperties
            ? user.viewedProperties.length
            : 0;

        const recommended = await Property.find({

            status: "approved",
            published: true,
            available: true

        })

        .sort({

            featured: -1,
            averageRating: -1,
            createdAt: -1

        })

        .limit(6);

        const recentBookings = await Booking.find({

            student: userId

        })

        .populate("property")

        .sort({

            createdAt: -1

        })

        .limit(5);

        res.json({

            success: true,

            user:{

                id:user._id,

                name:user.name,

                email:user.email,

                avatar:user.profileImage,

                role:user.role

            },

            statistics:{

                saved:savedCount,

                bookings:bookingCount,

                viewed:viewedCount

            },

            recommended,

            recentBookings

        });

    }

    catch(err){

        console.log(err);

        res.status(500).json({

            success:false,

            message:err.message

        });

    }

};