// ======================================================
// CAMPORA OWNER DASHBOARD
// ======================================================

const Property = require("../models/Property");
const Booking = require("../models/Booking");

exports.dashboard = async (req, res) => {

    try {

        const ownerId = req.user.id;

        // ==========================================
        // OWNER PROPERTIES
        // ==========================================

        const properties = await Property.find({

            owner: ownerId

        }).sort({

            createdAt: -1

        });

        const propertyIds = properties.map(

            property => property._id

        );

        // ==========================================
        // BOOKINGS
        // ==========================================

        const bookings = await Booking.find({

            propertyId: {

                $in: propertyIds

            }

        }).sort({

            createdAt: -1

        });

        // ==========================================
        // COUNTS
        // ==========================================

        const totalProperties = properties.length;

        const approvedProperties = properties.filter(

            property => property.status === "approved"

        ).length;

        const pendingProperties = properties.filter(

            property => property.status === "pending"

        ).length;

        const totalBookings = bookings.length;

        const activeBookings = bookings.filter(

            booking => booking.bookingStatus === "confirmed"

        ).length;

        // ==========================================
        // REVENUE
        // ==========================================

        const totalRevenue = bookings

            .filter(

                booking => booking.paymentStatus === "paid"

            )

            .reduce(

                (sum, booking) => sum + booking.price,

                0

            );

        // ==========================================
        // OCCUPANCY
        // ==========================================

        const totalBeds = properties.reduce(

            (sum, property) =>

                sum + (property.totalBeds || 0),

            0

        );

        const availableBeds = properties.reduce(

            (sum, property) =>

                sum + (property.availableBeds || 0),

            0

        );

        const occupiedBeds =

            totalBeds - availableBeds;

        const occupancy =

            totalBeds === 0

                ? 0

                : Math.round(

                    (occupiedBeds / totalBeds) * 100

                );

        // ==========================================
        // RESPONSE
        // ==========================================

        return res.json({

            success: true,

            stats: {

                totalProperties,

                approvedProperties,

                pendingProperties,

                totalBookings,

                activeBookings,

                totalRevenue,

                occupancy

            },

            properties,

            bookings: bookings.slice(0, 10)

        });

    }

    catch (err) {

        return res.status(500).json({

            success: false,

            message: err.message

        });

    }

};