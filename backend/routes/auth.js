const express = require("express");
const router = express.Router();

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const otpGenerator = require("otp-generator");
const User = require("../models/User");
const Otp = require("../models/Otp");
const sendEmail = require("../utils/sendEmail");
const auth = require("../middleware/auth");

// ==========================================
// CONSTANTS
// ==========================================

const JWT_EXPIRY = "7d";
const BCRYPT_ROUNDS = 12;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const VALID_ROLES = ["student", "owner"];

// Password policy: min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special char
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;

// OTP security limits shared by /forgot-password, /verify-reset-otp and /reset-password.
const MAX_OTP_ATTEMPTS = 5;         // failed verifications before invalidating the code
const RESEND_COOLDOWN_SECONDS = 30; // must wait before requesting a new code

// The ONLY email allowed to access the admin dashboard.
// Kept in one place so both /login and /admin/login enforce the same rule.
const ADMIN_EMAIL =
    process.env.ADMIN_EMAIL || "camporaforstudents@gmail.com";

function isAdminEmail(email) {
    return email.toLowerCase() === ADMIN_EMAIL.toLowerCase();
}

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
        if (!PASSWORD_REGEX.test(password)) {
            return respondError(res, 400, "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.");
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
        const isAdmin = isAdminEmail(email);

        const user = await User.create({
            name: name.trim(),
            email,
            password: hashedPassword,
            phone: phone || "",
            role: isAdmin ? "admin" : role,
            provider: "local",
            authProvider: "password",
            verified: isAdmin,
            accountStatus: isAdmin ? "ACTIVE" : (role === "owner" ? "PENDING" : "ACTIVE")
        });

        const safeUser = sanitizeUser(user);

        // --- Block pending owners from getting a token immediately ---
        if (user.role === "owner" && user.accountStatus === "PENDING") {
            return respondSuccess(res, 201, "Registration successful. Your account is waiting for admin approval.", {
                user: safeUser,
                role: safeUser.role
            });
        }

        // --- Generate JWT ---
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

// --- Auto-promote admin email to ADMIN role (only the exact admin email) ---
        const isAdmin = isAdminEmail(email);
        if (isAdmin) {
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

// ==========================================
// POST /api/auth/admin/login
// Separate, restricted admin login.
//
// SECURITY RULE (enforced on the backend):
//  - Only the exact admin email may access the admin dashboard.
//  - For ANY other email we return a generic "Unauthorized Admin Access"
//    message and do NOT reveal whether the account exists.
//  - Only after the email check passes do we authenticate the password.
// ==========================================

router.post("/admin/login", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const { password } = req.body;

        // --- Validate email format ---
        if (!email || !isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }

        // --- Admin-only email gate (first, before any auth / existence check) ---
        if (!isAdminEmail(email)) {
            return respondError(res, 403, "Unauthorized Admin Access");
        }

        // --- Validate password ---
        if (!password) {
            return respondError(res, 400, "Password is required.");
        }

        // --- Only the admin email reaches here. Find the admin account. ---
        let admin = await User.findOne({ email });
        if (!admin) {
            // Do not reveal account existence; generic message.
            return respondError(res, 401, "Unauthorized Admin Access");
        }

        // --- Block deactivated admin accounts ---
        if (admin.accountStatus === "BANNED" || admin.accountStatus === "DELETED") {
            return respondError(res, 403, "Your account has been deactivated. Please contact support.");
        }

        // --- Ensure the admin role is set (safe promotion) ---
        if (admin.role !== "admin") {
            admin.role = "admin";
            admin.accountStatus = "ACTIVE";
            admin.verified = true;
            await admin.save();
        }

        // --- If no password is set, create one on first admin login ---
        if (!admin.password) {
            if (password.length < 8) {
                return respondError(res, 400, "Password must be at least 8 characters.");
            }
            admin.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
            admin.authProvider = "password";
            await admin.save();
        }

        // --- Authenticate password securely ---
        const isMatch = await bcrypt.compare(password, admin.password);
        if (!isMatch) {
            return respondError(res, 401, "Incorrect password. Please try again.");
        }

        // --- Update last login ---
        admin.lastLogin = new Date();
        await admin.save();

        // --- Audit log ---
        const logAudit = require("../utils/auditLogger");
        await logAudit({
            userId: admin._id,
            userEmail: admin.email,
            role: "admin",
            action: "ADMIN_LOGIN",
            resource: "Auth",
            req
        });

        const token = generateToken(admin);
        const safeUser = sanitizeUser(admin);

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
// Step 1 of password reset: generate + email an OTP for a registered account.
// Returns a generic success message regardless of whether the email exists
// (prevents account enumeration).
// ==========================================

router.post("/forgot-password", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();

        if (!email || !isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }

        const user = await User.findOne({ email });

        // Generic response to avoid leaking which emails are registered.
        if (!user) {
            return respondSuccess(res, 200, "If an account exists with this email, a reset link has been sent.");
        }

        // Resend cooldown — prevents OTP spam and keeps the flow stable.
        const existingOtp = await Otp.findOne({ email });
        if (existingOtp) {
            const elapsedSeconds = (Date.now() - new Date(existingOtp.lastSentAt).getTime()) / 1000;
            const remaining = Math.ceil(RESEND_COOLDOWN_SECONDS - elapsedSeconds);
            if (remaining > 0) {
                return respondError(res, 429, `Please wait ${remaining}s before requesting a new code.`);
            }
        }

        // Generate a 6-digit OTP
        const code = otpGenerator.generate(6, {
            upperCaseAlphabets: false,
            lowerCaseAlphabets: false,
            specialChars: false,
            digits: true
        });

        // Replace any existing OTP for this email (single active reset)
        await Otp.deleteMany({ email });

        await Otp.create({ email, code, attempts: 0, used: false, lastSentAt: new Date() });

        const html = `
        <div style="font-family:Arial;padding:30px">
            <h2>Campora Password Reset</h2>
            <p>Use the code below to reset your password:</p>
            <div style="font-size:42px;font-weight:bold;color:#2563eb;letter-spacing:8px;margin:25px 0;">
                ${code}
            </div>
            <p>This code is valid for <b>5 minutes</b>.</p>
            <hr>
            <p>If you did not request this, you can safely ignore this email.</p>
        </div>
        `;

        await sendEmail(email, "Campora Password Reset", html);

        return respondSuccess(res, 200, "If an account exists with this email, a reset link has been sent.");

    } catch (err) {
        console.error("Forgot Password Error:", err);
        return respondError(res, 500, err.message || "Unable to send reset code. Please try again.");
    }
});

// ==========================================
// POST /api/auth/verify-reset-otp
// Step 2 of password reset: validate the OTP in isolation, before the user
// is allowed to set a new password. Enforces single-use + max attempts.
// ==========================================

router.post("/verify-reset-otp", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const { code } = req.body;

        if (!email || !isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }
        if (!code) {
            return respondError(res, 400, "OTP code is required.");
        }

        const otp = await Otp.findOne({ email, code });

        if (!otp) {
            // Wrong code — count the failure against the most recent OTP for this email.
            const latest = await Otp.findOne({ email });
            if (latest) {
                latest.attempts = (latest.attempts || 0) + 1;
                await latest.save();
                if (latest.attempts >= MAX_OTP_ATTEMPTS) {
                    await Otp.deleteMany({ email });
                    return respondError(res, 400, "Too many invalid attempts. Please request a new code.");
                }
            }
            return respondError(res, 400, "Invalid or expired OTP. Please request a new code.");
        }

        if (otp.used) {
            return respondError(res, 400, "This OTP has already been used. Please request a new code.");
        }

        // Mark as used now so the reset-password step cannot reuse it.
        otp.used = true;
        otp.attempts = 0;
        await otp.save();

        return respondSuccess(res, 200, "Code verified successfully. You can now set a new password.");

    } catch (err) {
        console.error("Verify Reset OTP Error:", err);
        return respondError(res, 500, err.message || "Unable to verify code. Please try again.");
    }
});

// ==========================================
// POST /api/auth/reset-password
// Step 3 of password reset: verify OTP + set a new password (hashing it).
// ==========================================

router.post("/reset-password", async (req, res) => {
    try {
        const email = req.body.email && req.body.email.toLowerCase().trim();
        const { code, password } = req.body;

        if (!email || !isValidEmail(email)) {
            return respondError(res, 400, "Please provide a valid email address.");
        }
        if (!code) {
            return respondError(res, 400, "OTP code is required.");
        }
        if (!password) {
            return respondError(res, 400, "New password is required.");
        }
        if (!PASSWORD_REGEX.test(password)) {
            return respondError(res, 400, "Password must be at least 8 characters and include an uppercase letter, a lowercase letter, a number and a special character.");
        }

        // Find and validate the OTP (also enforces expiry via TTL index).
        // The OTP must have been marked `used` by verify-reset-otp first,
        // which guarantees the email owner genuinely verified the code.
        const otp = await Otp.findOne({ email, code, used: true });
        if (!otp) {
            return respondError(res, 400, "Invalid or expired OTP. Please verify your code first.");
        }

        const user = await User.findOne({ email });
        if (!user) {
            return respondError(res, 404, "Account not found. Please register first.");
        }

        // Delete used OTP
        await Otp.deleteMany({ email });

        // Hash + set the new password
        user.password = await bcrypt.hash(password, BCRYPT_ROUNDS);
        user.authProvider = "password";
        user.verified = true;
        await user.save();

        return respondSuccess(res, 200, "Password reset successful. You can now log in.");

    } catch (err) {
        console.error("Reset Password Error:", err);
        return respondError(res, 500, err.message || "Unable to reset password. Please try again.");
    }
});

module.exports = router;

