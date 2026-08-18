const express = require("express");
const router = express.Router();

const Property = require("../models/Property");
const auth = require("../middleware/auth");
const upload = require("../middleware/upload");


// ==========================================
// GET ALL PROPERTIES (public: approved only)
// ==========================================

router.get("/", async (req, res) => {
    try {
        const {
            search,
            city,
            state,
            college,
            university,
            propertyType,
            gender,
            sharing,
            minRent,
            maxRent,
            minRating,
            amenities,
            sort,
            page = 1,
            limit = 20
        } = req.query;

        const filter = {
            status: "approved",
            published: true,
            available: true,
            blacklisted: { $ne: true }
        };

        if (city) filter.city = new RegExp(city.trim(), "i");
        if (state) filter.state = new RegExp(state.trim(), "i");

        const targetUni = college || university;
        if (targetUni) filter.college = new RegExp(targetUni.trim(), "i");

        if (propertyType) filter.propertyType = propertyType;
        if (gender) filter.gender = gender;
        if (sharing) filter.sharing = sharing;

        if (minRent || maxRent) {
            filter.rent = {};
            if (minRent) filter.rent.$gte = Number(minRent);
            if (maxRent) filter.rent.$lte = Number(maxRent);
        }

        if (minRating) filter.averageRating = { $gte: Number(minRating) };

        if (amenities) {
            const list = Array.isArray(amenities) ? amenities : amenities.split(",").map(s => s.trim());
            filter.amenities = { $all: list };
        }

        if (search && search.trim()) {
            const regex = new RegExp(search.trim(), "i");
            filter.$or = [
                { propertyName: regex },
                { city: regex },
                { college: regex },
                { address: regex },
                { description: regex }
            ];
        }

        let sortOption = { createdAt: -1 };
        if (sort === "rent_asc") sortOption = { rent: 1 };
        if (sort === "rent_desc") sortOption = { rent: -1 };
        if (sort === "rating") sortOption = { averageRating: -1 };
        if (sort === "popular") sortOption = { views: -1 };

        const skip = (Math.max(1, Number(page)) - 1) * Number(limit);
        const limitNum = Math.min(100, Math.max(1, Number(limit)));

        const [properties, totalCount] = await Promise.all([
            Property.find(filter)
                .populate("owner", "name email phone businessName rating")
                .sort(sortOption)
                .skip(skip)
                .limit(limitNum),
            Property.countDocuments(filter)
        ]);

        res.json({
            success: true,
            message: "Properties retrieved successfully.",
            data: {
                properties,
                total: totalCount,
                page: Number(page),
                totalPages: Math.ceil(totalCount / limitNum)
            },
            // Flat keys for backward compatibility
            total: totalCount,
            properties
        });

    } catch (err) {
        console.error("Fetch properties error:", err);
        res.status(500).json({
            success: false,
            message: err.message || "Failed to fetch properties."
        });
    }
});


async function createProperty(req, res) {
    try {

        const images = [];

        if (req.files && req.files.length > 0) {

            req.files.forEach(file => {

                // multer-storage-cloudinary sets `file.path` to the
                // Cloudinary secure_url and `file.filename` to the
                // public_id. Store the full URL so the frontend can
                // render images directly.
                images.push(file.path || file.secure_url || file.filename);

            });

        }

        const {
            propertyName,
            propertyType,
            state,
            city,
            college,
            address,
            rent,
            deposit,
            gender,
            sharing,
            amenities,
            description,
            latitude,
            longitude
        } = req.body;

        const property = await Property.create({

            owner: req.user.id,

            propertyName,

            propertyType,

            state,

            city,

            college,

            address,

            rent,

            deposit,

            gender,

            sharing,

            amenities,

            description,

            latitude,

            longitude,

            images,

            status: "pending"

        });

        res.status(201).json({

            success: true,

            message: "Property Uploaded Successfully",

            property

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }
}


// ==========================================
// CREATE PROPERTY
// ==========================================

router.post(
    "/",
    auth,
    upload.array("images", 10),
    createProperty
);

// Alias for backward compatibility
router.post(
    "/create",
    auth,
    upload.array("images", 10),
    createProperty
);


// ==========================================
// SEARCH PROPERTIES
// ==========================================

router.get("/search", async (req, res) => {

    try {

        const {
            state,
            city,
            college,
            propertyType,
            gender,
            sharing,
            minRent,
            maxRent,
            amenities,
            sort = "latest",
            page = 1,
            limit = 12
        } = req.query;

        const filter = {};

        if (state) filter.state = state;

        if (city) filter.city = city;

        if (college)
            filter.college = new RegExp(college, "i");

        if (propertyType)
            filter.propertyType = propertyType;

        if (gender)
            filter.gender = gender;

        if (sharing)
            filter.sharing = sharing;

        if (minRent || maxRent) {

            filter.rent = {};

            if (minRent)
                filter.rent.$gte = Number(minRent);

            if (maxRent)
                filter.rent.$lte = Number(maxRent);

        }

        if (amenities) {

            filter.amenities = {
                $all: amenities.split(",")
            };

        }

        // Only approved + published properties are visible to students
        filter.status = "approved";
        filter.published = true;
        filter.blacklisted = { $ne: true };

        let sortOption = { createdAt: -1 };

        if (sort === "priceLow")
            sortOption = { rent: 1 };

        if (sort === "priceHigh")
            sortOption = { rent: -1 };

        if (sort === "rating")
            sortOption = { averageRating: -1 };

        const total = await Property.countDocuments(filter);

        const properties = await Property.find(filter)
            .populate("owner", "name email phone")
            .sort(sortOption)
            .skip((page - 1) * Number(limit))
            .limit(Number(limit));

        res.json({

            success: true,

            total,

            currentPage: Number(page),

            totalPages: Math.ceil(total / Number(limit)),

            properties

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});


// ==========================================
// GET PROPERTY BY ID
// ==========================================

const mongoose = require("mongoose");

router.get("/:id", async (req, res) => {

    try {

        // Validate ObjectId before querying
        if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
            return res.status(400).json({
                success: false,
                message: "Invalid property ID"
            });
        }

        const property = await Property.findById(req.params.id)
            .populate("owner", "name email phone");

        if (!property) {

            return res.status(404).json({

                success: false,

                message: "Property Not Found"

            });

        }

        // Public can only view approved + published + available properties.
        // Owners can view their own property regardless of status.
        const isApproved =
            property.status === "approved" &&
            property.published !== false &&
            property.blacklisted !== true;

        const isOwner =
            req.user && property.owner &&
            String(property.owner._id || property.owner) === String(req.user.id);

        if (!isApproved && !isOwner) {
            return res.status(403).json({
                success: false,
                message: "Property is not available for viewing."
            });
        }

        const Tenancy = require("../models/Tenancy");
        const currentResidentsCount = await Tenancy.countDocuments({ property: property._id, status: "ACTIVE" });
        const verifiedStaysCount = await Tenancy.countDocuments({ property: property._id, status: { $in: ["ACTIVE", "ENDED"] } });

        res.json({

            success: true,

            property,
            currentResidentsCount,
            verifiedStaysCount

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});


// ==========================================
// UPDATE PROPERTY
// ==========================================

// Allowed fields that an owner may update
const PROPERTY_UPDATABLE_FIELDS = [
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
    "amenities",
    "description",
    "latitude",
    "longitude",
    "images",
    "available",
    "availableBeds",
    "totalBeds",
    "houseRules",
    "maintenanceCharge",
    "electricityCharge",
    "foodCharge",
    "nearby"
];

router.put("/:id", auth, async (req, res) => {

    try {

        const property = await Property.findById(req.params.id);

        if (!property) {

            return res.status(404).json({

                success: false,

                message: "Property Not Found"

            });

        }

        if (property.owner.toString() !== req.user.id.toString()) {

            return res.status(403).json({

                success: false,

                message: "You can only update your own property."

            });

        }

        // Whitelist fields — owners cannot change status/published/owner
        const updates = {};
        for (const key of PROPERTY_UPDATABLE_FIELDS) {
            if (req.body[key] !== undefined) {
                updates[key] = req.body[key];
            }
        }

        const updatedProperty = await Property.findByIdAndUpdate(

            req.params.id,

            updates,

            {
                new: true,
                runValidators: true
            }

        );

        res.json({

            success: true,

            message: "Property Updated Successfully",

            property: updatedProperty

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});


// ==========================================
// DELETE PROPERTY
// ==========================================

router.delete("/:id", auth, async (req, res) => {

    try {

        const property = await Property.findById(req.params.id);

        if (!property) {

            return res.status(404).json({

                success: false,

                message: "Property Not Found"

            });

        }

        if (property.owner.toString() !== req.user.id.toString()) {

            return res.status(403).json({

                success: false,

                message: "You can only delete your own property."

            });

        }

        // Delete local orphaned files if present
        if (property.images && Array.isArray(property.images)) {
            const fs = require("fs");
            const path = require("path");
            property.images.forEach(img => {
                if (img.includes("/uploads/")) {
                    const filename = img.split("/uploads/").pop();
                    const localPath = path.join(__dirname, "../uploads", filename);
                    if (fs.existsSync(localPath)) {
                        try { fs.unlinkSync(localPath); } catch (e) { }
                    }
                }
            });
        }

        await property.deleteOne();

        const logAudit = require("../utils/auditLogger");
        await logAudit({
            userId: req.user.id,
            userEmail: req.user.email || "",
            role: req.user.role || "owner",
            action: "PROPERTY_DELETION",
            resource: "Property",
            resourceId: property._id.toString(),
            details: { propertyName: property.propertyName },
            req
        });

        res.json({
            success: true,
            message: "Property Deleted Successfully"
        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: err.message

        });

    }

});

// ==========================================
// GET SAVED PROPERTIES (for current user)
// ==========================================

router.get("/saved/list", auth, async (req, res) => {
    try {
        const User = require("../models/User");
        const user = await User.findById(req.user.id).populate("savedProperties");
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        res.json({ success: true, properties: user.savedProperties || [] });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// SAVE PROPERTY
// ==========================================

router.post("/save/:id", auth, async (req, res) => {
    try {
        const User = require("../models/User");
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const propId = req.params.id;
        if (user.savedProperties.includes(propId)) {
            return res.json({ success: true, message: "Already saved" });
        }
        user.savedProperties.push(propId);
        await user.save();
        res.json({ success: true, message: "Property saved" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// REMOVE SAVED PROPERTY
// ==========================================

router.delete("/save/:id", auth, async (req, res) => {
    try {
        const User = require("../models/User");
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        user.savedProperties = user.savedProperties.filter(
            id => id.toString() !== req.params.id
        );
        await user.save();
        res.json({ success: true, message: "Property removed from saved" });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

// ==========================================
// CHECK IF PROPERTY IS SAVED
// ==========================================

router.get("/save/:id/check", auth, async (req, res) => {
    try {
        const User = require("../models/User");
        const user = await User.findById(req.user.id);
        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }
        const isSaved = user.savedProperties.includes(req.params.id);
        res.json({ success: true, saved: isSaved });
    } catch (err) {
        console.log(err);
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
