// =====================================================
// CAMPORA PAYMENT ROUTES
// Supabase-Native & Multi-Provider Razorpay Test Mode Handler
// =====================================================

const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const dbConfig = require("../config/database");
const { getSupabaseClient } = require("../config/supabase");

const router = express.Router();

function getRazorpayClient() {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error("Razorpay credentials (RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET) are not configured.");
    }
    return new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
}

// Helper to load booking by ID across database providers
async function loadBooking(bookingId) {
    if (dbConfig.isSupabase()) {
        const db = await getSupabaseClient();
        const res = await db.query(
            `SELECT b.*, p.deposit 
             FROM bookings b 
             LEFT JOIN properties p ON b.property_id = p.id 
             WHERE b.id::text = $1 OR b.mongo_id = $1 
             LIMIT 1`,
            [String(bookingId)]
        );
        if (res.rows.length === 0) return null;
        const row = res.rows[0];
        return {
            id: row.id,
            _id: row.mongo_id || row.id,
            userId: row.user_id,
            ownerId: row.owner_id,
            propertyId: row.property_id,
            propertyName: row.property_name,
            price: Number(row.price || 0),
            deposit: Number(row.deposit || 0),
            paymentStatus: row.payment_status,
            bookingStatus: row.booking_status,
            rawRow: row
        };
    } else {
        const Booking = require("../models/Booking");
        const Property = require("../models/Property");
        if (!mongoose.Types.ObjectId.isValid(bookingId)) return null;
        const booking = await Booking.findById(bookingId);
        if (!booking) return null;
        const property = booking.propertyId ? await Property.findById(booking.propertyId) : null;
        return {
            id: String(booking._id),
            _id: String(booking._id),
            userId: String(booking.userId),
            ownerId: String(booking.ownerId),
            propertyId: String(booking.propertyId),
            propertyName: booking.propertyName,
            price: Number(booking.price || 0),
            deposit: Number(property?.deposit || 0),
            paymentStatus: booking.paymentStatus,
            bookingStatus: booking.bookingStatus,
            doc: booking
        };
    }
}

// =====================================
// CREATE ORDER
// Amount calculated server-side from DB
// =====================================
router.post("/create-order", auth, async (req, res) => {
    try {
        const { bookingId } = req.body;
        if (!bookingId) {
            return res.status(400).json({ success: false, message: "Booking ID is required" });
        }

        const booking = await loadBooking(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        // Ownership check
        if (req.user.role !== "admin" && String(booking.userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: "You are not authorized to pay for this booking" });
        }

        // Prevent duplicate payment
        if (booking.paymentStatus === "paid") {
            return res.status(400).json({ success: false, message: "This booking is already paid" });
        }

        const bookingFee = 1000;
        const rent = booking.price || 0;
        const deposit = booking.deposit || 0;
        const total = Math.round(rent + deposit + bookingFee);

        if (total <= 0) {
            return res.status(400).json({ success: false, message: "Unable to calculate payment amount" });
        }

        const options = {
            amount: total * 100, // Razorpay amount in paise
            currency: "INR",
            receipt: `campora_${String(booking.id).slice(0, 20)}`,
            notes: {
                bookingId: String(booking.id),
                propertyName: booking.propertyName || ""
            }
        };

        const order = await getRazorpayClient().orders.create(options);

        res.json({
            success: true,
            order,
            amount: total,
            key: process.env.RAZORPAY_KEY_ID
        });
    } catch (err) {
        console.error("[Razorpay Create Order Error]:", err.message || err);
        res.status(500).json({
            success: false,
            message: err.message || "Unable to create payment order"
        });
    }
});

// =====================================
// VERIFY PAYMENT
// Validates HMAC SHA-256 signature
// Updates booking to confirmed / paid
// =====================================
router.post("/verify", auth, async (req, res) => {
    try {
        const { bookingId, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        if (!bookingId || !razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            return res.status(400).json({ success: false, message: "Payment verification details are incomplete." });
        }

        if (!process.env.RAZORPAY_KEY_SECRET) {
            return res.status(500).json({ success: false, message: "Payment secret key is missing on backend." });
        }

        const body = razorpay_order_id + "|" + razorpay_payment_id;
        const expectedSignature = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest("hex");

        if (expectedSignature !== razorpay_signature) {
            return res.status(400).json({ success: false, message: "Invalid Razorpay payment signature" });
        }

        const booking = await loadBooking(bookingId);
        if (!booking) {
            return res.status(404).json({ success: false, message: "Booking not found" });
        }

        if (req.user.role !== "admin" && String(booking.userId) !== String(req.user.id)) {
            return res.status(403).json({ success: false, message: "You are not authorized to confirm payment for this booking" });
        }

        // Idempotency: if already marked paid, return success without duplicating
        if (booking.paymentStatus === "paid") {
            return res.json({
                success: true,
                message: "Payment already verified",
                alreadyPaid: true,
                booking
            });
        }

        if (dbConfig.isSupabase()) {
            const db = await getSupabaseClient();
            await db.query(
                `UPDATE bookings 
                 SET payment_status = 'paid', 
                     booking_status = 'confirmed', 
                     payment_id = $1, 
                     payment_date = NOW(), 
                     payment_method = 'Razorpay Test', 
                     updated_at = NOW() 
                 WHERE id::text = $2 OR mongo_id = $2`,
                [razorpay_payment_id, String(bookingId)]
            );

            // Idempotently create active tenancy record for student
            if (booking.userId && booking.propertyId) {
                await db.query(
                    `INSERT INTO tenancies (student_id, property_id, room, start_date, status, source)
                     VALUES ($1, $2, 'Single', NOW(), 'ACTIVE', 'BOOKING')
                     ON CONFLICT DO NOTHING`,
                    [booking.userId, booking.propertyId]
                ).catch(err => console.warn("[Payment Verification] Tenancy insert notice:", err.message));
            }

            // Create system notifications
            await db.query(
                `INSERT INTO notifications (receiver_id, sender_id, title, message, type)
                 VALUES ($1, $2, 'Payment Received & Booking Confirmed', $3, 'payment')`,
                [booking.userId, booking.ownerId || booking.userId, `Your payment for ${booking.propertyName || 'your property'} has been confirmed!`, 'payment']
            ).catch(() => {});

            if (booking.ownerId) {
                await db.query(
                    `INSERT INTO notifications (receiver_id, sender_id, title, message, type)
                     VALUES ($1, $2, 'New Confirmed Booking Payment', $3, 'payment')`,
                    [booking.ownerId, booking.userId, `Payment confirmed for ${booking.propertyName || 'your property'}.`, 'payment']
                ).catch(() => {});
            }
        } else {
            booking.doc.paymentStatus = "paid";
            booking.doc.bookingStatus = "confirmed";
            booking.doc.paymentId = razorpay_payment_id;
            booking.doc.paymentDate = new Date();
            booking.doc.paymentMethod = "Razorpay Test";
            await booking.doc.save();
        }

        res.json({
            success: true,
            message: "Payment verified and booking confirmed!",
            bookingId: booking.id
        });
    } catch (err) {
        console.error("[Payment Verification Error]:", err.message || err);
        res.status(500).json({ success: false, message: err.message || "Payment verification failed" });
    }
});

module.exports = router;
