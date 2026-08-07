const express = require("express");
const router = express.Router();

const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const otpGenerator = require("otp-generator");

const Otp = require("../models/Otp");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");

// ==========================================
// HELPERS
// ==========================================

const JWT_EXPIRY = "7d";
const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;

function isValidEmail(email) {
    return EMAIL_REGEX.test(email);
}

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
            password,
            code
        } = req.body;

        if (!email || !code) {
            return res.status(400).json({
                success: false,
                message: "Email and OTP are required."
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please provide a valid email address."
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

        // Password is required for registration (password-based account + auto-login)
        if (!password) {
            return res.status(400).json({
                success: false,
                message: "Password is required."
            });
        }
        if (!PASSWORD_REGEX.test(password)) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character."
            });
        }

        const isAdmin = normalizedEmail === process.env.ADMIN_EMAIL || normalizedEmail === "camporaforstudents@gmail.com";
        const finalRole = isAdmin ? "admin" : (role || "student");

        // Hash the password so the account is password-based (and can auto-login)
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // Create user with a hashed password
        user = await User.create({
            name: name.trim(),
            email: normalizedEmail,
            phone: phone || "",
            role: finalRole,
            provider: "local",
            authProvider: "password",
            password: hashedPassword,
            verified: true,
            college: college || "",
            course: course || "",
            year: year || "",
            businessName: businessName || "",
            city: city || "",
            accountStatus: isAdmin ? "ACTIVE" : (finalRole === "owner" ? "PENDING" : "ACTIVE")
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

