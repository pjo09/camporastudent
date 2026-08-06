const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

// ==========================================
// CONSTANTS
// ==========================================

const JWT_EXPIRY = "7d";
const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["student", "owner"];

// ==========================================
// HELPERS
// ==========================================

/**
 * Generate a JWT for the given user document.
 * Payload contains { id, email, role }.
 * Expires in 7 days.
 */
function generateToken(user) {
    return jwt.sign(
        { id: user._id, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

/**
 * Strip sensitive / internal fields and return a safe user object.
 */
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

/**
 * Standardized success response builder.
 * Also keeps root-level `token` and `user` for frontend backward compatibility.
 */
function respondSuccess(res, statusCode, message, data = null) {
    const response = { success: true, message };

    if (data) {
        response.data = data;
        // Flat fields for backward compatibility with existing frontend code
        if (data.token) response.token = data.token;
        if (data.user) response.user = data.user;
        if (data.role) response.role = data.role;
    }

    return res.status(statusCode).json(response);
}

/**
 * Standardized error response builder.
 */
function respondError(res, statusCode, message) {
    return res.status(statusCode).json({
        success: false,
        message
    });
}

/**
 * Validate email format.
 */
function isValidEmail(email) {
    return EMAIL_REGEX.test(email);
}

// ==========================================
// POST /api/auth/register
// ==========================================

router.post("/register", async (req, res) => {
    try {
        const { name, password, phone } = req.body;
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const role = req.body.role || "student";

        // --- Validate name ---
        if (!name || !name.trim()) {
            return respondError(res, 400, "Full name is required.");
        }
        if (name.trim().length < 2) {
            return respondError(res, 400, "Name must be at least 2 characters.");
        }

        // --- Validate email ---
        if (!email) {
            return respondError(res, 400, "Email address is required.");
        }
        if (!isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }

        // --- Validate password ---
        if (!password) {
            return respondError(res, 400, "Password is required.");
        }
        if (password.length < 6) {
            return respondError(res, 400, "Password must be at least 6 characters.");
        }
        if (password.length > 128) {
            return respondError(res, 400, "Password must not exceed 128 characters.");
        }

        // --- Validate role ---
        if (!VALID_ROLES.includes(role)) {
            return respondError(res, 400, "Role must be 'student' or 'owner'.");
        }

        // --- Validate phone (optional but format-check when provided) ---
        if (phone && typeof phone === "string" && phone.trim()) {
            const digitsOnly = phone.replace(/\D/g, "");
            if (digitsOnly.length < 10) {
                return respondError(res, 400, "Please provide a valid phone number with at least 10 digits.");
            }
        }

        // --- Check for existing user ---
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return respondError(res, 409, "An account with this email already exists.");
        }

        // --- Hash password ---
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

// --- Create user ---
        const isAdminEmail = email === process.env.ADMIN_EMAIL || email === "camporaforstudents@gmail.com";

        const user = await User.create({
            name: name.trim(),
            email,
            password: hashedPassword,
            phone: phone || "",
            role: isAdminEmail ? "admin" : role,
            provider: "local",
            authProvider: "password",
            verified: isAdminEmail,
            accountStatus: isAdminEmail ? "ACTIVE" : (role === "owner" ? "PENDING" : "ACTIVE")
        });

        // --- Generate JWT ---
        const token = generateToken(user);
        const safeUser = sanitizeUser(user);

        return respondSuccess(res, 201, "Registration successful.", {
            token,
            user: safeUser,
            role: safeUser.role
        });

    } catch (err) {
        console.error("Register Error:", err);
        return respondError(res, 500, err.message || "Registration failed. Please try again.");
    }
});

// ==========================================
// POST /api/auth/login
// ==========================================

router.post("/login", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const { password } = req.body;

        // --- Validate email ---
        if (!email) {
            return respondError(res, 400, "Email address is required.");
        }
        if (!isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }

        // --- Validate password ---
        if (!password) {
            return respondError(res, 400, "Password is required.");
        }

// --- Find user ---
        let user = await User.findOne({ email });
        if (!user) {
            return respondError(res, 401, "No account found with this email address.");
        }

        // --- Auto-promote admin email to ADMIN role ---
        const isAdminEmail = email === process.env.ADMIN_EMAIL || email === "camporaforstudents@gmail.com";
        if (isAdminEmail) {
            user.role = "admin";
            user.accountStatus = "ACTIVE";
            user.verified = true;
            if (!user.password && password) {
                user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
            }
            await user.save();
        }

        // --- Block deleted / banned accounts ---
        if (user.accountStatus === "BANNED" || user.accountStatus === "DELETED") {
            return respondError(res, 403, "Your account has been deactivated. Please contact support.");
        }

        // --- Pending owners cannot log in until approved ---
        if (user.role === "owner" && user.accountStatus === "PENDING") {
            return respondError(res, 403, "Your account is waiting for admin approval.");
        }

        // --- Check if password-based login is possible ---
        if (!user.password) {
            const providerMsg = user.authProvider === "google"
                ? "This account uses Google sign-in. Please use Google login."
                : "This account was created via OTP. Please use OTP login or reset your password.";
            return respondError(res, 400, providerMsg);
        }

        // --- Verify password ---
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return respondError(res, 401, "Incorrect password. Please try again.");
        }

        // --- Update last login timestamp ---
        user.lastLogin = new Date();
        await user.save();

        if (user.role === "admin") {
            const logAudit = require("../utils/auditLogger");
            await logAudit({
                userId: user._id,
                userEmail: user.email,
                role: "admin",
                action: "ADMIN_LOGIN",
                resource: "Auth",
                req
            });
        }

        // --- Generate JWT ---
        const token = generateToken(user);
        const safeUser = sanitizeUser(user);

        return respondSuccess(res, 200, "Login successful.", {
            token,
            user: safeUser,
            role: safeUser.role
        });

    } catch (err) {
        console.error("Login Error:", err);
        return respondError(res, 500, err.message || "Login failed. Please try again.");
    }
});

// ==========================================
// GET /api/auth/me
// Protected — requires valid JWT.
// Returns current authenticated user profile.
// ==========================================

router.get("/me", auth, async (req, res) => {
    try {
        const user = await User.findById(req.user.id).select("-password");
        if (!user) {
            return respondError(res, 404, "User not found. Your account may have been deleted.");
        }

        const safeUser = sanitizeUser(user);

        return respondSuccess(res, 200, "User profile fetched successfully.", {
            user: safeUser,
            role: safeUser.role
        });

    } catch (err) {
        console.error("Get Profile Error:", err);
        return respondError(res, 500, err.message || "Failed to fetch user profile.");
    }
});

module.exports = router;

