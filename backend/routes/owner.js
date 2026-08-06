// ======================================================
// CAMPORA OWNER ROUTES
// PART 1
// Imports • Middleware • Helpers • Profile
// Dashboard • Analytics • Earnings
// ======================================================

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const auth = require("../middleware/auth");

const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");
const Review = require("../models/Review");
const Notification = require("../models/Notification");
const bcrypt = require("bcryptjs");

// ======================================================
// HELPERS
// ======================================================

function sendSuccess(res, data = {}, status = 200) {

    return res.status(status).json({
        success: true,
        ...data
    });

}

function sendError(res, message, status = 500) {

    return res.status(status).json({
        success: false,
        message
    });

}

function isValidObjectId(id) {

    return mongoose.Types.ObjectId.isValid(id);

}

// ======================================================
// OWNER AUTH CHECK
// ======================================================

router.use(auth);

router.use(async (req, res, next) => {

    try {

        const owner = await User.findById(req.user.id);

        if (!owner) {

            return sendError(
                res,
                "User not found",
                404
            );

        }

        if (owner.role !== "owner") {

            return sendError(
                res,
                "Only PG Owners can access this route",
                403
            );

        }

        req.owner = owner;

        return next();

    }

    catch (err) {

        return sendError(
            res,
            err.message
        );

    }

});

// ======================================================
// OWNER PROFILE
// ======================================================

router.get("/profile", async (req, res) => {

    try {

        const owner = await User.findById(req.owner._id)

            .select("-password")

            .populate({

                path: "savedProperties",

                select: "propertyName city rent"

            });

        return sendSuccess(res, {

            owner

        });

    }

    catch (err) {

        return sendError(

            res,

            err.message

        );

    }

});

// ======================================================
// UPDATE PROFILE
// ======================================================

router.put("/profile", async (req, res) => {

    try {

        const allowedFields = [

            "name",

            "phone",

            "bio",

            "businessName",

            "city",

            "gstNumber",

            "profileImage"

        ];

        allowedFields.forEach(field => {

            if (req.body[field] !== undefined) {

                req.owner[field] = req.body[field];

            }

        });

        await req.owner.save();

        return sendSuccess(res, {

            message: "Profile Updated Successfully",

            owner: req.owner

        });

    }

    catch (err) {

        return sendError(

            res,

            err.message

        );

    }

});

// ======================================================
// CHANGE PASSWORD
// ======================================================

router.put("/change-password", async (req, res) => {

    try {

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {

            return sendError(res, "Current and new password are required", 400);

        }

        if (newPassword.length < 6) {

            return sendError(res, "New password must be at least 6 characters", 400);

        }

        if (!req.owner.password) {

            return sendError(res, "This account uses another sign-in method. Set a password via password reset.", 400);

        }

        const isMatch = await bcrypt.compare(currentPassword, req.owner.password);

        if (!isMatch) {

            return sendError(res, "Current password is incorrect", 401);

        }

        const hashed = await bcrypt.hash(newPassword, 12);

        req.owner.password = hashed;

        await req.owner.save();

        return sendSuccess(res, {

            message: "Password changed successfully"

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// OWNER DASHBOARD
// ======================================================

router.get("/dashboard", async (req, res) => {

    try {

        const ownerId = req.owner._id;

        const [

            totalProperties,

            approvedProperties,

            pendingProperties,

            rejectedProperties,

            bookings,

            properties

        ] = await Promise.all([

            Property.countDocuments({

                owner: ownerId

            }),

            Property.countDocuments({

                owner: ownerId,

                status: "approved"

            }),

            Property.countDocuments({

                owner: ownerId,

                status: "pending"

            }),

            Property.countDocuments({

                owner: ownerId,

                status: "rejected"

            }),

            Booking.find({

                ownerId

            }),

            Property.find({

                owner: ownerId

            })

        ]);

        let earnings = 0;

        bookings.forEach(item => {

            if (item.paymentStatus === "paid") {

                earnings += item.price || 0;

            }

        });

        let totalViews = 0;

        let totalBeds = 0;

        let availableBeds = 0;

        properties.forEach(property => {

            totalViews += property.views || 0;

            totalBeds += property.totalBeds || 0;

            availableBeds += property.availableBeds || 0;

        });

        return sendSuccess(res, {

            statistics: {

                totalProperties,

                approvedProperties,

                pendingProperties,

                rejectedProperties,

                totalBookings: bookings.length,

                earnings,

                totalViews,

                totalBeds,

                occupiedBeds:

                    totalBeds - availableBeds,

                availableBeds

            }

        });

    }

    catch (err) {

        return sendError(

            res,

            err.message

        );

    }

});

// ======================================================
// ANALYTICS
// ======================================================

router.get("/analytics", async (req, res) => {

    try {

        const ownerId = req.owner._id;

        const monthlyBookings = await Booking.aggregate([

            {

                $match: {

                    ownerId

                }

            },

            {

                $group: {

                    _id: {

                        month: {

                            $month: "$createdAt"

                        }

                    },

                    bookings: {

                        $sum: 1

                    },

                    revenue: {

                        $sum: "$price"

                    }

                }

            },

            {

                $sort: {

                    "_id.month": 1

                }

            }

        ]);

        return sendSuccess(res, {

            monthlyBookings

        });

    }

    catch (err) {

        return sendError(

            res,

            err.message

        );

    }

});

// ======================================================
// OWNER EARNINGS
// ======================================================

router.get("/earnings", async (req, res) => {

    try {

        const bookings = await Booking.find({

            ownerId: req.owner._id,

            paymentStatus: "paid"

        })

        .sort({

            createdAt: -1

        })

        .populate(

            "userId",

            "name email"

        )

        .populate(

            "propertyId",

            "propertyName city"

        );

        const revenue = bookings.reduce(

            (sum, booking) =>

                sum + (booking.price || 0),

            0

        );

        return sendSuccess(res, {

            revenue,

            totalBookings: bookings.length,

            bookings

        });

    }

    catch (err) {

        return sendError(

            res,

            err.message

        );

    }

});

// ======================================================
// PART 2 STARTS BELOW
// ======================================================
// ======================================================
// OWNER PROPERTY LIST
// ======================================================

router.get("/properties", async (req, res) => {

    try {

        const page = Math.max(Number(req.query.page) || 1, 1);
        const limit = Math.max(Number(req.query.limit) || 10, 1);
        const skip = (page - 1) * limit;

        const filter = {
            owner: req.owner._id
        };

        if (req.query.status)
            filter.status = req.query.status;

        if (req.query.available !== undefined)
            filter.available = req.query.available === "true";

        if (req.query.published !== undefined)
            filter.published = req.query.published === "true";

        if (req.query.city)
            filter.city = new RegExp(req.query.city, "i");

        if (req.query.propertyType)
            filter.propertyType = req.query.propertyType;

        if (req.query.search) {

            filter.$or = [

                {
                    propertyName: new RegExp(req.query.search, "i")
                },

                {
                    city: new RegExp(req.query.search, "i")
                },

                {
                    college: new RegExp(req.query.search, "i")
                }

            ];

        }

        const total = await Property.countDocuments(filter);

        const properties = await Property.find(filter)

            .sort({
                createdAt: -1
            })

            .skip(skip)

            .limit(limit);

        return sendSuccess(res, {

            total,

            page,

            totalPages: Math.ceil(total / limit),

            properties

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// SINGLE PROPERTY
// ======================================================

router.get("/properties/:id", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id))
            return sendError(res, "Invalid Property ID", 400);

        const property = await Property.findOne({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        return sendSuccess(res, {

            property

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// UPDATE PROPERTY
// ======================================================

router.put("/properties/:id", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id))
            return sendError(res, "Invalid Property ID", 400);

        const property = await Property.findOne({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        const allowed = [

            "propertyName",
            "propertyType",
            "state",
            "city",
            "college",
            "address",
            "rent",
            "deposit",
            "gender",
            "sharing",
            "description",
            "amenities",
            "availableBeds",
            "totalBeds",
            "maintenanceCharge",
            "electricityCharge",
            "foodCharge",
            "latitude",
            "longitude",
            "houseRules",
            "nearby"

        ];

        allowed.forEach(field => {

            if (req.body[field] !== undefined) {

                property[field] = req.body[field];

            }

        });

        await property.save();

        return sendSuccess(res, {

            message: "Property Updated Successfully",

            property

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// DELETE PROPERTY
// ======================================================

router.delete("/properties/:id", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id))
            return sendError(res, "Invalid Property ID", 400);

        const property = await Property.findOneAndDelete({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        await User.findByIdAndUpdate(

            req.owner._id,

            {

                $inc: {

                    propertyCount: -1

                }

            }

        );

        return sendSuccess(res, {

            message: "Property Deleted Successfully"

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// PUBLISH PROPERTY
// ======================================================

router.patch("/properties/:id/publish", async (req, res) => {

    try {

        const property = await Property.findOne({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        property.published = true;

        await property.save();

        return sendSuccess(res, {

            message: "Property Published",

            property

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// UNPUBLISH PROPERTY
// ======================================================

router.patch("/properties/:id/unpublish", async (req, res) => {

    try {

        const property = await Property.findOne({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        property.published = false;

        await property.save();

        return sendSuccess(res, {

            message: "Property Unpublished",

            property

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// CHANGE AVAILABILITY
// ======================================================

router.patch("/properties/:id/availability", async (req, res) => {

    try {

        const property = await Property.findOne({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        property.available = !!req.body.available;

        await property.save();

        return sendSuccess(res, {

            message: "Availability Updated",

            property

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// UPDATE RENT
// ======================================================

router.patch("/properties/:id/rent", async (req, res) => {

    try {

        const property = await Property.findOne({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        property.rent = Number(req.body.rent);

        await property.save();

        return sendSuccess(res, {

            message: "Rent Updated",

            property

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// UPDATE AVAILABLE BEDS
// ======================================================

router.patch("/properties/:id/beds", async (req, res) => {

    try {

        const property = await Property.findOne({

            _id: req.params.id,

            owner: req.owner._id

        });

        if (!property)
            return sendError(res, "Property Not Found", 404);

        property.availableBeds = Number(req.body.availableBeds);

        await property.save();

        return sendSuccess(res, {

            message: "Available Beds Updated",

            property

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// PART 3 STARTS BELOW
// ======================================================
// ======================================================
// OWNER BOOKINGS
// ======================================================

router.get("/bookings", async (req, res) => {

    try {

        const page = Math.max(parseInt(req.query.page) || 1, 1);
        const limit = Math.max(parseInt(req.query.limit) || 10, 1);
        const skip = (page - 1) * limit;

        const filter = {
            ownerId: req.owner._id
        };

        if (req.query.status) {
            filter.bookingStatus = req.query.status;
        }

        if (req.query.paymentStatus) {
            filter.paymentStatus = req.query.paymentStatus;
        }

        const total = await Booking.countDocuments(filter);

        const bookings = await Booking.find(filter)

            .populate(
                "userId",
                "name email phone"
            )

            .populate(
                "propertyId",
                "propertyName city rent"
            )

            .sort({
                createdAt: -1
            })

            .skip(skip)

            .limit(limit);

        return sendSuccess(res, {

            total,

            page,

            totalPages: Math.ceil(total / limit),

            bookings

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// SINGLE BOOKING
// ======================================================

router.get("/bookings/:id", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {

            return sendError(

                res,

                "Invalid Booking ID",

                400

            );

        }

        const booking = await Booking.findOne({

            _id: req.params.id,

            ownerId: req.owner._id

        })

        .populate(

            "userId",

            "name email phone"

        )

        .populate(

            "propertyId"

        );

        if (!booking) {

            return sendError(

                res,

                "Booking Not Found",

                404

            );

        }

        return sendSuccess(res, {

            booking

        });

    }

    catch (err) {

        return sendError(

            res,

            err.message

        );

    }

});

// ======================================================
// CONFIRM BOOKING
// ======================================================

router.patch(

    "/bookings/:id/confirm",

    async (req, res) => {

        try {

            const booking = await Booking.findOne({

                _id: req.params.id,

                ownerId: req.owner._id

            });

            if (!booking) {

                return sendError(

                    res,

                    "Booking Not Found",

                    404

                );

            }

            booking.bookingStatus = "confirmed";

            await booking.save();

            return sendSuccess(res, {

                message: "Booking Confirmed",

                booking

            });

        }

        catch (err) {

            return sendError(

                res,

                err.message

            );

        }

    }

);

// ======================================================
// REJECT BOOKING
// ======================================================

router.patch(

    "/bookings/:id/reject",

    async (req, res) => {

        try {

            const booking = await Booking.findOne({

                _id: req.params.id,

                ownerId: req.owner._id

            });

            if (!booking) {

                return sendError(

                    res,

                    "Booking Not Found",

                    404

                );

            }

            booking.bookingStatus = "cancelled";

            booking.cancelReason =

                req.body.reason || "";

            await booking.save();

            return sendSuccess(res, {

                message: "Booking Rejected",

                booking

            });

        }

        catch (err) {

            return sendError(

                res,

                err.message

            );

        }

    }

);

// ======================================================
// CHECK IN
// ======================================================

router.patch(

    "/bookings/:id/checkin",

    async (req, res) => {

        try {

            const booking = await Booking.findOne({

                _id: req.params.id,

                ownerId: req.owner._id

            });

            if (!booking) {

                return sendError(

                    res,

                    "Booking Not Found",

                    404

                );

            }

            booking.bookingStatus = "checked-in";

            booking.checkInDate = new Date();

            await booking.save();

            return sendSuccess(res, {

                message: "Student Checked In",

                booking

            });

        }

        catch (err) {

            return sendError(

                res,

                err.message

            );

        }

    }

);

// ======================================================
// CHECK OUT
// ======================================================

router.patch(

    "/bookings/:id/checkout",

    async (req, res) => {

        try {

            const booking = await Booking.findOne({

                _id: req.params.id,

                ownerId: req.owner._id

            });

            if (!booking) {

                return sendError(

                    res,

                    "Booking Not Found",

                    404

                );

            }

            booking.bookingStatus = "checked-out";

            booking.checkOutDate = new Date();

            await booking.save();

            return sendSuccess(res, {

                message: "Student Checked Out",

                booking

            });

        }

        catch (err) {

            return sendError(

                res,

                err.message

            );

        }

    }

);

// ======================================================
// PART 3B STARTS BELOW
// ======================================================
// ======================================================
// PAYMENT RECEIVED
// ======================================================

router.patch("/bookings/:id/payment", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {

            return sendError(
                res,
                "Invalid Booking ID",
                400
            );

        }

        const booking = await Booking.findOne({

            _id: req.params.id,

            ownerId: req.owner._id

        });

        if (!booking) {

            return sendError(
                res,
                "Booking Not Found",
                404
            );

        }

        booking.paymentStatus = "paid";

        booking.paymentDate = new Date();

        await booking.save();

        return sendSuccess(res, {

            message: "Payment Marked As Received",

            booking

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// MARK PAYMENT PENDING
// ======================================================

router.patch("/bookings/:id/payment/pending", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {

            return sendError(res, "Invalid Booking ID", 400);

        }

        const booking = await Booking.findOne({

            _id: req.params.id,

            ownerId: req.owner._id

        });

        if (!booking) {

            return sendError(res, "Booking Not Found", 404);

        }

        booking.paymentStatus = "pending";

        await booking.save();

        return sendSuccess(res, {

            message: "Payment Status Updated",

            booking

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// BOOKING STATISTICS
// ======================================================

router.get("/booking-statistics", async (req, res) => {

    try {

        const ownerId = req.owner._id;

        const [

            total,

            pending,

            confirmed,

            checkedIn,

            checkedOut,

            cancelled,

            paid,

            unpaid

        ] = await Promise.all([

            Booking.countDocuments({

                ownerId

            }),

            Booking.countDocuments({

                ownerId,

                bookingStatus: "pending"

            }),

            Booking.countDocuments({

                ownerId,

                bookingStatus: "confirmed"

            }),

            Booking.countDocuments({

                ownerId,

                bookingStatus: "checked-in"

            }),

            Booking.countDocuments({

                ownerId,

                bookingStatus: "checked-out"

            }),

            Booking.countDocuments({

                ownerId,

                bookingStatus: "cancelled"

            }),

            Booking.countDocuments({

                ownerId,

                paymentStatus: "paid"

            }),

            Booking.countDocuments({

                ownerId,

                paymentStatus: "pending"

            })

        ]);

        return sendSuccess(res, {

            statistics: {

                total,

                pending,

                confirmed,

                checkedIn,

                checkedOut,

                cancelled,

                paid,

                unpaid

            }

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// RECENT BOOKINGS
// ======================================================

router.get("/recent-bookings", async (req, res) => {

    try {

        const bookings = await Booking.find({

            ownerId: req.owner._id

        })

        .populate(

            "userId",

            "name email"

        )

        .populate(

            "propertyId",

            "propertyName city"

        )

        .sort({

            createdAt: -1

        })

        .limit(10);

        return sendSuccess(res, {

            bookings

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// PART 3B2 STARTS BELOW
// ======================================================
// ======================================================
// OWNER REVIEWS
// ======================================================

router.get("/reviews", async (req, res) => {

    try {

        const properties = await Property.find({

            owner: req.owner._id

        }).select("_id");

        const propertyIds = properties.map(item => item._id);

        const reviews = await Review.find({

            property: {

                $in: propertyIds

            }

        })

        .populate("user", "name profileImage")

        .populate("property", "propertyName")

        .sort({

            createdAt: -1

        });

        return sendSuccess(res, {

            total: reviews.length,

            reviews

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// RECENT ACTIVITY
// ======================================================

router.get("/recent-activity", async (req, res) => {

    try {

        const recentProperties = await Property.find({

            owner: req.owner._id

        })

        .sort({

            updatedAt: -1

        })

        .limit(5);

        const recentBookings = await Booking.find({

            ownerId: req.owner._id

        })

        .sort({

            updatedAt: -1

        })

        .limit(5);

        return sendSuccess(res, {

            properties: recentProperties,

            bookings: recentBookings

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// TOP PROPERTIES
// ======================================================

router.get("/top-properties", async (req, res) => {

    try {

        const properties = await Property.find({

            owner: req.owner._id

        })

        .sort({

            views: -1,

            averageRating: -1

        })

        .limit(5);

        return sendSuccess(res, {

            properties

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// REVENUE SUMMARY
// ======================================================

router.get("/revenue-summary", async (req, res) => {

    try {

        const bookings = await Booking.find({

            ownerId: req.owner._id,

            paymentStatus: "paid"

        });

        let revenue = 0;

        bookings.forEach(item => {

            revenue += Number(item.price || item.amount || 0);

        });

        const monthlyRevenue = await Booking.aggregate([

            {

                $match: {

                    ownerId: req.owner._id,

                    paymentStatus: "paid"

                }

            },

            {

                $group: {

                    _id: {

                        month: {

                            $month: "$createdAt"

                        }

                    },

                    revenue: {

                        $sum: "$price"

                    }

                }

            },

            {

                $sort: {

                    "_id.month": 1

                }

            }

        ]);

        return sendSuccess(res, {

            totalRevenue: revenue,

            monthlyRevenue

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// OWNER NOTIFICATIONS
// ======================================================

router.get("/notifications", async (req, res) => {

    try {

        const notifications = [];

        const pendingBookings = await Booking.countDocuments({

            ownerId: req.owner._id,

            bookingStatus: "pending"

        });

        if (pendingBookings > 0) {

            notifications.push({

                type: "booking",

                title: "Pending Bookings",

                message: `${pendingBookings} booking(s) require your approval.`

            });

        }

        const pendingProperties = await Property.countDocuments({

            owner: req.owner._id,

            status: "pending"

        });

        if (pendingProperties > 0) {

            notifications.push({

                type: "property",

                title: "Properties Under Review",

                message: `${pendingProperties} property(s) are waiting for admin approval.`

            });

        }

        return sendSuccess(res, {

            total: notifications.length,

            notifications

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// OWNER DASHBOARD SUMMARY
// ======================================================

router.get("/summary", async (req, res) => {

    try {

        const ownerId = req.owner._id;

        const [

            totalProperties,

            availableProperties,

            totalBookings,

            totalReviews

        ] = await Promise.all([

            Property.countDocuments({

                owner: ownerId

            }),

            Property.countDocuments({

                owner: ownerId,

                available: true

            }),

            Booking.countDocuments({

                ownerId

            }),

            Review.countDocuments({

                owner: ownerId

            })

        ]);

        return sendSuccess(res, {

            summary: {

                totalProperties,

                availableProperties,

                totalBookings,

                totalReviews

            }

        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// PART 4 STARTS BELOW
// ======================================================
// ======================================================
// OWNER STUDENTS MODULE
// ======================================================

router.get("/students", async (req, res) => {

    try {

        const { search, status } = req.query;

        const filter = {
            ownerId: req.owner._id
        };

        if (status) {
            filter.bookingStatus = status;
        }

        // Base query: active/confirmed bookings for this owner
        let bookings = await Booking.find(filter)
            .populate("userId", "name email phone college course profileImage status")
            .populate("propertyId", "propertyName city roomNumber");

        // Apply search filter on populated student fields
        if (search) {
            const term = search.toLowerCase();
            bookings = bookings.filter((b) => {
                const u = b.userId || {};
                return (
                    (u.name || "").toLowerCase().includes(term) ||
                    (u.email || "").toLowerCase().includes(term) ||
                    (u.phone || "").toLowerCase().includes(term) ||
                    (u.college || "").toLowerCase().includes(term)
                );
            });
        }

        // Deduplicate by student (a student may have multiple bookings)
        const studentsMap = new Map();
        bookings.forEach((b) => {
            const student = b.userId;
            if (!student || !student._id) return;
            const key = String(student._id);
            if (!studentsMap.has(key)) {
                studentsMap.set(key, {
                    student,
                    booking: b,
                    property: b.propertyId || null
                });
            }
        });

        const students = Array.from(studentsMap.values());

        return sendSuccess(res, {
            total: students.length,
            students
        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// SINGLE STUDENT PROFILE
// ======================================================

router.get("/students/:id", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {
            return sendError(res, "Invalid Student ID", 400);
        }

        const student = await User.findById(req.params.id)
            .select("-password");

        if (!student) {
            return sendError(res, "Student Not Found", 404);
        }

        // Verify this student has a booking with this owner
        const booking = await Booking.findOne({
            ownerId: req.owner._id,
            userId: student._id
        });

        if (!booking) {
            return sendError(res, "This student is not associated with your properties", 403);
        }

        // Booking history with this owner
        const bookingHistory = await Booking.find({
            ownerId: req.owner._id,
            userId: student._id
        })
        .populate("propertyId", "propertyName city")
        .sort({ createdAt: -1 });

        // Payment history from invoices
        const Invoice = require("../models/Invoice");
        const invoices = await Invoice.find({
            ownerId: req.owner._id,
            studentId: student._id
        })
        .sort({ createdAt: -1 });

        return sendSuccess(res, {
            student,
            currentBooking: booking,
            bookingHistory,
            invoices
        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// REVIEW ACTION (reply / hide)
// ======================================================

router.post("/reviews/:id/reply", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {
            return sendError(res, "Invalid Review ID", 400);
        }

        const review = await Review.findById(req.params.id);

        if (!review) {
            return sendError(res, "Review Not Found", 404);
        }

        // Verify the review belongs to one of this owner's properties
        const property = await Property.findOne({
            _id: review.property,
            owner: req.owner._id
        });

        if (!property) {
            return sendError(res, "You can only reply to reviews on your own properties", 403);
        }

        const { reply } = req.body;

        review.ownerReply = reply || "";

        await review.save();

        return sendSuccess(res, {
            message: "Reply Added",
            review
        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// HIDE REVIEW
// ======================================================

router.patch("/reviews/:id/hide", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {
            return sendError(res, "Invalid Review ID", 400);
        }

        const review = await Review.findById(req.params.id);

        if (!review) {
            return sendError(res, "Review Not Found", 404);
        }

        const property = await Property.findOne({
            _id: review.property,
            owner: req.owner._id
        });

        if (!property) {
            return sendError(res, "You can only moderate reviews on your own properties", 403);
        }

        review.status = "hidden";

        await review.save();

        return sendSuccess(res, {
            message: "Review Hidden",
            review
        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// SEND NOTIFICATION (broadcast to students)
// ======================================================

router.post("/notifications/send", async (req, res) => {

    try {

        const { title, message, type, audience, propertyId } = req.body;

        if (!title || !message) {
            return sendError(res, "Title and message are required", 400);
        }

        const Notification = require("../models/Notification");

        // Determine recipient students
        let studentIds = [];

        if (audience === "all") {
            const bookings = await Booking.find({
                ownerId: req.owner._id,
                bookingStatus: { $in: ["confirmed", "checked-in"] }
            });
            studentIds = [...new Set(bookings.map(b => String(b.userId)))];
        } else if (audience === "property" && propertyId) {
            const bookings = await Booking.find({
                ownerId: req.owner._id,
                propertyId,
                bookingStatus: { $in: ["confirmed", "checked-in"] }
            });
            studentIds = bookings.map(b => String(b.userId));
        } else {
            return sendError(res, "Please specify a valid audience", 400);
        }

        if (!studentIds.length) {
            return sendError(res, "No students found for this audience", 400);
        }

        const notifications = studentIds.map(id => ({
            receiverId: id,
            title,
            message,
            type: type || "general"
        }));

        await Notification.insertMany(notifications);

        return sendSuccess(res, {
            message: "Notifications sent",
            total: notifications.length
        }, 201);

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// DUPLICATE PROPERTY
// ======================================================

router.post("/properties/:id/duplicate", async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {
            return sendError(res, "Invalid Property ID", 400);
        }

        const source = await Property.findOne({
            _id: req.params.id,
            owner: req.owner._id
        });

        if (!source) {
            return sendError(res, "Property Not Found", 404);
        }

        const copy = source.toObject();

        delete copy._id;
        delete copy.createdAt;
        delete copy.updatedAt;
        delete copy.__v;

        copy.propertyName = source.propertyName + " (Copy)";
        copy.status = "pending";
        copy.published = false;
        copy.views = 0;
        copy.averageRating = 0;
        copy.totalReviews = 0;
        copy.featured = false;
        copy.verified = false;

        const newProperty = await Property.create(copy);

        await User.findByIdAndUpdate(
            req.owner._id,
            { $inc: { propertyCount: 1 } }
        );

        return sendSuccess(res, {
            message: "Property Duplicated",
            property: newProperty
        }, 201);

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// ENHANCED DASHBOARD (with metrics for V3)
// ======================================================

router.get("/dashboard-v3", async (req, res) => {

    try {

        const ownerId = req.owner._id;

        const now = new Date();
        const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());

        const Maintenance = require("../models/Maintenance");

        const [
            totalProperties,
            approvedProperties,
            pendingProperties,
            activeStudents,
            totalBookings,
            pendingBookings,
            todayCheckIns,
            todayCheckOuts,
            pendingReviews,
            pendingMaintenance,
            urgentMaintenance,
            todayRevenue,
            monthlyRevenue,
            monthlyBookings,
            recentBookings,
            recentReviews,
            recentNotifications,
            properties
        ] = await Promise.all([

            Property.countDocuments({ owner: ownerId }),

            Property.countDocuments({ owner: ownerId, status: "approved" }),

            Property.countDocuments({ owner: ownerId, status: "pending" }),

            Booking.countDocuments({ ownerId, bookingStatus: { $in: ["confirmed", "checked-in"] } }),

            Booking.countDocuments({ ownerId }),

            Booking.countDocuments({ ownerId, bookingStatus: "pending" }),

            Booking.countDocuments({
                ownerId,
                checkInDate: { $gte: startOfToday }
            }),

            Booking.countDocuments({
                ownerId,
                checkOutDate: { $gte: startOfToday }
            }),

            Review.countDocuments({
                property: { $in: await Property.find({ owner: ownerId }).select("_id").then(p => p.map(x => x._id)) },
                status: "pending"
            }),

            Maintenance.countDocuments({ ownerId, status: { $in: ["open", "assigned", "in-progress"] } }),

            Maintenance.countDocuments({ ownerId, priority: "Urgent", status: { $ne: "resolved" } }),

            // Today's revenue (paid bookings today)
            Booking.find({
                ownerId,
                paymentStatus: "paid",
                paymentDate: { $gte: startOfToday }
            }).then(bs => bs.reduce((s, b) => s + (b.price || 0), 0)),

            // Monthly revenue
            Booking.find({
                ownerId,
                paymentStatus: "paid",
                createdAt: { $gte: startOfMonth }
            }).then(bs => bs.reduce((s, b) => s + (b.price || 0), 0)),

            // Monthly bookings
            Booking.countDocuments({ ownerId, createdAt: { $gte: startOfMonth } }),

            // Recent bookings
            Booking.find({ ownerId })
                .populate("userId", "name email")
                .populate("propertyId", "propertyName city")
                .sort({ createdAt: -1 })
                .limit(8),

            // Recent reviews
            Review.find({
                property: { $in: await Property.find({ owner: ownerId }).select("_id").then(p => p.map(x => x._id)) }
            })
                .populate("user", "name profileImage")
                .populate("property", "propertyName")
                .sort({ createdAt: -1 })
                .limit(5),

            // Recent notifications
            Notification.find({ receiverId: ownerId })
                .sort({ createdAt: -1 })
                .limit(8),

            // All properties for occupancy calc
            Property.find({ owner: ownerId })
        ]);

        // Occupancy
        let totalBeds = 0;
        let availableBeds = 0;
        properties.forEach(p => {
            totalBeds += p.totalBeds || 0;
            availableBeds += p.availableBeds || 0;
        });
        const occupancy = totalBeds ? Math.round(((totalBeds - availableBeds) / totalBeds) * 100) : 0;

        // Monthly revenue/booking series for charts
        const monthlyRevenueSeries = await Booking.aggregate([
            { $match: { ownerId, paymentStatus: "paid" } },
            { $group: { _id: { month: { $month: "$createdAt" } }, revenue: { $sum: "$price" } } },
            { $sort: { "_id.month": 1 } }
        ]);

        const monthlyBookingsSeries = await Booking.aggregate([
            { $match: { ownerId } },
            { $group: { _id: { month: { $month: "$createdAt" } }, bookings: { $sum: 1 } } },
            { $sort: { "_id.month": 1 } }
        ]);

        return sendSuccess(res, {
            statistics: {
                totalProperties,
                approvedProperties,
                pendingProperties,
                activeStudents,
                totalBookings,
                pendingBookings,
                todayCheckIns,
                todayCheckOuts,
                pendingReviews,
                pendingMaintenance,
                urgentMaintenance,
                todayRevenue,
                monthlyRevenue,
                monthlyBookings,
                occupancy,
                totalBeds,
                availableBeds
            },
            recentBookings,
            recentReviews,
            recentNotifications,
            charts: {
                monthlyRevenueSeries,
                monthlyBookingsSeries
            }
        });

    }

    catch (err) {

        return sendError(res, err.message);

    }

});

// ======================================================
// END OWNER ROUTES
// ======================================================

module.exports = router;
