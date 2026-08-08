const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const User = require("../models/User");
const Otp = require("../models/Otp");
const auth = require("../middleware/auth");
const sendEmail = require("../utils/sendEmail");

// ==========================================
// CONSTANTS
// ==========================================

const JWT_EXPIRY = "7d";
const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Strong password: 8-128 chars, at least 1 uppercase, 1 lowercase,
// 1 number, 1 special character.
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;
const VALID_ROLES = ["student", "owner"];
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || "camporaforstudents@gmail.com").toLowerCase().trim();

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

/**
 * Validate a strong password.
 * Returns an error string or null if valid.
 */
function validatePassword(password) {
    if (!password) return "Password is required.";
    if (typeof password !== "string") return "Password must be a string.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (password.length > 128) return "Password must not exceed 128 characters.";
    if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
    if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
    if (!/\d/.test(password)) return "Password must include a number.";
    if (!/[^A-Za-z0-9\s]/.test(password)) return "Password must include a special character.";
    return null;
}

/**
 * Returns true if the email is allowed to be an administrator.
 */
function isAdminEmail(email) {
    return email === ADMIN_EMAIL;
}

// ==========================================
// POST /api/auth/register
// Password-based registration (no OTP).
// ==========================================

router.post("/register", async (req, res) => {
    try {
        const { name, password, phone } = req.body;
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const role = req.body.role || "student";
        const businessName = req.body.businessName && req.body.businessName.trim();
        const city = req.body.city && req.body.city.trim();

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

        // --- Validate password (backend is authoritative) ---
        const passwordError = validatePassword(password);
        if (passwordError) {
            return respondError(res, 400, passwordError);
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

        // --- Check amdin email cannot self-register via public registration ---
        // (Admin accounts are provisioned separately. Public register restricted.)
        if (isAdminEmail(email)) {
            return respondError(res, 403, "This email is reserved. Please use the Admin Login portal.");
        }

        // --- Check for existing user ---
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return respondError(res, 409, "An account with this email already exists.");
        }

        // --- Hash password ---
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);

        // --- Create user ---
        const user = await User.create({
            name: name.trim(),
            email,
            password: hashedPassword,
            phone: phone || "",
            role,
            provider: "local",
            authProvider: "password",
            businessName: role === "owner" ? (businessName || "") : "",
            city: role === "owner" ? (city || "") : "",
            verified: false,
            accountStatus: role === "owner" ? "PENDING" : "ACTIVE"
        });

        const safeUser = sanitizeUser(user);

        // --- Block pending owners from getting a token immediately ---
        if (user.role === "owner" && user.accountStatus === "PENDING") {
            return respondSuccess(res, 201, "Registration successful. Your account is waiting for admin approval.", {
                user: safeUser,
                role: safeUser.role
            });
        }

        // --- Generate JWT (auto-login) ---
        const token = generateToken(user);

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
        if (isAdminEmail(email)) {
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
                : user.authProvider === "otp"
                    ? "This account uses OTP login. Please use OTP login or reset your password."
                    : "This account has no password set. Please reset your password.";
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
// POST /api/auth/admin/login
// Separate admin login. Backend-enforced email restriction.
// ==========================================

router.post("/admin/login", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const { password } = req.body;

        // --- Validate email format ---
        if (!email) {
            return respondError(res, 400, "Email address is required.");
        }
        if (!isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }

        // --- Enforce admin email restriction on the BACKEND ---
        // Only the whitelisted admin email may access the admin dashboard.
        // For any other email return a generic message WITHOUT revealing
        // whether the account exists.
        if (!isAdminEmail(email)) {
            return respondError(res, 403, "Unauthorized Admin Access");
        }

        // --- Validate password ---
        if (!password) {
            return respondError(res, 400, "Password is required.");
        }

        // --- Find user ---
        let user = await User.findOne({ email });
        if (!user) {
            // Admin not provisioned yet — create securely with the provided password,
            // then authenticate. This keeps the flow self-contained.
            user = await User.create({
                name: "Campora Admin",
                email,
                password: await bcrypt.hash(password, BCRYPT_ROUNDS),
                role: "admin",
                provider: "local",
                authProvider: "password",
                verified: true,
                accountStatus: "ACTIVE"
            });
            user.lastLogin = new Date();
            await user.save();
            const logAudit = require("../utils/auditLogger");
            await logAudit({
                userId: user._id,
                userEmail: user.email,
                role: "admin",
                action: "ADMIN_LOGIN",
                resource: "Auth",
                req
            });
            const token = generateToken(user);
            const safeUser = sanitizeUser(user);
            return respondSuccess(res, 200, "Admin login successful.", {
                token,
                user: safeUser,
                role: "admin"
            });
        }

        // --- Force admin role for the whitelisted email ---
        user.role = "admin";
        user.accountStatus = "ACTIVE";
        user.verified = true;

        // --- Set password if missing (e.g. created via OTP/Google) ---
        if (!user.password) {
            user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        }
        await user.save();

        // --- Verify password ---
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return respondError(res, 401, "Incorrect password. Please try again.");
        }

        // --- Update last login + audit ---
        user.lastLogin = new Date();
        await user.save();
        const logAudit = require("../utils/auditLogger");
        await logAudit({
            userId: user._id,
            userEmail: user.email,
            role: "admin",
            action: "ADMIN_LOGIN",
            resource: "Auth",
            req
        });

        // --- Generate JWT ---
        const token = generateToken(user);
        const safeUser = sanitizeUser(user);

        return respondSuccess(res, 200, "Admin login successful.", {
            token,
            user: safeUser,
            role: "admin"
        });

    } catch (err) {
        console.error("Admin Login Error:", err);
        return respondError(res, 500, err.message || "Admin login failed. Please try again.");
    }
});

// ==========================================
// POST /api/auth/forgot-password
// Step 1: request a reset code (OTP) for the email.
// Always returns a generic success message (do not reveal account existence).
// ==========================================

router.post("/forgot-password", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();

        if (!email) {
            return respondError(res, 400, "Email address is required.");
        }
        if (!isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }

        const user = await User.findOne({ email });

        // Only send a code if an account exists. For non-existing accounts,
        // return the same generic success to avoid user enumeration.
        if (user) {
            if (user.accountStatus === "BANNED" || user.accountStatus === "DELETED") {
                return respondSuccess(res, 200, "If an account exists, a reset code has been sent to your email.");
            }

            // Generate 6-digit OTP
            const code = otpGenerator.generate(6, {
                upperCaseAlphabets: false,
                lowerCaseAlphabets: false,
                specialChars: false,
                digits: true
            });

            // Remove any existing OTPs
            await Otp.deleteMany({ email });

            // Save new OTP (TTL index auto-expires after 300s = 5 min)
            await Otp.create({ email, code });

            // Send the reset email
            const html = `
            <div style="font-family:Arial;padding:30px">
                <h2>Campora Password Reset 🔐</h2>
                <p>We received a request to reset your password. Use the code below:</p>
                <div style="font-size:42px;font-weight:bold;color:#2563eb;letter-spacing:8px;margin:25px 0;">
                    ${code}
                </div>
                <p>This code is valid for <b>5 minutes</b>.</p>
                <p>If you did not request this, you can safely ignore this email.</p>
                <hr>
                <p>Campora &middot; Find Your Campus Home</p>
            </div>
            `;

            await sendEmail(email, "Campora Password Reset Code", html);
        }

        return respondSuccess(res, 200, "If an account exists, a reset code has been sent to your email.");

    } catch (err) {
        console.error("Forgot Password Error:", err);
        // Never reveal email existence even on internal errors.
        return respondSuccess(res, 200, "If an account exists, a reset code has been sent to your email.");
    }
});

// ==========================================
// POST /api/auth/verify-reset-otp
// Step 2: verify the reset code before allowing a new password.
// ==========================================

router.post("/verify-reset-otp", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const { code } = req.body;

        if (!email || !isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }
        if (!code || typeof code !== "string" || code.length !== 6) {
            return respondError(res, 400, "Please enter the 6-digit code.");
        }

        const otp = await Otp.findOne({ email, code });
        if (!otp) {
            return respondError(res, 400, "Invalid or expired code. Please try again.");
        }

        // Do not delete the OTP here — step 3 (reset-password) will consume it.
        return respondSuccess(res, 200, "Code verified.");

    } catch (err) {
        console.error("Verify Reset OTP Error:", err);
        return respondError(res, 500, "Unable to verify the code. Please try again.");
    }
});

// ==========================================
// POST /api/auth/reset-password
// Step 3: consume the valid OTP and set a new strong password.
// ==========================================

router.post("/reset-password", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const { code } = req.body;
        const { password } = req.body;

        if (!email || !isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }
        if (!code || typeof code !== "string" || code.length !== 6) {
            return respondError(res, 400, "Please enter the 6-digit code.");
        }

        // Validate new password strength on backend
        const passwordError = validatePassword(password);
        if (passwordError) {
            return respondError(res, 400, passwordError);
        }

        // Verify the OTP still exists and matches
        const otp = await Otp.findOne({ email, code });
        if (!otp) {
            return respondError(res, 400, "Invalid or expired code. Please request a new one.");
        }

        const user = await User.findOne({ email });
        if (!user) {
            return respondError(res, 404, "Account not found. Please register first.");
        }

        if (user.accountStatus === "BANNED" || user.accountStatus === "DELETED") {
            return respondError(res, 403, "Your account has been deactivated. Please contact support.");
        }

        // Hash and set the new password
        const hashedPassword = await bcrypt.hash(password, BCRYPT_ROUNDS);
        user.password = hashedPassword;
        user.authProvider = user.authProvider === "otp" ? "password" : user.authProvider;
        await user.save();

        // Consume the OTP
        await Otp.deleteMany({ email });

        return respondSuccess(res, 200, "Password reset successful. Please log in with your new password.");

    } catch (err) {
        console.error("Reset Password Error:", err);
        return respondError(res, 500, "Unable to reset your password. Please try again.");
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

