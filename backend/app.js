// ===============================================
// CAMPORA BACKEND EXPRESS APP CONFIGURATION
// ===============================================

const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("./middleware/mongoSanitizeExpress5");
const { xss: xssSanitizer } = require("express-xss-sanitizer");
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");
const { configureDnsResolvers } = require("./config/dns");

const app = express();

configureDnsResolvers();
connectDB();

// ===============================================
// CORS — MUST be registered FIRST so that OPTIONS
// preflight is answered before auth, RBAC, or
// rate-limiting middleware can intercept it.
// Single centralized configuration (no duplicates).
// ===============================================

// Explicit allowlist of known production + development origins.
const ALLOWED_ORIGINS = [
    "https://camporastudent.vercel.app",
    "http://localhost:3000",
    "http://localhost:5000",
    "http://localhost:5500",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:5000",
    "http://127.0.0.1:5500"
];

app.use(cors({
    origin(origin, callback) {
        // Allow non-browser / server-to-server / health-check requests (no Origin header)
        if (!origin) {
            return callback(null, true);
        }

        // Explicit allowlist (exact match)
        if (ALLOWED_ORIGINS.includes(origin)) {
            return callback(null, true);
        }

        // Vercel preview deployments: https://<project>-<hash>-<scope>.vercel.app
        if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
            return callback(null, true);
        }

        // Render preview deployments: https://<service>-<hash>.onrender.com
        if (/^https:\/\/[a-zA-Z0-9-]+\.onrender\.com$/.test(origin)) {
            return callback(null, true);
        }

        return callback(new Error("Not allowed by CORS"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept", "Origin", "X-Requested-With"],
    preflightContinue: false,
    optionsSuccessStatus: 204
}));

// Guarantee EVERY OPTIONS request returns a successful empty response,
// even if it does not carry standard preflight headers. This sits directly
// after CORS and before any auth/RBAC/rate-limit middleware.
app.use((req, res, next) => {
    if (req.method === "OPTIONS") {
        return res.sendStatus(204);
    }
    return next();
});

app.use(helmet({
    contentSecurityPolicy: {
        useDefaults: true,
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'", "https://kit.fontawesome.com", "https://accounts.google.com", "https://www.google.com", "https://www.gstatic.com"],
            scriptSrcAttr: ["'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com", "https://accounts.google.com"],
            styleSrcAttr: ["'unsafe-inline'"],
            imgSrc: ["'self'", "data:", "https://res.cloudinary.com", "https://*.cloudinary.com", "https://*.googleusercontent.com"],
            fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
            connectSrc: ["'self'", "http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:5500", "http://127.0.0.1:5500", "http://localhost:3000", "http://127.0.0.1:3000", "https://camporastudent.onrender.com", "https://camporastudent.vercel.app", "https://accounts.google.com", "https://www.googleapis.com","https://*.vercel.app","ws:", "wss:"],
            frameSrc: ["'self'", "https://www.google.com", "https://accounts.google.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        }
    }
}));

const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});
app.use("/api/", limiter);

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: "Too many login attempts. Please try again later." }
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);

// Softer OTP-send limit — the cooldown in the route already throttles
// individual emails, so this only needs to stop wholesale abuse.
const otpSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: "Too many OTP requests. Please try again later." }
});
app.use("/api/otp/send", otpSendLimiter);

// Stricter limit for highly sensitive admin + password-reset endpoints.
const sensitiveLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { success: false, message: "Too many attempts. Please try again later." }
});
app.use("/api/auth/admin/login", sensitiveLimiter);
app.use("/api/auth/forgot-password", sensitiveLimiter);
app.use("/api/auth/verify-reset-otp", sensitiveLimiter);
app.use("/api/auth/reset-password", sensitiveLimiter);

// Dedicated OTP-verify limiter. Verification attempts are already capped
// per-OTP (max 5) inside the route itself, so this only guards against
// wholesale abuse and must NOT block legitimate register/login/OTP flows.
const otpVerifyLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: { success: false, message: "Too many OTP verification attempts. Please try again later." }
});
app.use("/api/otp/verify", otpVerifyLimiter);

app.use(mongoSanitize());
app.use(xssSanitizer());

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "../frontend")));

// Routes
try { app.use("/api/auth", require("./routes/auth")); console.log("✅ Auth Route Loaded"); } catch(err) { console.log("❌ Auth Route Error", err); }
try { app.use("/api/auth/google", require("./routes/google")); console.log("✅ Google Auth Route Loaded"); } catch(err) { console.log("❌ Google Auth Route Error", err); }
try { app.use("/api/otp", require("./routes/otp")); console.log("✅ OTP Route Loaded"); } catch(err) { console.log("❌ OTP Route Error", err); }
try { app.use("/api/properties", require("./routes/properties")); console.log("✅ Properties Route Loaded"); } catch(err) { console.log("❌ Properties Route Error", err); }
try { app.use("/api/owner", require("./routes/owner")); console.log("✅ Owner Route Loaded"); } catch(err) { console.log("❌ Owner Route Error", err); }
try { app.use("/api/owner/finance", require("./routes/owner-finance")); console.log("✅ Owner Finance Route Loaded"); } catch(err) { console.log("❌ Owner Finance Route Error", err); }
try { app.use("/api/owner/maintenance", require("./routes/owner-maintenance")); console.log("✅ Owner Maintenance Route Loaded"); } catch(err) { console.log("❌ Owner Maintenance Route Error", err); }
try { app.use("/api/owner/messaging", require("./routes/owner-messaging")); console.log("✅ Owner Messaging Route Loaded"); } catch(err) { console.log("❌ Owner Messaging Route Error", err); }
try { app.use("/api/student", require("./routes/student")); console.log("✅ Student Route Loaded"); } catch(err) { console.log("❌ Student Route Error", err); }
try { app.use("/api/student/finance", require("./routes/student-finance")); console.log("✅ Student Finance Route Loaded"); } catch(err) { console.log("❌ Student Finance Route Error", err); }
try { app.use("/api/student/maintenance", require("./routes/student-maintenance")); console.log("✅ Student Maintenance Route Loaded"); } catch(err) { console.log("❌ Student Maintenance Route Error", err); }
try { app.use("/api/student/messaging", require("./routes/student-messaging")); console.log("✅ Student Messaging Route Loaded"); } catch(err) { console.log("❌ Student Messaging Route Error", err); }
try { app.use("/api/admin", require("./routes/admin")); console.log("✅ Admin Route Loaded"); } catch(err) { console.log("❌ Admin Route Error", err); }
try { app.use("/api/bookings", require("./routes/bookings")); console.log("✅ Bookings Route Loaded"); } catch(err) { console.log("❌ Bookings Route Error", err); }
try { app.use("/api/payments", require("./routes/payment")); console.log("✅ Payments Route Loaded"); } catch(err) { console.log("❌ Payments Route Error", err); }
try { app.use("/api/reviews", require("./routes/reviews")); console.log("✅ Reviews Route Loaded"); } catch(err) { console.log("❌ Reviews Route Error", err); }
try { app.use("/api/statistics", require("./routes/statistics")); console.log("✅ Statistics Route Loaded"); } catch(err) { console.log("❌ Statistics Route Error", err); }
try { app.use("/api/location", require("./routes/location")); console.log("✅ Location Route Loaded"); } catch(err) { console.log("❌ Location Route Error", err); }
try { app.use("/api/contact", require("./routes/contact")); console.log("✅ Contact Route Loaded"); } catch(err) { console.log("❌ Contact Route Error", err); }
try { app.use("/api/upload", require("./routes/upload")); console.log("✅ Upload Route Loaded"); } catch(err) { console.log("❌ Upload Route Error", err); }
try { app.use("/api/dashboard", require("./routes/dashboard")); console.log("✅ Dashboard Route Loaded"); } catch(err) { console.log("❌ Dashboard Route Error", err); }

app.get("/api/health", (req, res) => {
    res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// Centralized Error Handling Middleware
app.use((err, req, res, next) => {
    const isProd = process.env.NODE_ENV === "production";
    console.error("Centralized Error Handler:", err.name || "Error", err.message);

    // Mongoose Validation Error
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: "Validation Error",
            error: messages.join(". ")
        });
    }

    // Mongoose Duplicate Key Error
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue || {})[0] || "field";
        return res.status(409).json({
            success: false,
            message: `Duplicate entry for ${field}. Value already exists.`,
            error: "DUPLICATE_KEY_ERROR"
        });
    }

    // Mongoose Cast Error (Bad ObjectId)
    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: `Invalid ID format for field '${err.path}'`,
            error: "BAD_REQUEST"
        });
    }

    // JWT Error
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError") {
        return res.status(401).json({
            success: false,
            message: "Authentication token invalid or expired.",
            error: "UNAUTHORIZED"
        });
    }

    const statusCode = err.statusCode || err.status || 500;
    return res.status(statusCode).json({
        success: false,
        message: err.message || "Internal server error.",
        ...(isProd ? {} : { stack: err.stack })
    });
});

module.exports = app;
