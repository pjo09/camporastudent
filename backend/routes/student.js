const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");

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
            recommended
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
                { $match: { studentId: mongoose.Types.ObjectId(studentId) } },
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
                .limit(6)

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
            recommended
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

        if (booking.bookingStatus === "checked-in" || booking.bookingStatus === "checked-out") {
            return res.status(400).json({
                success: false,
                message: "You cannot cancel a booking that has already started."
            });
        }

        booking.bookingStatus = "cancelled";
        booking.cancelReason = req.body.reason || "Cancelled by student";
        await booking.save();

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

module.exports = router;
