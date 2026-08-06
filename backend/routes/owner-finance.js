// ======================================================
// CAMPORA OWNER FINANCE ROUTES
// Invoices, rent tracking, transactions
// ======================================================

const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");

const auth = require("../middleware/auth");
const User = require("../models/User");
const Property = require("../models/Property");
const Booking = require("../models/Booking");
const Invoice = require("../models/Invoice");
const Notification = require("../models/Notification");

function isValidObjectId(id) {
    return mongoose.Types.ObjectId.isValid(id);
}

// ======================================================
// OWNER AUTH
// ======================================================

router.use(auth);

router.use(async (req, res, next) => {
    try {
        const owner = await User.findById(req.user.id);
        if (!owner) return res.status(404).json({ success: false, message: "User not found" });
        if (owner.role !== "owner") return res.status(403).json({ success: false, message: "Only PG Owners can access this route" });
        req.owner = owner;
        return next();
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// Generate a unique invoice number
function generateInvoiceNumber(ownerId) {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `INV-${String(ownerId).slice(-4).toUpperCase()}-${ts}-${rand}`;
}

// ======================================================
// LIST INVOICES
// ======================================================

router.get("/invoices", async (req, res) => {
    try {
        const { status, studentId, propertyId } = req.query;
        const filter = { ownerId: req.owner._id };

        if (status) filter.status = status;
        if (studentId) filter.studentId = studentId;
        if (propertyId) filter.propertyId = propertyId;

        const invoices = await Invoice.find(filter)
            .populate("studentId", "name email phone")
            .populate("propertyId", "propertyName city")
            .sort({ createdAt: -1 });

        return res.json({ success: true, total: invoices.length, invoices });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// CREATE INVOICE (billing a student)
// ======================================================

router.post("/invoices", async (req, res) => {
    try {
        const { studentId, propertyId, bookingId, periodFrom, periodTo, dueDate,
            rentAmount, maintenanceCharge, electricityCharge, foodCharge, otherCharges, discount, notes } = req.body;

        if (!studentId || !propertyId) return res.status(400).json({ success: false, message: "studentId and propertyId are required" });
        if (!periodFrom || !periodTo || !dueDate) return res.status(400).json({ success: false, message: "Billing period and due date are required" });
        if (!rentAmount || Number(rentAmount) <= 0) return res.status(400).json({ success: false, message: "Valid rent amount is required" });

        const property = await Property.findOne({ _id: propertyId, owner: req.owner._id });
        if (!property) return res.status(404).json({ success: false, message: "Property not found" });

        const totalAmount = Number(rentAmount) + Number(maintenanceCharge || 0) + Number(electricityCharge || 0) + Number(foodCharge || 0) + Number(otherCharges || 0) - Number(discount || 0);

        const invoice = await Invoice.create({
            ownerId: req.owner._id,
            studentId,
            propertyId,
            bookingId: bookingId || null,
            invoiceNumber: generateInvoiceNumber(req.owner._id),
            periodFrom: new Date(periodFrom),
            periodTo: new Date(periodTo),
            dueDate: new Date(dueDate),
            rentAmount: Number(rentAmount),
            maintenanceCharge: Number(maintenanceCharge || 0),
            electricityCharge: Number(electricityCharge || 0),
            foodCharge: Number(foodCharge || 0),
            otherCharges: Number(otherCharges || 0),
            discount: Number(discount || 0),
            totalAmount: Math.max(totalAmount, 0),
            status: "pending",
            notes: notes || ""
        });

        try {
            await Notification.create({
                receiverId: studentId,
                title: "New Rent Invoice",
                message: `Invoice ${invoice.invoiceNumber} of ₹${invoice.totalAmount} is due on ${new Date(invoice.dueDate).toLocaleDateString()}.`,
                type: "payment"
            });
        } catch (e) { /* non-fatal */ }

        return res.status(201).json({ success: true, invoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// GET SINGLE INVOICE
// ======================================================

router.get("/invoices/:id", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const invoice = await Invoice.findOne({ _id: req.params.id, ownerId: req.owner._id })
            .populate("studentId", "name email phone")
            .populate("propertyId", "propertyName city address");
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });
        return res.json({ success: true, invoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// RECORD PAYMENT (mark paid / partial)
// ======================================================

router.post("/invoices/:id/pay", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const invoice = await Invoice.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        const { amount, method, transactionId, note } = req.body;
        const payAmount = Number(amount);
        if (!payAmount || payAmount <= 0) return res.status(400).json({ success: false, message: "Valid amount is required" });

        const remaining = invoice.totalAmount - invoice.amountPaid;
        const applied = Math.min(payAmount, remaining);

        invoice.amountPaid += applied;
        invoice.transactions.push({
            amount: applied,
            method: method || "Cash",
            transactionId: transactionId || "",
            note: note || ""
        });

        if (invoice.amountPaid >= invoice.totalAmount) {
            invoice.status = "paid";
            invoice.paidAt = new Date();
            invoice.paymentMethod = method || "Cash";
            invoice.transactionId = transactionId || "";
        } else if (invoice.amountPaid > 0) {
            invoice.status = "partial";
        }

        await invoice.save();

        return res.json({ success: true, invoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// MARK INVOICE OVERDUE (manual)
// ======================================================

router.patch("/invoices/:id/overdue", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const invoice = await Invoice.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        if (invoice.status !== "paid") invoice.status = "overdue";
        await invoice.save();

        return res.json({ success: true, invoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// CANCEL INVOICE
// ======================================================

router.patch("/invoices/:id/cancel", async (req, res) => {
    try {
        if (!isValidObjectId(req.params.id)) return res.status(400).json({ success: false, message: "Invalid ID" });
        const invoice = await Invoice.findOne({ _id: req.params.id, ownerId: req.owner._id });
        if (!invoice) return res.status(404).json({ success: false, message: "Invoice not found" });

        invoice.status = "cancelled";
        await invoice.save();

        return res.json({ success: true, invoice });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

// ======================================================
// FINANCE SUMMARY
// ======================================================

router.get("/summary", async (req, res) => {
    try {
        const ownerId = req.owner._id;

        // Total expected (pending+overdue+partial)
        const invoices = await Invoice.find({ ownerId, status: { $in: ["pending", "partial", "overdue"] } });
        const paidInvoices = await Invoice.find({ ownerId, status: "paid" });

        const totalOutstanding = invoices.reduce((s, i) => s + (i.totalAmount - i.amountPaid), 0);
        const totalCollected = paidInvoices.reduce((s, i) => s + i.totalAmount, 0);
        const totalPaidCount = paidInvoices.length;
        const pendingCount = invoices.filter(i => i.status === "pending").length;
        const overdueCount = invoices.filter(i => i.status === "overdue").length;
        const partialCount = invoices.filter(i => i.status === "partial").length;

        // All transactions
        const allInvoices = await Invoice.find({ ownerId });
        const transactions = [];
        allInvoices.forEach(inv => {
            inv.transactions.forEach(t => {
                transactions.push({
                    invoiceId: inv._id,
                    invoiceNumber: inv.invoiceNumber,
                    studentId: inv.studentId,
                    amount: t.amount,
                    method: t.method,
                    transactionId: t.transactionId,
                    paidAt: t.paidAt,
                    note: t.note
                });
            });
        });
        transactions.sort((a, b) => new Date(b.paidAt) - new Date(a.paidAt));

        return res.json({
            success: true,
            summary: {
                totalOutstanding,
                totalCollected,
                totalPaidCount,
                pendingCount,
                overdueCount,
                partialCount
            },
            transactions
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
