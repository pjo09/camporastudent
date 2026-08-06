const express = require("express");
const router = express.Router();

const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");

const Otp = require("../models/Otp");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// ==========================================
// HELPERS
// ==========================================

const JWT_EXPIRY = "7d";

function generateToken(user) {
    return jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

function sanitizeUser(user) {
    return {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        phone: user.phone || "",
        avatar: user.profileImage || user.avatar || "",
        verified: user.verified || false,
        businessName: user.businessName || "",
        city: user.city || "",
        college: user.college || "",
        course: user.course || "",
        year: user.year || ""
    };
}

// ======================================
// POST /api/otp/send
// ======================================

router.post("/send", async (req, res) => {
    try {
        const { name, email } = req.body;

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Name is required."
            });
        }

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Email is required."
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Generate 6-digit OTP
        const code = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
            digits: true
        });

        // Delete any existing OTPs for this email
        await Otp.deleteMany({ email: normalizedEmail });

        // Save new OTP with 5-minute expiry
        await Otp.create({
            email: normalizedEmail,
            code
        });

        // Email HTML
        const html = `
        <div style="font-family:Arial;padding:30px">
            <h2>Welcome to Campora 👋</h2>
            <p>Your verification code is:</p>
            <div style="
                font-size:42px;
                font-weight:bold;
                color:#2563eb;
                letter-spacing:8px;
                margin:25px 0;
            ">
                ${code}
            </div>
            <p>This OTP is valid for <b>5 minutes</b>.</p>
            <hr>
            <p>If you did not request this email, simply ignore it.</p>
        </div>
        `;

        await sendEmail(
            normalizedEmail,
            "Campora Email Verification",
            html
        );

        return res.json({
            success: true,
            message: "OTP sent successfully."
        });

    } catch (err) {
        console.error("Send OTP Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Unable to send OTP."
        });
    }
});

// ======================================
// POST /api/otp/verify
// ======================================

router.post("/verify", async (req, res) => {
    try {
        const {
            type,
            name,
            email,
            phone,
            role,
            college,
            course,
            year,
            businessName,
            city,
            code
        } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Find valid OTP
        const otp = await Otp.findOne({
            email: normalizedEmail,
            code
        });

        if (!otp) {
            return res.status(400).json({
                success: false,
                message: "Invalid or expired OTP."
            });
        }

        // Delete used OTP
        await Otp.deleteMany({ email: normalizedEmail });

        let user = await User.findOne({ email: normalizedEmail });

        // ================================
        // OTP LOGIN
        // ================================
        if (type === "login") {
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: "Account not found. Please register first."
                });
            }

            // Block deleted / banned accounts
            if (user.accountStatus === "BANNED" || user.accountStatus === "DELETED") {
                return res.status(403).json({
                    success: false,
                    message: "Your account has been deactivated. Please contact support."
                });
            }

            // Pending owners cannot log in until approved
            if (user.role === "owner" && user.accountStatus === "PENDING") {
                return res.status(403).json({
                    success: false,
                    message: "Your account is waiting for admin approval."
                });
            }

            user.verified = true;
            user.lastLogin = new Date();
            await user.save();

            const token = generateToken(user);

            return res.json({
                success: true,
                message: "Login successful.",
                token,
                user: sanitizeUser(user)
            });
        }

        // ================================
        // OTP REGISTER
        // ================================

        if (user) {
            return res.status(409).json({
                success: false,
                message: "An account with this email already exists."
            });
        }

        if (!name || !name.trim()) {
            return res.status(400).json({
                success: false,
                message: "Name is required for registration."
            });
        }

        const isAdminEmail = normalizedEmail === process.env.ADMIN_EMAIL || normalizedEmail === "camporaforstudents@gmail.com";
        const finalRole = isAdminEmail ? "admin" : (role || "student");

        // Create user WITHOUT password (OTP-only users login via OTP)
        user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone || "",
            role: finalRole,
            provider: "local",
            authProvider: "otp",
            password: null,
            verified: true,
            college: college || "",
            course: course || "",
            year: year || "",
            businessName: businessName || "",
            city: city || "",
            accountStatus: isAdminEmail ? "ACTIVE" : (finalRole === "owner" ? "PENDING" : "ACTIVE")
        });

        // Block pending owners from getting a token immediately
        if (user.role === "owner" && user.accountStatus === "PENDING") {
            return res.status(201).json({
                success: true,
                message: "Registration successful. Your account is waiting for admin approval.",
                user: sanitizeUser(user)
            });
        }

        const token = generateToken(user);

        return res.status(201).json({
            success: true,
            message: "Registration successful.",
            token,
            user: sanitizeUser(user)
        });

    } catch (err) {
        console.error("Verify OTP Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Verification failed."
        });
    }
});

module.exports = router;

