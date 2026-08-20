const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");
const Tenancy = require("../models/Tenancy");
const ResidentRequest = require("../models/ResidentRequest");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ======================================================
// STUDENT PROFILE
// ======================================================

router.get("/profile", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id)
            .select("-password");

        if (!user) {

            return res.status(404).json({

                success: false,
                message: "User not found"

            });

        }

        res.json({

            success: true,
            user

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ======================================================
// STUDENT DASHBOARD
// ======================================================

router.get("/dashboard", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id);

        if (!user) {

            return res.status(404).json({

                success: false,
                message: "User not found"

            });

        }

        const totalBookings = await Booking.countDocuments({

            userId: user._id

        });

        const savedProperties = user.savedProperties
            ? user.savedProperties.length
            : 0;

        const viewedProperties = user.recentlyViewed
            ? user.recentlyViewed.length
            : 0;

        const recommended = await Property.find({

            available: true,
            published: true

        })
        .populate("owner", "name phone")
        .sort({

            featured: -1,
            averageRating: -1

        })
        .limit(8);

        const upcomingBookings = await Booking.find({

            userId: user._id

        })
        .populate("propertyId")
        .sort({

            createdAt: -1

        })
        .limit(5);

        res.json({

            success: true,

            statistics: {

                savedProperties,

                totalBookings,

                viewedProperties,

                contacts: 0

            },

            recommendations: recommended,

            upcomingBookings

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ======================================================
// STUDENT BOOKINGS
// ======================================================

router.get("/bookings", auth, requireRole("student"), async (req, res) => {

    try {

        const bookings = await Booking.find({
            userId: req.user.id
        })
        .populate("propertyId", "propertyName city state images")
        .sort({
            createdAt: -1
        });

        res.json({
            success: true,
            bookings
        });

    }

    catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================================================
// SAVED PROPERTIES
// ======================================================

router.get("/saved", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id)
            .populate("savedProperties");

        if (!user) {

            return res.status(404).json({

                success: false,
                message: "User not found"

            });

        }

        res.json({

            success: true,

            properties:

                user.savedProperties || []

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ======================================================
// RECENTLY VIEWED
// ======================================================

router.get("/recent", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id)
            .populate("recentlyViewed");

        if (!user) {

            return res.status(404).json({

                success: false,
                message: "User not found"

            });

        }

        res.json({

            success: true,

            properties:

                user.recentlyViewed || []

        });

    }

    catch (err) {

        res.status(500).json({

            success: false,
            message: err.message

        });

    }

});

// ======================================================
// NOTIFICATIONS
// ======================================================

const Notification = require("../models/Notification");

router.get("/notifications", auth, requireRole("student"), async (req, res) => {

    try {

        const notifications = await Notification.find({ receiverId: req.user.id })
            .sort({ createdAt: -1 })
            .limit(50);

        const unreadCount = await Notification.countDocuments({ receiverId: req.user.id, isRead: false });

        res.json({
            success: true,
            notifications,
            unreadCount
        });

    }

    catch (err) {

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});

// ======================================================
// MARK NOTIFICATION READ
// ======================================================

router.put("/notifications/:id/read", auth, requireRole("student"), async (req, res) => {

    try {

        await Notification.findByIdAndUpdate(req.params.id, { isRead: true });

        res.json({ success: true, message: "Marked as read" });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// MARK ALL NOTIFICATIONS READ
// ======================================================

router.put("/notifications/read-all", auth, requireRole("student"), async (req, res) => {

    try {

        await Notification.updateMany({ receiverId: req.user.id, isRead: false }, { isRead: true });

        res.json({ success: true, message: "All marked as read" });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// DELETE NOTIFICATION
// ======================================================

router.delete("/notifications/:id", auth, requireRole("student"), async (req, res) => {

    try {

        await Notification.findByIdAndDelete(req.params.id);

        res.json({ success: true, message: "Notification deleted" });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// SAVE PROPERTY
// ======================================================

router.post("/saved/:propertyId", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id);

        if (!user) {

            return res.status(404).json({ success: false, message: "User not found" });

        }

        const propId = req.params.propertyId;

        if (user.savedProperties.includes(propId)) {

            return res.json({ success: true, message: "Already saved" });

        }

        user.savedProperties.push(propId);

        await user.save();

        res.json({ success: true, message: "Property saved" });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// REMOVE SAVED PROPERTY
// ======================================================

router.delete("/saved/:propertyId", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id);

        if (!user) {

            return res.status(404).json({ success: false, message: "User not found" });

        }

        user.savedProperties = user.savedProperties.filter(

            id => id.toString() !== req.params.propertyId

        );

        await user.save();

        res.json({ success: true, message: "Property removed from saved" });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// TRACK RECENTLY VIEWED
// ======================================================

router.post("/recent/:propertyId", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id);

        if (!user) {

            return res.status(404).json({ success: false, message: "User not found" });

        }

        const propId = req.params.propertyId;

        // Remove if already exists
        user.recentlyViewed = user.recentlyViewed.filter(

            id => id.toString() !== propId

        );

        // Add to front
        user.recentlyViewed.unshift(propId);

        // Keep only last 20
        if (user.recentlyViewed.length > 20) {

            user.recentlyViewed = user.recentlyViewed.slice(0, 20);

        }

        await user.save();

        // Increment property view count
        await Property.findByIdAndUpdate(propId, { $inc: { views: 1 } });

        res.json({ success: true, message: "View tracked" });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// UPDATE PROFILE
// ======================================================

router.put("/profile", auth, requireRole("student"), async (req, res) => {

    try {

        const allowedFields = [
            "name",
            "phone",
            "college",
            "course",
            "year",
            "bio",
            "emergencyContact",
            "notificationSettings",
            "profileImage",
            "avatar"
        ];

        const updates = {};

        allowedFields.forEach(field => {

            if (req.body[field] !== undefined) {

                updates[field] = req.body[field];

            }

        });

        const user = await User.findByIdAndUpdate(req.user.id, updates, {

            new: true,
            runValidators: true

        }).select("-password");

        res.json({ success: true, user });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// DELETE ACCOUNT (permanent)
// ======================================================

router.delete("/profile", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id);

        if (!user) {

            return res.status(404).json({

                success: false,
                message: "User not found"

            });

        }

        // Delete related bookings and reviews for this user
        await Booking.deleteMany({ userId: user._id });

        const Review = require("../models/Review");
        await Review.deleteMany({ user: user._id });

        // Remove the user account
        await User.findByIdAndDelete(user._id);

        res.json({

            success: true,
            message: "Account deleted successfully"

        });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// CHANGE PASSWORD
// ======================================================

const bcrypt = require("bcryptjs");

router.put("/change-password", auth, requireRole("student"), async (req, res) => {

    try {

        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {

            return res.status(400).json({

                success: false,
                message: "Current and new password required"

            });

        }

        if (newPassword.length < 6) {

            return res.status(400).json({

                success: false,
                message: "New password must be at least 6 characters"

            });

        }

        const user = await User.findById(req.user.id);

        if (!user.password) {

            return res.status(400).json({

                success: false,
                message: "This account uses Google sign-in"

            });

        }

        const isMatch = await bcrypt.compare(currentPassword, user.password);

        if (!isMatch) {

            return res.status(400).json({

                success: false,
                message: "Current password is incorrect"

            });

        }

user.password = await bcrypt.hash(newPassword, 10);

        await user.save();

        res.json({ success: true, message: "Password changed successfully" });

    } catch (err) {

        res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// STUDENT DASHBOARD V3 (aggregate)
// ======================================================

router.get("/dashboard-v3", auth, requireRole("student"), async (req, res) => {

try {

        const studentId = req.user.id;

        // --- Safely validate the student ID before any DB query ---
        if (!mongoose.isValidObjectId(studentId)) {
            return res.status(400).json({
                success: false,
                message: "Invalid student identifier."
            });
        }
        const studentObjectId = new mongoose.Types.ObjectId(studentId);

        const Maintenance = require("../models/Maintenance");
        const Invoice = require("../models/Invoice");
        const { MessageConversation } = require("../models/Message");

        const [
            user,
            totalBookings,
            activeBookings,
            pendingBookings,
            savedCount,
            recentCount,
            unreadNotifications,
            unreadMessages,
            pendingMaintenance,
            rentDue,
            upcomingInvoices,
            recentBookings,
            recentNotifications,
            savedProperties,
            recommended,
            activeTenancy,
            residentRequests
        ] = await Promise.all([

            User.findById(studentId).select("-password"),

            Booking.countDocuments({ userId: studentId }),

            Booking.countDocuments({
                userId: studentId,
                bookingStatus: { $in: ["confirmed", "checked-in"] }
            }),

            Booking.countDocuments({
                userId: studentId,
                bookingStatus: "pending"
            }),

            User.findById(studentId).then(u => (u.savedProperties || []).length),

            User.findById(studentId).then(u => (u.recentlyViewed || []).length),

            Notification.countDocuments({ receiverId: studentId, isRead: false }),

            MessageConversation.aggregate([
                { $match: { studentId: studentObjectId } },
                { $group: { _id: null, total: { $sum: "$unreadByStudent" } } }
            ]).then(r => (r[0] && r[0].total) || 0),

            Maintenance.countDocuments({
                studentId,
                status: { $in: ["open", "assigned", "in-progress"] }
            }),

            Invoice.find({
                studentId,
                status: { $in: ["pending", "partial", "overdue"] }
            }).then(invs => invs.reduce((s, i) => s + (i.totalAmount - i.amountPaid), 0)),

            Invoice.find({
                studentId,
                status: { $in: ["pending", "partial", "overdue"] }
            }).sort({ dueDate: 1 }).limit(5),

            Booking.find({ userId: studentId })
                .populate("propertyId", "propertyName city state images rent")
                .populate("ownerId", "name phone")
                .sort({ createdAt: -1 })
                .limit(6),

            Notification.find({ receiverId: studentId })
                .sort({ createdAt: -1 })
                .limit(6),

            User.findById(studentId).populate("savedProperties").then(u => u.savedProperties || []),

            Property.find({
                available: true,
                published: true,
                status: "approved",
                blacklisted: { $ne: true }
            })
                .populate("owner", "name phone")
                .sort({ featured: -1, averageRating: -1 })
                .limit(6),

            Tenancy.findOne({ student: studentId, status: "ACTIVE" })
                .populate("property", "propertyName city state images owner"),

            ResidentRequest.find({ student: studentId })
                .populate("property", "propertyName city state images")
                .sort({ requestedAt: -1 })

        ]);

        return res.json({
            success: true,
            user,
            statistics: {
                totalBookings,
                activeBookings,
                pendingBookings,
                savedCount,
                recentCount,
                unreadNotifications,
                unreadMessages,
                pendingMaintenance,
                rentDue
            },
            upcomingInvoices,
            recentBookings,
            recentNotifications,
            savedProperties,
            recommended,
            activeTenancy,
            residentRequests
        });

    } catch (err) {

        return res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// CANCEL BOOKING (student)
// ======================================================

router.patch("/bookings/:id/cancel", auth, requireRole("student"), async (req, res) => {

    try {

        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid booking ID" });
        }

        const booking = await Booking.findOne({
            _id: req.params.id,
            userId: req.user.id
        });

        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        if (booking.bookingStatus === "cancelled") {
            return res.status(400).json({ success: false, message: "Booking is already cancelled." });
        }

        if (booking.bookingStatus === "checked-in" || booking.bookingStatus === "checked-out") {
            return res.status(400).json({
                success: false,
                message: "You cannot cancel a booking that has already started."
            });
        }

        let session = null;
        let useTransaction = false;
        try {
            session = await mongoose.startSession();
            session.startTransaction();
            useTransaction = true;
        } catch (e) {
            useTransaction = false;
            if (session) {
                session.endSession();
                session = null;
            }
        }

        if (useTransaction) {
            try {
                const { releaseBookingInventory } = require("../utils/inventoryHelper");
                await releaseBookingInventory(booking._id, session);

                booking.bookingStatus = "cancelled";
                booking.cancelReason = req.body.reason || "Cancelled by student";
                await booking.save({ session });
                
                await session.commitTransaction();
            } catch (err) {
                if (session.inTransaction()) {
                    await session.abortTransaction();
                }
                session.endSession();
                throw err;
            } finally {
                if (session) session.endSession();
            }
        } else {
            const { releaseBookingInventory } = require("../utils/inventoryHelper");
            await releaseBookingInventory(booking._id);

            booking.bookingStatus = "cancelled";
            booking.cancelReason = req.body.reason || "Cancelled by student";
            await booking.save();
        }

        // Notify owner
        try {
            await Notification.create({
                receiverId: booking.ownerId,
                title: "Booking Cancelled",
                message: `A student cancelled their booking for "${booking.propertyName || 'a property'}".`,
                type: "booking"
            });
        } catch (e) { /* non-fatal */ }

        return res.json({ success: true, message: "Booking cancelled", booking });

    } catch (err) {

        return res.status(500).json({ success: false, message: err.message });

    }

});

// ======================================================
// STUDENT DOCUMENTS
// ======================================================

router.get("/documents", auth, requireRole("student"), async (req, res) => {

    try {

        const user = await User.findById(req.user.id).select("-password");

        if (!user) {
            return res.status(404).json({ success: false, message: "User not found" });
        }

        // Documents derived from user data + bookings
        const bookings = await Booking.find({ userId: user._id })
            .populate("propertyId", "propertyName city state address rent")
            .sort({ createdAt: -1 });

        const agreements = bookings
            .filter(b => b.bookingStatus === "confirmed" || b.bookingStatus === "checked-in")
            .map(b => ({
                id: b._id,
                type: "agreement",
                title: "Rental Agreement - " + (b.propertyName || "Property"),
                date: b.createdAt,
                property: b.propertyName || "Property",
                bookingId: b._id
            }));

        const receipts = bookings
            .filter(b => b.paymentStatus === "paid")
            .map(b => ({
                id: b._id,
                type: "receipt",
                title: "Payment Receipt - " + (b.propertyName || "Property"),
                amount: b.price || 0,
                date: b.paymentDate || b.createdAt,
                property: b.propertyName || "Property",
                bookingId: b._id
            }));

        const idProofs = [];

        if (user.profileImage) {
            idProofs.push({
                id: "profile",
                type: "idproof",
                title: "Profile ID",
                url: user.profileImage,
                date: user.createdAt
            });
        }

        return res.json({
            success: true,
            documents: {
                agreements,
                receipts,
                idProofs
            }
        });

    } catch (err) {

        return res.status(500).json({ success: false, message: err.message });

    }

});



// ======================================================
// STUDENT ANALYTICS
// ======================================================
router.get("/analytics", auth, requireRole("student"), async (req, res) => {
    try {
        const studentId = req.user.id;
        const Invoice = require("../models/Invoice");
        const Maintenance = require("../models/Maintenance");

        const [bookings, invoices, savingProps, maintenance] = await Promise.all([
            Booking.find({ userId: studentId }).sort({ createdAt: 1 }),
            Invoice.find({ studentId }),
            User.findById(studentId).populate("savedProperties").then(u => u.savedProperties || []),
            Maintenance.find({ studentId })
        ]);

        const totalSpent = invoices.reduce((s, i) => s + (i.amountPaid || 0), 0);
        const totalPaidBookings = bookings.filter(b => b.paymentStatus === "paid").length;
        const totalCancelled = bookings.filter(b => b.bookingStatus === "cancelled").length;

        // Favorite locations
        const cityCounts = {};
        savingProps.forEach(p => {
            if (p.city) cityCounts[p.city] = (cityCounts[p.city] || 0) + 1;
        });

        const favoriteLocations = Object.entries(cityCounts)
            .map(([city, count]) => ({ city, count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Monthly spending
        const monthly = {};
        invoices.forEach(inv => {
            inv.transactions.forEach(t => {
                const d = new Date(t.paidAt);
                const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
                monthly[key] = (monthly[key] || 0) + t.amount;
            });
        });

        // Booking timeline
        const bookingTimeline = bookings.map(b => ({
            month: b.createdAt ? new Date(b.createdAt).getMonth() + 1 : 0,
            year: b.createdAt ? new Date(b.createdAt).getFullYear() : 0,
            status: b.bookingStatus
        }));

        return res.json({
            success: true,
            analytics: {
                totalBookings: bookings.length,
                totalSpent,
                totalPaidBookings,
                totalCancelled,
                totalMaintenance: maintenance.length,
                pendingMaintenance: maintenance.filter(m => !["resolved", "rejected"].includes(m.status)).length,
                favoriteLocations,
                monthly,
                bookingTimeline
            }
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});


// ======================================================
// STUDENT MOVE-IN CENTER
// ======================================================
router.get("/bookings/:id/move-in", auth, requireRole("student"), async (req, res) => {
    try {
        const { MessageConversation, Message } = require("../models/Message");
        const { id } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid booking ID" });
        }

        const booking = await Booking.findById(id);
        if (!booking || String(booking.userId) !== String(req.user.id)) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        const property = await Property.findById(booking.propertyId);
        if (!property) {
            return res.status(404).json({ success: false, message: "Property not found" });
        }

        const owner = await User.findById(booking.ownerId).select("name businessName phone email");

        // Calculate checklist details
        const bookingConfirmed = ["confirmed", "checked-in", "checked-out"].includes(booking.bookingStatus);
        const paymentStatus = booking.paymentStatus === "paid";
        const moveInDateConfirmed = !!booking.checkIn;
        const checkInInstructionsReceived = !!booking.checkInInstructions;

        // Check if owner contacted (student sent at least one message)
        let ownerContacted = false;
        const conv = await MessageConversation.findOne({ bookingId: booking._id });
        if (conv) {
            ownerContacted = await Message.exists({ conversationId: conv._id, sender: "student" });
        }

        // Fetch announcements for this property
        const Announcement = require("../models/Announcement");
        const announcements = await Announcement.find({
            property: property._id,
            active: true,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        }).sort({ createdAt: -1 });

        return res.json({
            success: true,
            booking: {
                _id: booking._id,
                bookingStatus: booking.bookingStatus,
                checkIn: booking.checkIn,
                checkOut: booking.checkOut,
                price: booking.price,
                paymentStatus: booking.paymentStatus,
                checkInInstructions: booking.checkInInstructions,
                checkInWindow: booking.checkInWindow,
                meetingInstructions: booking.meetingInstructions,
                specialInstructions: booking.specialInstructions,
                requiredDocuments: booking.requiredDocuments || []
            },
            property: {
                _id: property._id,
                propertyName: property.propertyName,
                propertyType: property.propertyType,
                images: property.images,
                address: property.address,
                city: property.city,
                state: property.state,
                sharing: property.sharing,
                gender: property.gender,
                amenities: property.amenities,
                houseRules: property.houseRules
            },
            owner,
            checklist: {
                bookingConfirmed,
                documentsSubmitted: booking.requiredDocuments && booking.requiredDocuments.length > 0
                    ? booking.requiredDocuments.every(d => !d.required || d.submitted)
                    : false,
                paymentStatus,
                moveInDateConfirmed,
                checkInInstructionsReceived,
                ownerContacted: !!ownerContacted
            },
            announcements
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// SECURE FILE UPLOAD FOR PRIVATE DOCUMENTS
// ======================================================
const multer = require("multer");
const path = require("path");
const fs = require("fs");

const docStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, "../private_uploads/documents");
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const secureName = require("crypto").randomBytes(16).toString("hex") + ext;
        cb(null, secureName);
    }
});

const docUpload = multer({
    storage: docStorage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5 MB limit
    fileFilter: (req, file, cb) => {
        const allowedExtensions = [".jpg", ".jpeg", ".png", ".pdf"];
        const ext = path.extname(file.originalname).toLowerCase();
        if (allowedExtensions.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error("Only JPG, JPEG, PNG, and PDF files are allowed."));
        }
    }
});

router.post("/bookings/:id/documents/:docIndex", auth, requireRole("student"), docUpload.single("document"), async (req, res) => {
    try {
        const { id, docIndex } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid booking ID" });
        }

        const booking = await Booking.findById(id);
        if (!booking || String(booking.userId) !== String(req.user.id)) {
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        if (!req.file) {
            return res.status(400).json({ success: false, message: "No file uploaded" });
        }

        const index = parseInt(docIndex);
        if (isNaN(index) || !booking.requiredDocuments || index < 0 || index >= booking.requiredDocuments.length) {
            if (req.file && fs.existsSync(req.file.path)) {
                try { fs.unlinkSync(req.file.path); } catch (e) {}
            }
            return res.status(400).json({ success: false, message: "Invalid document index" });
        }

        // Cleanup old file if it exists
        const oldFileName = booking.requiredDocuments[index].fileName;
        if (oldFileName) {
            const oldPath = path.join(__dirname, "../private_uploads/documents", oldFileName);
            if (fs.existsSync(oldPath)) {
                try { fs.unlinkSync(oldPath); } catch (e) {}
            }
        }

        booking.requiredDocuments[index].submitted = true;
        booking.requiredDocuments[index].fileName = req.file.filename;
        booking.requiredDocuments[index].documentUrl = `/api/student/bookings/${booking._id}/documents/${index}/view`;
        booking.requiredDocuments[index].submittedAt = new Date();

        await booking.save();

        // Check if all required docs are submitted
        const allDone = booking.requiredDocuments.every(d => !d.required || d.submitted);
        if (allDone) {
            try {
                await Notification.create({
                    receiverId: booking.ownerId,
                    title: "Required Documents Submitted",
                    message: `Student ${booking.userName} has submitted all required documents for booking at ${booking.propertyName}.`,
                    type: "DOCUMENT_REQUEST"
                });
            } catch (e) {}
        }

        return res.json({
            success: true,
            message: "Document submitted successfully",
            requiredDocuments: booking.requiredDocuments
        });
    } catch (err) {
        if (req.file && fs.existsSync(req.file.path)) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// SECURE FILE VIEWING FOR PRIVATE DOCUMENTS
// ======================================================
router.get("/bookings/:id/documents/:docIndex/view", auth, async (req, res) => {
    try {
        const { id, docIndex } = req.params;
        if (!isValidObjectId(id)) {
            return res.status(400).json({ success: false, message: "Invalid booking ID" });
        }

        const booking = await Booking.findById(id);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // Authorize: user must be student of booking, owner of property, or admin
        const isStudent = String(booking.userId) === String(req.user.id) && req.user.role === "student";
        const isOwner = String(booking.ownerId) === String(req.user.id) && req.user.role === "owner";
        const isAdmin = req.user.role === "admin";

        if (!isStudent && !isOwner && !isAdmin) {
            return res.status(403).json({ success: false, message: "Unauthorized access" });
        }

        const index = parseInt(docIndex);
        if (isNaN(index) || !booking.requiredDocuments || index < 0 || index >= booking.requiredDocuments.length) {
            return res.status(400).json({ success: false, message: "Invalid document index" });
        }

        const doc = booking.requiredDocuments[index];
        if (!doc.submitted || !doc.fileName) {
            return res.status(404).json({ success: false, message: "Document not submitted yet" });
        }

        // Path traversal protection
        const docDir = path.resolve(path.join(__dirname, "../private_uploads/documents"));
        const filePath = path.resolve(path.join(docDir, doc.fileName));

        if (!filePath.startsWith(docDir)) {
            return res.status(400).json({ success: false, message: "Path traversal detected" });
        }

        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: "File not found on disk" });
        }

        return res.sendFile(filePath);
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// PROPERTY ANNOUNCEMENTS
// ======================================================
router.get("/announcements", auth, requireRole("student"), async (req, res) => {
    try {
        const bookings = await Booking.find({
            userId: req.user.id,
            bookingStatus: { $in: ["confirmed", "checked-in"] }
        });

        const propertyIds = bookings.map(b => b.propertyId);
        if (propertyIds.length === 0) {
            return res.json({ success: true, announcements: [] });
        }

        const Announcement = require("../models/Announcement");
        const announcements = await Announcement.find({
            property: { $in: propertyIds },
            active: true,
            $or: [
                { expiresAt: null },
                { expiresAt: { $gt: new Date() } }
            ]
        })
        .populate("property", "propertyName images city")
        .sort({ createdAt: -1 });

        return res.json({ success: true, announcements });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
