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

router.use(async (req, res, next) => {

    try {

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

        return res.status(500).json({

            success: false,
            message: err.message

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

// ======================================================
// GET ALL USERS
// ======================================================

router.get("/users", async (req, res) => {

    try {

        const {

            page = 1,

            limit = 20,

            role,

            verified,

            search

        } = req.query;

        const filter = {};

        if (role) {

            filter.role = role;

        }

        if (verified !== undefined) {

            filter.verified = verified === "true";

        }

        if (search) {

            filter.$or = [

                {

                    name: {

                        $regex: search,

                        $options: "i"

                    }

                },

                {

                    email: {

                        $regex: search,

                        $options: "i"

                    }

                },

                {

                    phone: {

                        $regex: search,

                        $options: "i"

                    }

                }

            ];

        }

        const total = await User.countDocuments(filter);

        const users = await User.find(filter)

            .select("-password")

            .sort({

                createdAt: -1

            })

            .skip((page - 1) * Number(limit))

            .limit(Number(limit));

        return success(res, {

            total,

            currentPage: Number(page),

            totalPages: Math.ceil(total / Number(limit)),

            users

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// GET USER
// ======================================================

router.get("/users/:id", async (req, res) => {

    try {

        if (!validId(req.params.id)) {

            return failure(

                res,

                "Invalid User ID",

                400

            );

        }

        const user = await User.findById(req.params.id)

            .select("-password");

        if (!user) {

            return failure(

                res,

                "User not found",

                404

            );

        }

        return success(res, {

            user

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// USER STATISTICS
// ======================================================

router.get("/users/statistics/overview", async (req, res) => {

    try {

        const [

            totalUsers,

            students,

            owners,

            admins,

            verified,

            googleUsers,

            localUsers

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

            User.countDocuments({

                verified: true

            }),

            User.countDocuments({

                provider: "google"

            }),

            User.countDocuments({

                provider: "local"

            })

        ]);

        return success(res, {

            statistics: {

                totalUsers,

                students,

                owners,

                admins,

                verified,

                googleUsers,

                localUsers

            }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// GET STUDENTS
// ======================================================

router.get("/students", async (req, res) => {

    try {

        const students = await User.find({

            role: "student"

        })

        .select("-password")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: students.length,

            students

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// GET OWNERS
// ======================================================

router.get("/owners", async (req, res) => {

    try {

        const owners = await User.find({

            role: "owner"

        })

        .select("-password")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: owners.length,

            owners

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// GET ADMINS
// ======================================================

router.get("/admins", async (req, res) => {

    try {

        const admins = await User.find({

            role: "admin"

        })

        .select("-password")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: admins.length,

            admins

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// SEARCH USERS
// ======================================================

router.get("/users/search/:keyword", async (req, res) => {

    try {

        const keyword = req.params.keyword;

        const users = await User.find({

            $or: [

                {

                    name: {

                        $regex: keyword,

                        $options: "i"

                    }

                },

                {

                    email: {

                        $regex: keyword,

                        $options: "i"

                    }

                },

                {

                    phone: {

                        $regex: keyword,

                        $options: "i"

                    }

                }

            ]

        })

        .select("-password")

        .limit(50);

        return success(res, {

            total: users.length,

            users

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// PART 2B CONTINUES
// ======================================================
// ======================================================
// UPDATE USER
// ======================================================

router.put("/users/:id", async (req, res) => {

    try {

        if (!validId(req.params.id)) {

            return failure(res, "Invalid User ID", 400);

        }

        const allowedFields = [

            "name",
            "phone",
            "college",
            "course",
            "year",
            "businessName",
            "city",
            "bio",
            "profileImage"

        ];

        const updates = {};

        allowedFields.forEach(field => {

            if (req.body[field] !== undefined) {

                updates[field] = req.body[field];

            }

        });

        const user = await User.findByIdAndUpdate(

            req.params.id,

            updates,

            {

                new: true,
                runValidators: true

            }

        ).select("-password");

        if (!user) {

            return failure(res, "User not found", 404);

        }

        return success(res, {

            message: "User updated successfully",

            user

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// DELETE USER
// ======================================================

router.delete("/users/:id", async (req, res) => {

    try {

        if (!validId(req.params.id)) {

            return failure(res, "Invalid User ID", 400);

        }

        const user = await User.findById(req.params.id);

        if (!user) {

            return failure(res, "User not found", 404);

        }

        await User.findByIdAndDelete(req.params.id);

        return success(res, {

            message: "User deleted successfully"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// SUSPEND USER
// ======================================================

router.patch("/users/:id/suspend", async (req, res) => {

    try {

        const user = await User.findById(req.params.id);

        if (!user) {

            return failure(res, "User not found", 404);

        }

        user.status = "suspended";

        await user.save();

        return success(res, {

            message: "User suspended",

            user

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// ACTIVATE USER
// ======================================================

router.patch("/users/:id/activate", async (req, res) => {

    try {

        const user = await User.findById(req.params.id);

        if (!user) {

            return failure(res, "User not found", 404);

        }

        user.status = "active";

        await user.save();

        return success(res, {

            message: "User activated",

            user

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// VERIFY OWNER
// ======================================================

router.patch("/owners/:id/verify", async (req, res) => {

    try {

        const owner = await User.findById(req.params.id);

        if (!owner) {

            return failure(res, "Owner not found", 404);

        }

        if (owner.role !== "owner") {

            return failure(res, "User is not an owner", 400);

        }

        owner.verified = true;

        await owner.save();

        return success(res, {

            message: "Owner verified",

            owner

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// REMOVE OWNER VERIFICATION
// ======================================================

router.patch("/owners/:id/unverify", async (req, res) => {

    try {

        const owner = await User.findById(req.params.id);

        if (!owner) {

            return failure(res, "Owner not found", 404);

        }

        owner.verified = false;

        await owner.save();

        return success(res, {

            message: "Verification removed",

            owner

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// APPROVE OWNER (accountStatus -> ACTIVE)
// ======================================================

router.patch("/owners/:id/approve", async (req, res) => {

    try {

        const owner = await User.findById(req.params.id);

        if (!owner) {
            return failure(res, "Owner not found", 404);
        }

        if (owner.role !== "owner") {
            return failure(res, "User is not an owner", 400);
        }

        owner.accountStatus = "ACTIVE";
        owner.verified = true;
        owner.status = "active";
        await owner.save();

        return success(res, {
            message: "Owner approved",
            owner
        });

    }

    catch (err) {
        return failure(res, err.message);
    }

});

// ======================================================
// REJECT OWNER (accountStatus -> REJECTED)
// ======================================================

router.patch("/owners/:id/reject", async (req, res) => {

    try {

        const owner = await User.findById(req.params.id);

        if (!owner) {
            return failure(res, "Owner not found", 404);
        }

        if (owner.role !== "owner") {
            return failure(res, "User is not an owner", 400);
        }

        owner.accountStatus = "REJECTED";
        await owner.save();

        return success(res, {
            message: "Owner rejected",
            owner
        });

    }

    catch (err) {
        return failure(res, err.message);
    }

});

// ======================================================
// PENDING OWNERS (approval requests)
// ======================================================

router.get("/owners/pending", async (req, res) => {

    try {

        const owners = await User.find({
            role: "owner",
            accountStatus: "PENDING"
        })
        .select("-password")
        .sort({ createdAt: -1 });

        return success(res, {
            total: owners.length,
            owners
        });

    }

    catch (err) {
        return failure(res, err.message);
    }

});

// ======================================================
// CHANGE USER ROLE
// ======================================================

router.patch("/users/:id/role", async (req, res) => {

    try {

        const { role } = req.body;

        if (!["student", "owner", "admin"].includes(role)) {

            return failure(res, "Invalid role", 400);

        }

        const user = await User.findById(req.params.id);

        if (!user) {

            return failure(res, "User not found", 404);

        }

        user.role = role;

        await user.save();

        return success(res, {

            message: "Role updated",

            user

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// RESET USER PROFILE
// ======================================================

router.patch("/users/:id/reset-profile", async (req, res) => {

    try {

        const user = await User.findById(req.params.id);

        if (!user) {

            return failure(res, "User not found", 404);

        }

        user.bio = "";
        user.profileImage = "";
        user.avatar = "";

        await user.save();

        return success(res, {

            message: "Profile reset successfully",

            user

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// USER COUNTS BY ROLE
// ======================================================

router.get("/users/counts", async (req, res) => {

    try {

        const counts = await User.aggregate([

            {

                $group: {

                    _id: "$role",

                    total: {

                        $sum: 1

                    }

                }

            }

        ]);

        return success(res, {

            counts

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// PART 3 STARTS BELOW
// PROPERTY MANAGEMENT
// ======================================================
// ======================================================
// ADMIN PROPERTY MANAGEMENT
// PART 3A
// ======================================================

// ======================================================
// GET ALL PROPERTIES
// ======================================================

router.get("/properties", async (req, res) => {

    try {

        const {

            page = 1,
            limit = 20,
            status,
            city,
            state,
            search

        } = req.query;

        const filter = {};

        if (status)
            filter.status = status;

        if (city)
            filter.city = city;

        if (state)
            filter.state = state;

        if (search) {

            filter.$or = [

                {
                    propertyName: {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    city: {
                        $regex: search,
                        $options: "i"
                    }
                },

                {
                    college: {
                        $regex: search,
                        $options: "i"
                    }
                }

            ];

        }

        const total = await Property.countDocuments(filter);

        const properties = await Property.find(filter)

            .populate("owner", "name email phone")

            .sort({

                createdAt: -1

            })

            .skip((page - 1) * Number(limit))

            .limit(Number(limit));

        return success(res, {

            total,

            currentPage: Number(page),

            totalPages: Math.ceil(total / Number(limit)),

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// PROPERTY DETAILS
// ======================================================

router.get("/properties/:id", async (req, res, next) => {

    try {

        if (!validId(req.params.id)) {

            // Not a valid ObjectId — let a static route (e.g. /properties/occupancy) handle it
            return next();

        }

        const property = await Property.findById(

            req.params.id

        )

        .populate(

            "owner",

            "name email phone"

        );

        if (!property) {

            return failure(

                res,

                "Property not found",

                404

            );

        }

        return success(res, {

            property

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// APPROVE PROPERTY
// ======================================================

router.patch("/properties/:id/approve", async (req, res) => {

    try {

        const property = await Property.findById(

            req.params.id

        );

        if (!property) {

            return failure(

                res,

                "Property not found",

                404

            );

        }

        property.status = "approved";

        property.published = true;

        property.verified = true;

        await property.save();

        return success(res, {

            message: "Property approved",

            property

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// REJECT PROPERTY
// ======================================================

router.patch("/properties/:id/reject", async (req, res) => {

    try {

        const property = await Property.findById(

            req.params.id

        );

        if (!property) {

            return failure(

                res,

                "Property not found",

                404

            );

        }

        property.status = "rejected";

        property.published = false;

        await property.save();

        return success(res, {

            message: "Property rejected",

            property

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// FEATURE PROPERTY
// ======================================================

router.patch("/properties/:id/feature", async (req, res) => {

    try {

        const property = await Property.findById(

            req.params.id

        );

        if (!property) {

            return failure(

                res,

                "Property not found",

                404

            );

        }

        property.featured = true;

        await property.save();

        return success(res, {

            message: "Property featured",

            property

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// REMOVE FEATURED
// ======================================================

router.patch("/properties/:id/unfeature", async (req, res) => {

    try {

        const property = await Property.findById(

            req.params.id

        );

        if (!property) {

            return failure(

                res,

                "Property not found",

                404

            );

        }

        property.featured = false;

        await property.save();

        return success(res, {

            message: "Featured removed",

            property

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// DELETE PROPERTY
// ======================================================

router.delete("/properties/:id", async (req, res) => {

    try {

        const property = await Property.findById(

            req.params.id

        );

        if (!property) {

            return failure(

                res,

                "Property not found",

                404

            );

        }

        await property.deleteOne();

        return success(res, {

            message: "Property deleted successfully"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// BLACKLIST PROPERTY
// ======================================================

router.patch("/properties/:id/blacklist", async (req, res) => {

    try {

        const property = await Property.findById(req.params.id);

        if (!property) {
            return failure(res, "Property not found", 404);
        }

        property.blacklisted = true;
        property.published = false;
        await property.save();

        return success(res, {
            message: "Property blacklisted",
            property
        });

    }

    catch (err) {
        return failure(res, err.message);
    }

});

// ======================================================
// RESTORE / UNBLACKLIST PROPERTY
// ======================================================

router.patch("/properties/:id/restore", async (req, res) => {

    try {

        const property = await Property.findById(req.params.id);

        if (!property) {
            return failure(res, "Property not found", 404);
        }

        property.blacklisted = false;
        await property.save();

        return success(res, {
            message: "Property restored",
            property
        });

    }

    catch (err) {
        return failure(res, err.message);
    }

});

// ======================================================
// PART 3B STARTS BELOW
// ======================================================
// ======================================================
// ADMIN PROPERTY MANAGEMENT
// PART 3B
// ======================================================


// ======================================================
// PENDING PROPERTIES
// ======================================================

router.get("/properties/pending/list", async (req, res) => {

    try {

        const properties = await Property.find({

            status: "pending"

        })

        .populate("owner", "name email phone")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: properties.length,

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// APPROVED PROPERTIES
// ======================================================

router.get("/properties/approved/list", async (req, res) => {

    try {

        const properties = await Property.find({

            status: "approved"

        })

        .populate("owner", "name email")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: properties.length,

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// REJECTED PROPERTIES
// ======================================================

router.get("/properties/rejected/list", async (req, res) => {

    try {

        const properties = await Property.find({

            status: "rejected"

        })

        .populate("owner", "name email")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: properties.length,

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// FEATURED PROPERTIES
// ======================================================

router.get("/properties/featured/list", async (req, res) => {

    try {

        const properties = await Property.find({

            featured: true

        })

        .populate("owner", "name")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: properties.length,

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// RECENT PROPERTIES
// ======================================================

router.get("/properties/recent", async (req, res) => {

    try {

        const properties = await Property.find()

        .populate("owner", "name")

        .sort({

            createdAt: -1

        })

        .limit(10);

        return success(res, {

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MOST VIEWED
// ======================================================

router.get("/properties/most-viewed", async (req, res) => {

    try {

        const properties = await Property.find()

        .populate("owner", "name")

        .sort({

            views: -1

        })

        .limit(10);

        return success(res, {

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// PROPERTY STATISTICS
// ======================================================

router.get("/properties/statistics", async (req, res) => {

    try {

        const [

            total,

            approved,

            pending,

            rejected,

            featured,

            available

        ] = await Promise.all([

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

            Property.countDocuments({

                featured: true

            }),

            Property.countDocuments({

                available: true

            })

        ]);

        return success(res, {

            statistics: {

                total,

                approved,

                pending,

                rejected,

                featured,

                available

            }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// PROPERTY ANALYTICS
// ======================================================

router.get("/properties/analytics", async (req, res) => {

    try {

        const analytics = await Property.aggregate([

            {

                $group: {

                    _id: null,

                    averageRent: {

                        $avg: "$rent"

                    },

                    highestRent: {

                        $max: "$rent"

                    },

                    lowestRent: {

                        $min: "$rent"

                    },

                    totalViews: {

                        $sum: "$views"

                    },

                    totalBeds: {

                        $sum: "$totalBeds"

                    },

                    availableBeds: {

                        $sum: "$availableBeds"

                    }

                }

            }

        ]);

        return success(res, {

            analytics:

                analytics.length

                ? analytics[0]

                : {}

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// OCCUPANCY REPORT
// ======================================================

router.get("/properties/occupancy", async (req, res) => {

    try {

        const properties = await Property.find({

            status: "approved"

        });

        const report = properties.map(property => ({

            id: property._id,

            propertyName: property.propertyName,

            city: property.city,

            totalBeds: property.totalBeds,

            availableBeds: property.availableBeds,

            occupiedBeds:

                property.totalBeds -

                property.availableBeds

        }));

        return success(res, {

            report

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// END PROPERTY MODULE
// PART 4 STARTS BELOW
// ======================================================
// ======================================================
// ADMIN BOOKING MANAGEMENT
// PART 4A
// ======================================================

// ======================================================
// GET ALL BOOKINGS
// ======================================================

router.get("/bookings", async (req, res) => {

    try {

        const {
            page = 1,
            limit = 20,
            status,
            paymentStatus
        } = req.query;

        const filter = {};

        if (status)
            filter.bookingStatus = status;

        if (paymentStatus)
            filter.paymentStatus = paymentStatus;

        const total = await Booking.countDocuments(filter);

        const bookings = await Booking.find(filter)

            .populate("userId", "name email phone")

            .populate("ownerId", "name email")

            .populate("propertyId")

            .sort({
                createdAt: -1
            })

            .skip((page - 1) * Number(limit))

            .limit(Number(limit));

        return success(res, {

            total,

            currentPage: Number(page),

            totalPages: Math.ceil(total / Number(limit)),

            bookings

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// SINGLE BOOKING
// ======================================================

router.get("/bookings/:id", async (req, res) => {

    try {

        if (!validId(req.params.id)) {

            return failure(res, "Invalid Booking ID", 400);

        }

        const booking = await Booking.findById(req.params.id)

            .populate("userId", "name email phone")

            .populate("ownerId", "name email phone")

            .populate("propertyId");

        if (!booking) {

            return failure(res, "Booking not found", 404);

        }

        return success(res, {

            booking

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// CONFIRM BOOKING
// ======================================================

router.patch("/bookings/:id/confirm", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking)
            return failure(res, "Booking not found", 404);

        booking.bookingStatus = "confirmed";

        await booking.save();

        return success(res, {

            message: "Booking confirmed",

            booking

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// CANCEL BOOKING
// ======================================================

router.patch("/bookings/:id/cancel", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking)
            return failure(res, "Booking not found", 404);

        booking.bookingStatus = "cancelled";

        booking.cancelReason = req.body.reason || "";

        await booking.save();

        return success(res, {

            message: "Booking cancelled",

            booking

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// CHECK IN
// ======================================================

router.patch("/bookings/:id/checkin", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking)
            return failure(res, "Booking not found", 404);

        booking.bookingStatus = "checked-in";

        await booking.save();

        return success(res, {

            message: "Student checked in",

            booking

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// CHECK OUT
// ======================================================

router.patch("/bookings/:id/checkout", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking)
            return failure(res, "Booking not found", 404);

        booking.bookingStatus = "checked-out";

        await booking.save();

        return success(res, {

            message: "Student checked out",

            booking

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// PAYMENT RECEIVED
// ======================================================

router.patch("/bookings/:id/payment", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking)
            return failure(res, "Booking not found", 404);

        booking.paymentStatus = "paid";

        await booking.save();

        return success(res, {

            message: "Payment marked as received",

            booking

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// DELETE BOOKING
// ======================================================

router.delete("/bookings/:id", async (req, res) => {

    try {

        const booking = await Booking.findById(req.params.id);

        if (!booking)
            return failure(res, "Booking not found", 404);

        await booking.deleteOne();

        return success(res, {

            message: "Booking deleted successfully"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});

// ======================================================
// PART 4B STARTS BELOW
// ======================================================
// ======================================================
// ADMIN BOOKING MANAGEMENT
// PART 4B
// ======================================================


// ======================================================
// BOOKING STATISTICS
// ======================================================

router.get("/bookings/statistics", async (req, res) => {

    try {

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

            Booking.countDocuments(),

            Booking.countDocuments({

                bookingStatus: "pending"

            }),

            Booking.countDocuments({

                bookingStatus: "confirmed"

            }),

            Booking.countDocuments({

                bookingStatus: "checked-in"

            }),

            Booking.countDocuments({

                bookingStatus: "checked-out"

            }),

            Booking.countDocuments({

                bookingStatus: "cancelled"

            }),

            Booking.countDocuments({

                paymentStatus: "paid"

            }),

            Booking.countDocuments({

                paymentStatus: {
                    $ne: "paid"
                }

            })

        ]);

        return success(res, {

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

        return failure(res, err.message);

    }

});


// ======================================================
// RECENT BOOKINGS
// ======================================================

router.get("/bookings/recent", async (req, res) => {

    try {

        const bookings = await Booking.find()

            .populate("userId", "name")

            .populate("ownerId", "name")

            .populate("propertyId", "propertyName")

            .sort({

                createdAt: -1

            })

            .limit(10);

        return success(res, {

            bookings

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// PENDING PAYMENTS
// ======================================================

router.get("/bookings/pending-payments", async (req, res) => {

    try {

        const bookings = await Booking.find({

            paymentStatus: {

                $ne: "paid"

            }

        })

        .populate("userId", "name")

        .populate("propertyId", "propertyName")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: bookings.length,

            bookings

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MONTHLY BOOKINGS
// ======================================================

router.get("/bookings/monthly-report", async (req, res) => {

    try {

        const report = await Booking.aggregate([

            {

                $group: {

                    _id: {

                        year: {

                            $year: "$createdAt"

                        },

                        month: {

                            $month: "$createdAt"

                        }

                    },

                    totalBookings: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    "_id.year": 1,

                    "_id.month": 1

                }

            }

        ]);

        return success(res, {

            report

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// REVENUE REPORT
// ======================================================

router.get("/bookings/revenue", async (req, res) => {

    try {

        const revenue = await Booking.aggregate([

            {

                $match: {

                    paymentStatus: "paid"

                }

            },

            {

                $group: {

                    _id: null,

                    totalRevenue: {

                        $sum: "$price"

                    },

                    averageBooking: {

                        $avg: "$price"

                    },

                    highestBooking: {

                        $max: "$price"

                    },

                    lowestBooking: {

                        $min: "$price"

                    }

                }

            }

        ]);

        return success(res, {

            revenue:

                revenue.length

                ? revenue[0]

                : {}

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SEARCH BOOKINGS
// ======================================================

router.get("/bookings/search/:keyword", async (req, res) => {

    try {

        const keyword = req.params.keyword;

        const bookings = await Booking.find({

            $or: [

                {

                    bookingStatus: {

                        $regex: keyword,

                        $options: "i"

                    }

                },

                {

                    paymentStatus: {

                        $regex: keyword,

                        $options: "i"

                    }

                }

            ]

        })

        .populate("userId", "name")

        .populate("ownerId", "name")

        .populate("propertyId", "propertyName")

        .limit(50);

        return success(res, {

            total: bookings.length,

            bookings

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// BOOKING DASHBOARD REPORT
// ======================================================

router.get("/bookings/dashboard", async (req, res) => {

    try {

        const [

            bookings,

            paidBookings,

            pendingBookings

        ] = await Promise.all([

            Booking.countDocuments(),

            Booking.countDocuments({

                paymentStatus: "paid"

            }),

            Booking.countDocuments({

                bookingStatus: "pending"

            })

        ]);

        return success(res, {

            dashboard: {

                bookings,

                paidBookings,

                pendingBookings

            }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// END BOOKING MODULE
// PART 5 STARTS BELOW
// ======================================================
// ======================================================
// ADMIN PAYMENT MANAGEMENT
// PART 5A
// ======================================================


// ======================================================
// GET ALL PAYMENTS
// ======================================================

router.get("/payments", async (req, res) => {

    try {

        const {

            page = 1,
            limit = 20,
            status

        } = req.query;

        const filter = {};

        if (status) {

            filter.paymentStatus = status;

        }

        const total = await Booking.countDocuments(filter);

        const payments = await Booking.find(filter)

            .populate("userId", "name email phone")

            .populate("ownerId", "name email")

            .populate("propertyId", "propertyName rent")

            .sort({

                createdAt: -1

            })

            .skip((page - 1) * Number(limit))

            .limit(Number(limit));

        return success(res, {

            total,

            currentPage: Number(page),

            totalPages: Math.ceil(total / Number(limit)),

            payments

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SINGLE PAYMENT
// ======================================================

router.get("/payments/:id", async (req, res, next) => {

    try {

        if (!validId(req.params.id)) {

            // Not a valid ObjectId — let a static route (e.g. /payments/revenue) handle it
            return next();

        }

        const payment = await Booking.findById(req.params.id)

            .populate("userId", "name email phone")

            .populate("ownerId", "name email")

            .populate("propertyId");

        if (!payment) {

            return failure(

                res,

                "Payment not found",

                404

            );

        }

        return success(res, {

            payment

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MARK PAYMENT PAID
// ======================================================

router.patch("/payments/:id/paid", async (req, res) => {

    try {

        const payment = await Booking.findById(req.params.id);

        if (!payment) {

            return failure(

                res,

                "Payment not found",

                404

            );

        }

        payment.paymentStatus = "paid";

        payment.paymentDate = new Date();

        await payment.save();

        return success(res, {

            message: "Payment marked as paid",

            payment

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MARK PAYMENT FAILED
// ======================================================

router.patch("/payments/:id/failed", async (req, res) => {

    try {

        const payment = await Booking.findById(req.params.id);

        if (!payment) {

            return failure(

                res,

                "Payment not found",

                404

            );

        }

        payment.paymentStatus = "failed";

        await payment.save();

        return success(res, {

            message: "Payment marked as failed",

            payment

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// REFUND PAYMENT
// ======================================================

router.patch("/payments/:id/refund", async (req, res) => {

    try {

        const payment = await Booking.findById(req.params.id);

        if (!payment) {

            return failure(

                res,

                "Payment not found",

                404

            );

        }

        payment.paymentStatus = "refunded";

        await payment.save();

        return success(res, {

            message: "Payment refunded",

            payment

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});
// ======================================================
// ADMIN PAYMENT MANAGEMENT
// PART 5B
// ======================================================


// ======================================================
// PAYMENT STATISTICS
// ======================================================

router.get("/payments/statistics", async (req, res) => {

    try {

        const [

            total,

            paid,

            pending,

            failed,

            refunded

        ] = await Promise.all([

            Booking.countDocuments(),

            Booking.countDocuments({
                paymentStatus: "paid"
            }),

            Booking.countDocuments({
                paymentStatus: "pending"
            }),

            Booking.countDocuments({
                paymentStatus: "failed"
            }),

            Booking.countDocuments({
                paymentStatus: "refunded"
            })

        ]);

        return success(res, {

            statistics: {

                total,
                paid,
                pending,
                failed,
                refunded

            }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// TOTAL REVENUE
// ======================================================

router.get("/payments/revenue", async (req, res) => {

    try {

        const revenue = await Booking.aggregate([

            {

                $match: {

                    paymentStatus: "paid"

                }

            },

            {

                $group: {

                    _id: null,

                    totalRevenue: {

                        $sum: "$price"

                    },

                    averageRevenue: {

                        $avg: "$price"

                    },

                    highestPayment: {

                        $max: "$price"

                    },

                    lowestPayment: {

                        $min: "$price"

                    }

                }

            }

        ]);

        return success(res, {

            revenue: revenue.length

                ? revenue[0]

                : {}

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MONTHLY REVENUE
// ======================================================

router.get("/payments/monthly", async (req, res) => {

    try {

        const report = await Booking.aggregate([

            {

                $match: {

                    paymentStatus: "paid"

                }

            },

            {

                $group: {

                    _id: {

                        year: {

                            $year: "$createdAt"

                        },

                        month: {

                            $month: "$createdAt"

                        }

                    },

                    revenue: {

                        $sum: "$price"

                    },

                    bookings: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    "_id.year": 1,

                    "_id.month": 1

                }

            }

        ]);

        return success(res, {

            report

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// TOP PAYING STUDENTS
// ======================================================

router.get("/payments/top-students", async (req, res) => {

    try {

        const report = await Booking.aggregate([

            {

                $match: {

                    paymentStatus: "paid"

                }

            },

            {

                $group: {

                    _id: "$userId",

                    totalSpent: {

                        $sum: "$price"

                    },

                    bookings: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    totalSpent: -1

                }

            },

            {

                $limit: 10

            }

        ]);

        await User.populate(report, {

            path: "_id",

            select: "name email phone"

        });

        return success(res, {

            students: report

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// HIGHEST REVENUE PROPERTIES
// ======================================================

router.get("/payments/top-properties", async (req, res) => {

    try {

        const report = await Booking.aggregate([

            {

                $match: {

                    paymentStatus: "paid"

                }

            },

            {

                $group: {

                    _id: "$propertyId",

                    revenue: {

                        $sum: "$price"

                    },

                    bookings: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    revenue: -1

                }

            },

            {

                $limit: 10

            }

        ]);

        await Property.populate(report, {

            path: "_id",

            select: "propertyName city state rent"

        });

        return success(res, {

            properties: report

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// RECENT PAYMENTS
// ======================================================

router.get("/payments/recent", async (req, res) => {

    try {

        const payments = await Booking.find({

            paymentStatus: "paid"

        })

        .populate("userId", "name")

        .populate("propertyId", "propertyName")

        .sort({

            paymentDate: -1,

            createdAt: -1

        })

        .limit(20);

        return success(res, {

            payments

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// END PAYMENT MODULE
// PART 6 STARTS BELOW
// ======================================================
// ======================================================
// ADMIN NOTIFICATION MANAGEMENT
// PART 6A
// ======================================================

// ======================================================
// GET ALL NOTIFICATIONS
// ======================================================

router.get("/notifications", async (req, res) => {

    try {

        const notifications = await Notification.find()

            .sort({ createdAt: -1 })

            .populate("receiverId", "name email role");

        return success(res, {

            total: notifications.length,

            notifications

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SEND TO SINGLE USER
// ======================================================

router.post("/notifications/user/:id", async (req, res) => {

    try {

        const user = await User.findById(req.params.id);

        if (!user) {

            return failure(res, "User not found", 404);

        }

        const notification = await Notification.create({

            receiverId: user._id,

            title: req.body.title,

            message: req.body.message,

            type: req.body.type || "general"

        });

        return success(res, {

            message: "Notification sent",

            notification

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SEND TO ALL STUDENTS
// ======================================================

router.post("/notifications/students", async (req, res) => {

    try {

        const students = await User.find({

            role: "student"

        });

        const notifications = [];

        for (const student of students) {

            notifications.push({

                receiverId: student._id,

                title: req.body.title,

                message: req.body.message,

                type: req.body.type || "general"

            });

        }

        await Notification.insertMany(notifications);

        return success(res, {

            message: "Notification sent to all students",

            total: notifications.length

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SEND TO ALL OWNERS
// ======================================================

router.post("/notifications/owners", async (req, res) => {

    try {

        const owners = await User.find({

            role: "owner"

        });

        const notifications = [];

        for (const owner of owners) {

            notifications.push({

                receiverId: owner._id,

                title: req.body.title,

                message: req.body.message,

                type: req.body.type || "general"

            });

        }

        await Notification.insertMany(notifications);

        return success(res, {

            message: "Notification sent to all owners",

            total: notifications.length

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});
// ======================================================
// ADMIN NOTIFICATION MANAGEMENT
// PART 6B
// ======================================================


// ======================================================
// SEND TO ALL USERS
// ======================================================

router.post("/notifications/all", async (req, res) => {

    try {

        const users = await User.find({}, "_id");

        const notifications = users.map(user => ({

            receiverId: user._id,

            title: req.body.title,

            message: req.body.message,

            type: req.body.type || "general"

        }));

        await Notification.insertMany(notifications);

        return success(res, {

            message: "Notification sent to all users",

            total: notifications.length

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MARK AS READ
// ======================================================

router.patch("/notifications/:id/read", async (req, res) => {

    try {

        const notification = await Notification.findById(req.params.id);

        if (!notification) {

            return failure(res, "Notification not found", 404);

        }

        notification.isRead = true;

        await notification.save();

        return success(res, {

            message: "Notification marked as read",

            notification

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MARK AS UNREAD
// ======================================================

router.patch("/notifications/:id/unread", async (req, res) => {

    try {

        const notification = await Notification.findById(req.params.id);

        if (!notification) {

            return failure(res, "Notification not found", 404);

        }

        notification.isRead = false;

        await notification.save();

        return success(res, {

            message: "Notification marked as unread",

            notification

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// DELETE NOTIFICATION
// ======================================================

router.delete("/notifications/:id", async (req, res) => {

    try {

        const notification = await Notification.findById(req.params.id);

        if (!notification) {

            return failure(res, "Notification not found", 404);

        }

        await notification.deleteOne();

        return success(res, {

            message: "Notification deleted successfully"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// NOTIFICATION STATISTICS
// ======================================================

router.get("/notifications/statistics", async (req, res) => {

    try {

        const [

            total,

            read,

            unread

        ] = await Promise.all([

            Notification.countDocuments(),

            Notification.countDocuments({

                isRead: true

            }),

            Notification.countDocuments({

                isRead: false

            })

        ]);

        return success(res, {

            statistics: {

                total,

                read,

                unread

            }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// RECENT NOTIFICATIONS
// ======================================================

router.get("/notifications/recent", async (req, res) => {

    try {

        const notifications = await Notification.find()

            .populate("receiverId", "name email role")

            .sort({

                createdAt: -1

            })

            .limit(20);

        return success(res, {

            notifications

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SEARCH NOTIFICATIONS
// ======================================================

router.get("/notifications/search/:keyword", async (req, res) => {

    try {

        const keyword = req.params.keyword;

        const notifications = await Notification.find({

            $or: [

                {

                    title: {

                        $regex: keyword,

                        $options: "i"

                    }

                },

                {

                    message: {

                        $regex: keyword,

                        $options: "i"

                    }

                },

                {

                    type: {

                        $regex: keyword,

                        $options: "i"

                    }

                }

            ]

        })

        .populate("receiverId", "name email")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: notifications.length,

            notifications

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// CLEAR ALL NOTIFICATIONS
// ======================================================

router.delete("/notifications", async (req, res) => {

    try {

        await Notification.deleteMany({});

        return success(res, {

            message: "All notifications deleted"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// END NOTIFICATION MODULE
// PART 7 STARTS BELOW
// ======================================================
// ======================================================
// ADMIN REVIEW MANAGEMENT
// PART 7A
// ======================================================


// ======================================================
// GET ALL REVIEWS
// ======================================================

router.get("/reviews", async (req,res)=>{

    try{

        const reviews = await Review.find()

        .populate("user","name email")

        .populate("property","propertyName city")

        .sort({

            createdAt:-1

        });

        return success(res,{

            total:reviews.length,

            reviews

        });

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// SINGLE REVIEW
// ======================================================

router.get("/reviews/:id",async(req,res)=>{

    try{

        const review=await Review.findById(req.params.id)

        .populate("user","name email")

        .populate("property");

        if(!review){

            return failure(

                res,

                "Review not found",

                404

            );

        }

        return success(res,{review});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// APPROVE REVIEW
// ======================================================

router.patch("/reviews/:id/approve",async(req,res)=>{

    try{

        const review=await Review.findById(req.params.id);

        if(!review){

            return failure(res,"Review not found",404);

        }

        review.status="approved";

        await review.save();

        return success(res,{

            message:"Review approved",

            review

        });

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// HIDE REVIEW
// ======================================================

router.patch("/reviews/:id/hide",async(req,res)=>{

    try{

        const review=await Review.findById(req.params.id);

        if(!review){

            return failure(res,"Review not found",404);

        }

        review.status="hidden";

        await review.save();

        return success(res,{

            message:"Review hidden",

            review

        });

    }

    catch(err){

        return failure(res,err.message);

    }

});
// ======================================================
// ADMIN REVIEW MANAGEMENT
// PART 7B
// ======================================================


// ======================================================
// DELETE REVIEW
// ======================================================

router.delete("/reviews/:id", async (req, res) => {

    try {

        const review = await Review.findById(req.params.id);

        if (!review) {

            return failure(res, "Review not found", 404);

        }

        await review.deleteOne();

        return success(res, {

            message: "Review deleted successfully"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// REPORT REVIEW
// ======================================================

router.patch("/reviews/:id/report", async (req, res) => {

    try {

        const review = await Review.findById(req.params.id);

        if (!review) {

            return failure(res, "Review not found", 404);

        }

        review.reported = true;

        await review.save();

        return success(res, {

            message: "Review marked as reported",

            review

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// REVIEW STATISTICS
// ======================================================

router.get("/reviews/statistics", async (req, res) => {

    try {

        const [

            total,

            approved,

            hidden,

            reported

        ] = await Promise.all([

            Review.countDocuments(),

            Review.countDocuments({

                status: "approved"

            }),

            Review.countDocuments({

                status: "hidden"

            }),

            Review.countDocuments({

                reported: true

            })

        ]);

        return success(res, {

            statistics: {

                total,

                approved,

                hidden,

                reported

            }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// AVERAGE RATING
// ======================================================

router.get("/reviews/average-rating", async (req, res) => {

    try {

        const result = await Review.aggregate([

            {

                $group: {

                    _id: null,

                    averageRating: {

                        $avg: "$rating"

                    },

                    totalReviews: {

                        $sum: 1

                    }

                }

            }

        ]);

        return success(res, {

            rating: result.length

                ? result[0]

                : {

                    averageRating: 0,

                    totalReviews: 0

                }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// TOP RATED PROPERTIES
// ======================================================

router.get("/reviews/top-properties", async (req, res) => {

    try {

        const properties = await Review.aggregate([

            {

                $group: {

                    _id: "$property",

                    averageRating: {

                        $avg: "$rating"

                    },

                    reviews: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    averageRating: -1

                }

            },

            {

                $limit: 10

            }

        ]);

        await Property.populate(properties, {

            path: "_id",

            select: "propertyName city state"

        });

        return success(res, {

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// LOWEST RATED PROPERTIES
// ======================================================

router.get("/reviews/lowest-properties", async (req, res) => {

    try {

        const properties = await Review.aggregate([

            {

                $group: {

                    _id: "$property",

                    averageRating: {

                        $avg: "$rating"

                    },

                    reviews: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    averageRating: 1

                }

            },

            {

                $limit: 10

            }

        ]);

        await Property.populate(properties, {

            path: "_id",

            select: "propertyName city state"

        });

        return success(res, {

            properties

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SEARCH REVIEWS
// ======================================================

router.get("/reviews/search/:keyword", async (req, res) => {

    try {

        const keyword = req.params.keyword;

        const reviews = await Review.find({

            comment: {

                $regex: keyword,

                $options: "i"

            }

        })

        .populate("user", "name")

        .populate("property", "propertyName")

        .sort({

            createdAt: -1

        });

        return success(res, {

            total: reviews.length,

            reviews

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// RECENT REVIEWS
// ======================================================

router.get("/reviews/recent", async (req, res) => {

    try {

        const reviews = await Review.find()

        .populate("user", "name")

        .populate("property", "propertyName")

        .sort({

            createdAt: -1

        })

        .limit(20);

        return success(res, {

            reviews

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// END REVIEW MODULE
// PART 8 STARTS BELOW
// ======================================================
// ======================================================
// ADMIN REPORTS & ANALYTICS
// PART 8A
// ======================================================


// ======================================================
// PLATFORM OVERVIEW
// ======================================================

router.get("/reports/overview", async (req, res) => {

    try {

        const [

            users,

            students,

            owners,

            properties,

            approvedProperties,

            pendingProperties,

            bookings,

            reviews

        ] = await Promise.all([

            User.countDocuments(),

            User.countDocuments({ role: "student" }),

            User.countDocuments({ role: "owner" }),

            Property.countDocuments(),

            Property.countDocuments({ status: "approved" }),

            Property.countDocuments({ status: "pending" }),

            Booking.countDocuments(),

            Review.countDocuments()

        ]);

        return success(res, {

            overview: {

                users,

                students,

                owners,

                properties,

                approvedProperties,

                pendingProperties,

                bookings,

                reviews

            }

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// USER GROWTH
// ======================================================

router.get("/reports/user-growth", async (req, res) => {

    try {

        const growth = await User.aggregate([

            {

                $group: {

                    _id: {

                        year: { $year: "$createdAt" },

                        month: { $month: "$createdAt" }

                    },

                    total: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    "_id.year": 1,

                    "_id.month": 1

                }

            }

        ]);

        return success(res, {

            growth

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// PROPERTY GROWTH
// ======================================================

router.get("/reports/property-growth", async (req, res) => {

    try {

        const growth = await Property.aggregate([

            {

                $group: {

                    _id: {

                        year: { $year: "$createdAt" },

                        month: { $month: "$createdAt" }

                    },

                    total: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    "_id.year": 1,

                    "_id.month": 1

                }

            }

        ]);

        return success(res, {

            growth

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// BOOKING GROWTH
// ======================================================

router.get("/reports/booking-growth", async (req, res) => {

    try {

        const growth = await Booking.aggregate([

            {

                $group: {

                    _id: {

                        year: { $year: "$createdAt" },

                        month: { $month: "$createdAt" }

                    },

                    bookings: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    "_id.year": 1,

                    "_id.month": 1

                }

            }

        ]);

        return success(res, {

            growth

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// REVIEW GROWTH
// ======================================================

router.get("/reports/review-growth", async (req, res) => {

    try {

        const growth = await Review.aggregate([

            {

                $group: {

                    _id: {

                        year: { $year: "$createdAt" },

                        month: { $month: "$createdAt" }

                    },

                    reviews: {

                        $sum: 1

                    }

                }

            },

            {

                $sort: {

                    "_id.year": 1,

                    "_id.month": 1

                }

            }

        ]);

        return success(res, {

            growth

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});
// ======================================================
// ADMIN ADVANCED ANALYTICS
// PART 8B
// ======================================================


// ======================================================
// REVENUE GROWTH
// ======================================================

router.get("/reports/revenue-growth", async (req, res) => {

    try {

        const revenue = await Booking.aggregate([

            {
                $match: {
                    paymentStatus: "paid"
                }
            },

            {
                $group: {

                    _id: {

                        year: {
                            $year: "$createdAt"
                        },

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

                    "_id.year": 1,

                    "_id.month": 1

                }

            }

        ]);

        return success(res,{ revenue });

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// OCCUPANCY ANALYTICS
// ======================================================

router.get("/reports/occupancy", async(req,res)=>{

    try{

        const properties=await Property.find();

        let totalBeds=0;

        let availableBeds=0;

        properties.forEach(property=>{

            totalBeds+=property.totalBeds||0;

            availableBeds+=property.availableBeds||0;

        });

        const occupiedBeds=totalBeds-availableBeds;

        const occupancyRate=

        totalBeds===0

        ?0

        :Number(

            (

                occupiedBeds

                /

                totalBeds

            )

            *

            100

        ).toFixed(2);

        return success(res,{

            totalBeds,

            availableBeds,

            occupiedBeds,

            occupancyRate

        });

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// CITY ANALYTICS
// ======================================================

router.get("/reports/cities",async(req,res)=>{

    try{

        const cities=await Property.aggregate([

            {

                $group:{

                    _id:"$city",

                    totalProperties:{

                        $sum:1

                    }

                }

            },

            {

                $sort:{

                    totalProperties:-1

                }

            }

        ]);

        return success(res,{cities});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// STATE ANALYTICS
// ======================================================

router.get("/reports/states",async(req,res)=>{

    try{

        const states=await Property.aggregate([

            {

                $group:{

                    _id:"$state",

                    totalProperties:{

                        $sum:1

                    }

                }

            },

            {

                $sort:{

                    totalProperties:-1

                }

            }

        ]);

        return success(res,{states});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// MOST POPULAR COLLEGES
// ======================================================

router.get("/reports/colleges",async(req,res)=>{

    try{

        const colleges=await Property.aggregate([

            {

                $match:{

                    college:{

                        $ne:""

                    }

                }

            },

            {

                $group:{

                    _id:"$college",

                    totalProperties:{

                        $sum:1

                    }

                }

            },

            {

                $sort:{

                    totalProperties:-1

                }

            }

        ]);

        return success(res,{colleges});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// TOP PROPERTY OWNERS
// ======================================================

router.get("/reports/top-owners",async(req,res)=>{

    try{

        const owners=await Property.aggregate([

            {

                $group:{

                    _id:"$owner",

                    totalProperties:{

                        $sum:1

                    }

                }

            },

            {

                $sort:{

                    totalProperties:-1

                }

            },

            {

                $limit:10

            }

        ]);

        await User.populate(owners,{

            path:"_id",

            select:"name email"

        });

        return success(res,{owners});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// MOST VIEWED PROPERTIES
// ======================================================

router.get("/reports/most-viewed",async(req,res)=>{

    try{

        const properties=await Property.find()

        .sort({

            views:-1

        })

        .limit(10)

        .populate("owner","name");

        return success(res,{properties});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// HIGHEST RATED PROPERTIES
// ======================================================

router.get("/reports/top-rated",async(req,res)=>{

    try{

        const properties=await Property.find()

        .sort({

            averageRating:-1

        })

        .limit(10)

        .populate("owner","name");

        return success(res,{properties});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// COMPLETE DASHBOARD SUMMARY
// ======================================================

router.get("/dashboard-summary",async(req,res)=>{

    try{

        const [

            users,

            owners,

            students,

            properties,

            bookings,

            reviews

        ]=await Promise.all([

            User.countDocuments(),

            User.countDocuments({

                role:"owner"

            }),

            User.countDocuments({

                role:"student"

            }),

            Property.countDocuments(),

            Booking.countDocuments(),

            Review.countDocuments()

        ]);

        const revenue=await Booking.aggregate([

            {

                $match:{

                    paymentStatus:"paid"

                }

            },

            {

                $group:{

                    _id:null,

                    total:{

                        $sum:"$price"

                    }

                }

            }

        ]);

        return success(res,{

            dashboard:{

                users,

                students,

                owners,

                properties,

                bookings,

                reviews,

                revenue:

                revenue.length

                ?

                revenue[0].total

                :

                0

            }

        });

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// END ANALYTICS MODULE
// ======================================================
// ======================================================
// PLATFORM SETTINGS
// PART 9A
// ======================================================


// ======================================================
// GET SETTINGS
// ======================================================

router.get("/settings", async (req,res)=>{

    try{

        let settings=await Setting.findOne();

        if(!settings){

            settings=await Setting.create({});

        }

        return success(res,{settings});

    }

    catch(err){

        return failure(res,err.message);

    }

});


// ======================================================
// UPDATE SETTINGS
// ======================================================

router.put("/settings",async(req,res)=>{

    try{

        let settings=await Setting.findOne();

        if(!settings){

            settings=await Setting.create({});

        }

        Object.assign(settings,req.body);

        await settings.save();

        return success(res,{

            message:"Settings Updated",

            settings

        });

    }

    catch(err){

        return failure(res,err.message);

    }

});
// ======================================================
// PLATFORM SETTINGS
// PART 9B
// ======================================================


// ======================================================
// TOGGLE MAINTENANCE MODE
// ======================================================

router.patch("/settings/maintenance", async (req, res) => {

    try {

        let settings = await Setting.findOne();

        if (!settings) {

            settings = await Setting.create({});

        }

        settings.maintenanceMode = !settings.maintenanceMode;

        await settings.save();

        return success(res, {

            message: settings.maintenanceMode
                ? "Maintenance Mode Enabled"
                : "Maintenance Mode Disabled",

            maintenanceMode: settings.maintenanceMode

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// ENABLE / DISABLE REGISTRATION
// ======================================================

router.patch("/settings/registration", async (req, res) => {

    try {

        let settings = await Setting.findOne();

        if (!settings) {

            settings = await Setting.create({});

        }

        settings.allowRegistration = !settings.allowRegistration;

        await settings.save();

        return success(res, {

            message: settings.allowRegistration
                ? "Registration Enabled"
                : "Registration Disabled",

            allowRegistration: settings.allowRegistration

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// ENABLE / DISABLE PROPERTY UPLOAD
// ======================================================

router.patch("/settings/property-upload", async (req, res) => {

    try {

        let settings = await Setting.findOne();

        if (!settings) {

            settings = await Setting.create({});

        }

        settings.allowPropertyUpload = !settings.allowPropertyUpload;

        await settings.save();

        return success(res, {

            message: settings.allowPropertyUpload
                ? "Property Upload Enabled"
                : "Property Upload Disabled",

            allowPropertyUpload: settings.allowPropertyUpload

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// UPDATE COMMISSION
// ======================================================

router.patch("/settings/commission", async (req, res) => {

    try {

        let settings = await Setting.findOne();

        if (!settings) {

            settings = await Setting.create({});

        }

        settings.commissionPercentage = req.body.commissionPercentage;

        await settings.save();

        return success(res, {

            message: "Commission Updated",

            commission: settings.commissionPercentage

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// UPDATE FEATURED PROPERTY FEES
// ======================================================

router.patch("/settings/featured-fee", async (req, res) => {

    try {

        let settings = await Setting.findOne();

        if (!settings) {

            settings = await Setting.create({});

        }

        settings.featuredPropertyFee = req.body.featuredPropertyFee;

        await settings.save();

        return success(res, {

            message: "Featured Property Fee Updated",

            featuredPropertyFee: settings.featuredPropertyFee

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// UPDATE SUPPORT DETAILS
// ======================================================

router.patch("/settings/support", async (req, res) => {

    try {

        let settings = await Setting.findOne();

        if (!settings) {

            settings = await Setting.create({});

        }

        settings.supportEmail = req.body.supportEmail;

        settings.supportPhone = req.body.supportPhone;

        await settings.save();

        return success(res, {

            message: "Support Details Updated",

            settings

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// UPDATE BRANDING
// ======================================================

router.patch("/settings/branding", async (req, res) => {

    try {

        let settings = await Setting.findOne();

        if (!settings) {

            settings = await Setting.create({});

        }

        settings.siteName = req.body.siteName;

        settings.siteDescription = req.body.siteDescription;

        settings.currency = req.body.currency;

        await settings.save();

        return success(res, {

            message: "Branding Updated",

            settings

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// RESET SETTINGS
// ======================================================

router.post("/settings/reset", async (req, res) => {

    try {

        await Setting.deleteMany({});

        const settings = await Setting.create({});

        return success(res, {

            message: "Settings Reset Successfully",

            settings

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// END SETTINGS MODULE
// ======================================================
// ======================================================
// SUPER ADMIN
// PART 10A
// ======================================================


// ======================================================
// SYSTEM HEALTH
// ======================================================

router.get("/system/health", async (req, res) => {

    try {

        return success(res, {

            server: "Running",

            node: process.version,

            uptime: process.uptime(),

            memory: process.memoryUsage(),

            timestamp: new Date()

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// DATABASE STATUS
// ======================================================

router.get("/system/database", async (req, res) => {

    try {

        return success(res, {

            database: mongoose.connection.readyState,

            host: mongoose.connection.host,

            name: mongoose.connection.name

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// SERVER INFO
// ======================================================

router.get("/system/server", async (req, res) => {

    try {

        return success(res, {

            platform: process.platform,

            architecture: process.arch,

            nodeVersion: process.version,

            pid: process.pid,

            environment: process.env.NODE_ENV || "development"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// MEMORY USAGE
// ======================================================

router.get("/system/memory", async (req, res) => {

    try {

        return success(res, process.memoryUsage());

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// CPU INFO
// ======================================================

router.get("/system/cpu", async (req, res) => {

    try {

        return success(res, {

            cpus: os.cpus(),

            loadAverage: os.loadavg(),

            freeMemory: os.freemem(),

            totalMemory: os.totalmem()

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});
// ======================================================
// PLATFORM STATISTICS
// PART 10B
// ======================================================


// ======================================================
// COMPLETE PLATFORM STATS
// ======================================================

router.get("/platform/stats", async (req, res) => {

    try {

        const [

            users,

            owners,

            students,

            admins,

            properties,

            bookings,

            reviews,

            notifications

        ] = await Promise.all([

            User.countDocuments(),

            User.countDocuments({ role: "owner" }),

            User.countDocuments({ role: "student" }),

            User.countDocuments({ role: "admin" }),

            Property.countDocuments(),

            Booking.countDocuments(),

            Review.countDocuments(),

            Notification.countDocuments()

        ]);

        return success(res, {

            users,

            owners,

            students,

            admins,

            properties,

            bookings,

            reviews,

            notifications

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// RESET CACHE
// ======================================================

router.post("/system/cache/reset", async (req, res) => {

    try {

        return success(res, {

            message: "Cache reset successfully"

        });

    }

    catch (err) {

        return failure(res, err.message);

    }

});


// ======================================================
// PING
// ======================================================

router.get("/ping", (req, res) => {

    return success(res, {

        message: "PONG"

    });

});


// ======================================================
// VERSION
// ======================================================

router.get("/version", (req, res) => {

    return success(res, {

        version: "1.0.0",

        platform: "Campora"

    });

});

module.exports = router;
