// ===============================================
// CAMPORA GOOGLE AUTH
// ===============================================

const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const User = require("../models/User");

const router = express.Router();

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

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

// ===============================================
// POST /api/auth/google
// Google Login / Register
// ===============================================

router.post("/", async (req, res) => {
    try {
        const { credential, role } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential missing."
            });
        }

        // Verify Google ID token on the server (never trust frontend)
        const ticket = await client.verifyIdToken({
            idToken: credential,
            audience: process.env.GOOGLE_CLIENT_ID
        });

        const payload = ticket.getPayload();
        const { sub, email, name, picture } = payload;

        if (!email) {
            return res.status(400).json({
                success: false,
                message: "Google account must have an email address."
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists by email
        let user = await User.findOne({ email: normalizedEmail });
        let isNewUser = false;

        if (user) {
            // Existing user — update Google ID and avatar if needed
            if (!user.googleId) {
                user.googleId = sub;
            }
            if (picture && !user.profileImage) {
                user.profileImage = picture;
            }
            user.lastLogin = new Date();
            await user.save();
        } else {
            // New user — create account
            isNewUser = true;
            const validRole = (role && ["student", "owner"].includes(role))
                ? role
                : "student";

            const isAdminEmail = normalizedEmail === process.env.ADMIN_EMAIL || normalizedEmail === "camporaforstudents@gmail.com";
            const finalRole = isAdminEmail ? "admin" : validRole;

            user = await User.create({
                name: name || "Google User",
                email: normalizedEmail,
                avatar: picture || "",
                profileImage: picture || "",
                googleId: sub,
                provider: "google",
                authProvider: "google",
                password: null,
                role: finalRole,
                verified: true,
                accountStatus: isAdminEmail ? "ACTIVE" : (finalRole === "owner" ? "PENDING" : "ACTIVE")
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

        // Generate JWT
        const token = generateToken(user);
        const safeUser = sanitizeUser(user);

        return res.json({
            success: true,
            message: !isNewUser ? "Login successful." : "Registration successful.",
            token,
            user: safeUser,
            role: safeUser.role,
            data: {
                token,
                user: safeUser,
                role: safeUser.role
            }
        });

    } catch (err) {
        console.error("Google Auth Error:", err);
        return res.status(500).json({
            success: false,
            message: "Google authentication failed."
        });
    }
});

module.exports = router;
