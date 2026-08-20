// =====================================================
// CAMPORA PAYMENT ROUTES
// =====================================================
// NOTE: Payment integration is INTENTIONALLY DISABLED for
// the current production phase. This router is NOT mounted
// by app.js. The file is retained for future Razorpay
// integration — do not delete.
// =====================================================
const express = require("express");
const Razorpay = require("razorpay");
const crypto = require("crypto");
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const Booking = require("../models/Booking");

const router = express.Router();

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

function getRazorpayClient() {

    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {

        throw new Error("Payment service is not configured.");

    }

    return new Razorpay({

        key_id: process.env.RAZORPAY_KEY_ID,

        key_secret: process.env.RAZORPAY_KEY_SECRET

    });

}

// =====================================
// CREATE ORDER
// Amount is ALWAYS taken from the booking
// in the database. Client-supplied price
// is never trusted.
// =====================================

router.post("/create-order", auth, async (req, res) => {

    try {

        const { bookingId } = req.body;

        if (!isValidObjectId(bookingId)) {

            return res.status(400).json({

                success: false,

                message: "Invalid booking ID"

            });

        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {

            return res.status(404).json({

                success: false,

                message: "Booking not found"

            });

        }

        // Only the student who owns the booking can pay
        if (
            req.user.role !== "admin" &&
            String(booking.userId) !== String(req.user.id)
        ) {

            return res.status(403).json({

                success: false,

                message: "You are not allowed to pay for this booking"

            });

        }

        // Prevent duplicate payments
        if (booking.paymentStatus === "paid") {

            return res.status(400).json({

                success: false,

                message: "This booking is already paid"

            });

        }

        // Amount always comes from the DB (rent + deposit + booking fee)
        const bookingFee = 1000;
        const rent = Number(booking.price) || 0;
        const deposit = 0; // booking stores rent only

        // Load property for deposit if available
        const Property = require("../models/Property");
        const property = booking.propertyId
            ? await Property.findById(booking.propertyId)
            : null;

        const depositAmount = (property && Number(property.deposit)) || 0;

        const total = Math.round(rent + depositAmount + bookingFee);

        if (total <= 0) {

            return res.status(400).json({

                success: false,

                message: "Unable to compute payment amount for this booking"

            });

        }

        const options = {

            amount: total * 100,

            currency: "INR",

            receipt: "campora_booking_" + booking._id,

            notes: {

                bookingId: String(booking._id),

                propertyName: booking.propertyName || ""

            }

        };

        const order = await getRazorpayClient().orders.create(options);

        res.json({

            success: true,

            order,

            amount: total

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Unable to create payment"

        });

    }

});

// =====================================
// VERIFY PAYMENT
// Only marks booking paid after Razorpay
// signature verification succeeds.
// =====================================

router.post("/verify", auth, async (req, res) => {

    try {

        const {

            bookingId,

            razorpay_order_id,

            razorpay_payment_id,

            razorpay_signature

        } = req.body;

        if (
            !bookingId ||
            !isValidObjectId(bookingId) ||
            !razorpay_order_id ||
            !razorpay_payment_id ||
            !razorpay_signature ||
            !process.env.RAZORPAY_KEY_SECRET
        ) {

            return res.status(400).json({

                success: false,

                message: "Payment verification details are incomplete."

            });

        }

        const body =

            razorpay_order_id +

            "|" +

            razorpay_payment_id;

        const expectedSignature = crypto

            .createHmac(

                "sha256",

                process.env.RAZORPAY_KEY_SECRET

            )

            .update(body)

            .digest("hex");

        if (expectedSignature !== razorpay_signature) {

            return res.status(400).json({

                success: false,

                message: "Invalid Signature"

            });

        }

        const booking = await Booking.findById(bookingId);

        if (!booking) {

            return res.status(404).json({

                success: false,

                message: "Booking not found"

            });

        }

        // Ownership check
        if (
            req.user.role !== "admin" &&
            String(booking.userId) !== String(req.user.id)
        ) {

            return res.status(403).json({

                success: false,

                message: "You are not allowed to confirm payment for this booking"

            });

        }

        // Prevent duplicate payment updates
        if (booking.paymentStatus === "paid") {

            return res.json({

                success: true,

                message: "Payment already verified",

                alreadyPaid: true

            });

        }

        booking.paymentStatus = "paid";

        booking.paymentId = razorpay_payment_id;

        booking.paymentDate = new Date();

        booking.paymentMethod = "UPI";

        await booking.save();

        res.json({

            success: true,

            message: "Payment Verified",

            booking

        });

    }

    catch (err) {

        console.log(err);

        res.status(500).json({

            success: false,

            message: "Verification Failed"

        });

    }

});

module.exports = router;
