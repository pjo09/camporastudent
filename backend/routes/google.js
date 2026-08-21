// ===============================================
// CAMPORA GOOGLE AUTH
// ===============================================

const express = require("express");
const jwt = require("jsonwebtoken");
const { OAuth2Client } = require("google-auth-library");
const userRepository = require("../repositories/userRepository");

const router = express.Router();

const client = new OAuth2Client(
    process.env.GOOGLE_CLIENT_ID
);

// ==========================================
// HELPERS
// ==========================================

const JWT_EXPIRY = "7d";

function generateToken(user) {
    const userId = user.id || user._id;
    return jwt.sign(
        { id: userId, email: user.email, role: user.role },
        process.env.JWT_SECRET,
        { expiresIn: JWT_EXPIRY }
    );
}

function sanitizeUser(user) {
    const userId = user.id || user._id;
    return {
        id: userId,
        _id: userId,
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
    let currentStage = "GOOGLE_CONFIG";
    try {
        const { credential, role } = req.body;

        if (!credential) {
            return res.status(400).json({
                success: false,
                message: "Google credential missing."
            });
        }

        // Validate GOOGLE_CLIENT_ID configuration on server
        const clientId = process.env.GOOGLE_CLIENT_ID;
        const isValidFormat = typeof clientId === "string" &&
                              clientId.trim().length > 0 &&
                              clientId.endsWith(".apps.googleusercontent.com") &&
                              !clientId.startsWith("mongodb");

        if (!isValidFormat) {
            console.error("[GOOGLE_AUTH_STAGE] Config invalid:", {
                stage: "GOOGLE_CONFIG",
                clientIdPresent: !!clientId,
                validFormat: isValidFormat
            });
            res.setHeader("X-Campora-Google-Stage", "GOOGLE_CONFIG");
            return res.status(500).json({
                success: false,
                message: "Google authentication is not configured correctly on the server.",
                errorCode: "GOOGLE_CONFIG_ERROR"
            });
        }

        // Verify Google ID token on the server (never trust frontend)
        currentStage = "GOOGLE_VERIFY";
        let ticket;
        try {
            ticket = await client.verifyIdToken({
                idToken: credential,
                audience: clientId
            });
        } catch (verifyErr) {
            console.error("[GOOGLE_AUTH_STAGE] Verification failed:", {
                stage: "GOOGLE_VERIFY",
                name: verifyErr?.name,
                message: verifyErr?.message
            });
            res.setHeader("X-Campora-Google-Stage", "GOOGLE_VERIFY");
            return res.status(401).json({
                success: false,
                message: "Google authentication failed.",
                errorCode: "GOOGLE_TOKEN_INVALID"
            });
        }

        currentStage = "GOOGLE_PAYLOAD";
        const payload = ticket.getPayload();
        if (!payload) {
            console.error("[GOOGLE_AUTH_STAGE] Payload missing");
            res.setHeader("X-Campora-Google-Stage", "GOOGLE_PAYLOAD");
            return res.status(400).json({
                success: false,
                message: "Google account must have a valid payload.",
                errorCode: "GOOGLE_PAYLOAD_INVALID"
            });
        }

        const { sub, email, name, picture } = payload;

        if (!email) {
            console.error("[GOOGLE_AUTH_STAGE] Email missing from payload");
            res.setHeader("X-Campora-Google-Stage", "GOOGLE_PAYLOAD");
            return res.status(400).json({
                success: false,
                message: "Google account must have an email address.",
                errorCode: "GOOGLE_PAYLOAD_INVALID"
            });
        }

        const normalizedEmail = email.toLowerCase().trim();

        // Check if user exists by email via repository
        currentStage = "USER_LOOKUP";
        let user;
        try {
            user = await userRepository.findUserByEmail(normalizedEmail);
        } catch (lookupErr) {
            console.error("[GOOGLE_AUTH_STAGE] DB Lookup failed:", {
                stage: "USER_LOOKUP",
                name: lookupErr?.name,
                message: lookupErr?.message,
                code: lookupErr?.code
            });
            res.setHeader("X-Campora-Google-Stage", "USER_LOOKUP");
            return res.status(500).json({
                success: false,
                message: "Google authentication failed.",
                errorCode: "GOOGLE_USER_LOOKUP_FAILED"
            });
        }

        let isNewUser = false;

        if (user) {
            currentStage = "USER_UPDATE";
            try {
                // Existing user — update Google ID and avatar if needed
                const userId = user.id || user._id;
                user = await userRepository.updateUser(userId, {
                    googleId: sub,
                    profileImage: picture || user.profileImage || user.avatar
                }) || user;
            } catch (updateErr) {
                console.error("[GOOGLE_AUTH_STAGE] User update failed:", {
                    stage: "USER_UPDATE",
                    name: updateErr?.name,
                    message: updateErr?.message,
                    code: updateErr?.code
                });
                res.setHeader("X-Campora-Google-Stage", "USER_UPDATE");
                return res.status(500).json({
                    success: false,
                    message: "Google authentication failed.",
                    errorCode: "GOOGLE_USER_UPDATE_FAILED"
                });
            }
        } else {
            currentStage = "USER_CREATE";
            try {
                // New user — create account via repository
                isNewUser = true;
                const validRole = (role && ["student", "owner"].includes(role))
                    ? role
                    : "student";

                const isAdminEmail = normalizedEmail === process.env.ADMIN_EMAIL || normalizedEmail === "camporaforstudents@gmail.com";
                const finalRole = isAdminEmail ? "admin" : validRole;

                user = await userRepository.createUser({
                    name: name || "Google User",
                    email: normalizedEmail,
                    avatar: picture || "",
                    profileImage: picture || "",
                    googleId: sub,
                    provider: "google",
                    role: finalRole,
                    verified: true,
                    accountStatus: isAdminEmail ? "ACTIVE" : (finalRole === "owner" ? "PENDING" : "ACTIVE")
                });
            } catch (createErr) {
                console.error("[GOOGLE_AUTH_STAGE] User create failed:", {
                    stage: "USER_CREATE",
                    name: createErr?.name,
                    message: createErr?.message,
                    code: createErr?.code
                });
                res.setHeader("X-Campora-Google-Stage", "USER_CREATE");
                return res.status(500).json({
                    success: false,
                    message: "Google authentication failed.",
                    errorCode: "GOOGLE_USER_CREATE_FAILED"
                });
            }
        }

        currentStage = "ACCOUNT_STATUS";

        // Block deleted / banned accounts
        if (user.accountStatus === "BANNED" || user.accountStatus === "DELETED") {
            res.setHeader("X-Campora-Google-Stage", "ACCOUNT_STATUS");
            return res.status(403).json({
                success: false,
                message: "Your account has been deactivated. Please contact support.",
                errorCode: "GOOGLE_ACCOUNT_BLOCKED"
            });
        }

        // Pending owners cannot log in until approved
        if (user.role === "owner" && user.accountStatus === "PENDING") {
            res.setHeader("X-Campora-Google-Stage", "ACCOUNT_STATUS");
            return res.status(403).json({
                success: false,
                message: "Your account is waiting for admin approval.",
                errorCode: "GOOGLE_ACCOUNT_PENDING"
            });
        }

        // Generate JWT
        currentStage = "JWT_GENERATION";
        let token;
        try {
            token = generateToken(user);
        } catch (jwtErr) {
            console.error("[GOOGLE_AUTH_STAGE] JWT generation failed:", {
                stage: "JWT_GENERATION",
                name: jwtErr?.name,
                message: jwtErr?.message
            });
            res.setHeader("X-Campora-Google-Stage", "JWT_GENERATION");
            return res.status(500).json({
                success: false,
                message: "Google authentication failed.",
                errorCode: "GOOGLE_TOKEN_GENERATION_FAILED"
            });
        }

        res.setHeader("X-Campora-Google-Stage", "SUCCESS");
        return res.status(isNewUser ? 201 : 200).json({
            success: true,
            message: isNewUser ? "Account created via Google." : "Google login successful.",
            token,
            user: sanitizeUser(user)
        });

    } catch (err) {
        console.error("[GOOGLE_AUTH_STAGE] Fatal error:", {
            stage: currentStage,
            name: err?.name,
            message: err?.message,
            stack: err?.stack
        });

        res.setHeader("X-Campora-Google-Stage", currentStage);
        return res.status(500).json({
            success: false,
            message: "Google authentication error.",
            stage: currentStage,
            errorCode: `GOOGLE_FATAL_${currentStage}`
        });
    }
});

module.exports = router;
