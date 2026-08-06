// ======================================================
// CAMPORA STUDENT FINANCE ROUTES
// Invoices, payments, receipts
// ======================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");
const Invoice = require("../models/Invoice");
const Booking = require("../models/Booking");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ======================================================
// STUDENT AUTH
// ======================================================

router.use(auth);
router.use(requireRole("student"));

// ======================================================
// LIST MY INVOICES
// ======================================================

router.get("/invoices", async (req, res) => {
    try {
        const { status } = req.query;
        const filter = { studentId: req.user.id };

        if (status) filter.status = status;

        const invoices = await Invoice.find(filter)
            .populate("propertyId", "propertyName city state address")
            .populate("ownerId", "name businessName email phone")
            .sort({ createdAt: -1 });

        return res.json({ success: true, total: invoices.length, invoices });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// GET SINGLE INVOICE
// ======================================================

router.get("/invoices/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) {
            return res.status(400).json({ success: false, message: "Invalid ID" });
        }

        const invoice = await Invoice.findOne({
            _id: req.params.id,
            studentId: req.user.id,
        })
            .populate("propertyId", "propertyName city state address")
            .populate("ownerId", "name businessName email phone");

        if (!invoice) {
            return res.status(404).json({ success: false, message: "Invoice not found" });
        }

        return res.json({ success: true, invoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// PAYMENT SUMMARY
// ======================================================

router.get("/summary", async (req, res) => {
    try {
        const studentId = req.user.id;
        const invoices = await Invoice.find({ studentId });

        let totalDue = 0;
        let totalPaid = 0;
        let pendingCount = 0;
        let overdueCount = 0;
        let paidCount = 0;
        let refundedCount = 0;

        invoices.forEach((inv) => {
            const outstanding = inv.totalAmount - inv.amountPaid;
            if (inv.status === "paid") {
                totalPaid += inv.totalAmount;
                paidCount++;
            } else if (inv.status === "refunded") {
                refundedCount++;
            } else {
                totalDue += outstanding;
                if (inv.status === "overdue") overdueCount++;
                else pendingCount++;
            }
        });

        // Payment history (transactions)
        const transactions = [];
        invoices.forEach((inv) => {
            inv.transactions.forEach((t) => {
                transactions.push({
                    invoiceId: inv._id,
                    invoiceNumber: inv.invoiceNumber,
                    amount: t.amount,
                    method: t.method,
                    transactionId: t.transactionId,
                    paidAt: t.paidAt,
                    note: t.note,
                });
            });
        });
        transactions.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

        // Monthly spending for chart
        const monthly = {};
        transactions.forEach((t) => {
            const d = new Date(t.paidAt);
            const key = `${d.getFullYear()}-${d.getMonth() + 1}`;
            monthly[key] = (monthly[key] || 0) + t.amount;
        });

        return res.json({
            success: true,
            summary: {
                totalDue,
                totalPaid,
                pendingCount,
                overdueCount,
                paidCount,
                refundedCount,
            },
            transactions,
            monthly,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// PAYMENT HISTORY (transaction-only)
// ======================================================

router.get("/payments", async (req, res) => {
    try {
        const { status, method } = req.query;
        const filter = { studentId: req.user.id };

        if (status) filter.status = status;
        if (method) filter.paymentMethod = method;

        const invoices = await Invoice.find(filter)
            .populate("propertyId", "propertyName city")
            .sort({ createdAt: -1 });

        return res.json({ success: true, total: invoices.length, invoices });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
