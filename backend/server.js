// ===============================================
// CAMPORA BACKEND SERVER
// PRODUCTION HARDENED
// ===============================================

require("dotenv").config();

// ===============================================
// SECURITY PACKAGES
// ===============================================

const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const mongoSanitize = require("./middleware/mongoSanitizeExpress5");
const { xss: xssSanitizer } = require("express-xss-sanitizer");

// ===============================================
// PACKAGES
// ===============================================

const express = require("express");
const cors = require("cors");
const path = require("path");
const connectDB = require("./config/db");
const { configureDnsResolvers } = require("./config/dns");

// ===============================================
// APP
// ===============================================

const app = express();

// ===============================================
// DNS BOOTSTRAP
// Ensure Node's c-ares resolver uses working DNS
// servers BEFORE Mongoose resolves the Atlas
// `mongodb+srv://` SRV/TXT records.
// ===============================================

configureDnsResolvers();

// ===============================================
// DATABASE
// ===============================================

connectDB();

// ===============================================
// SECURITY MIDDLEWARE (apply before all routes)
// ===============================================

// 1. Helmet - secure HTTP headers
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
            connectSrc: ["'self'", "http://localhost:5000", "http://127.0.0.1:5000", "http://localhost:5500", "http://127.0.0.1:5500", "https://accounts.google.com", "https://www.googleapis.com", "ws:", "wss:"],
            frameSrc: ["'self'", "https://www.google.com", "https://accounts.google.com"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
        }
    }
}));

// 2. Rate limiting - 100 requests per 15 min per IP
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { success: false, message: "Too many requests. Please try again later." },
    standardHeaders: true,
    legacyHeaders: false
});
app.use("/api/", limiter);

// Stricter limit for auth routes (20 req / 15 min)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { success: false, message: "Too many login attempts. Please try again later." }
});
app.use("/api/auth/login", authLimiter);
app.use("/api/auth/register", authLimiter);
app.use("/api/otp/send", authLimiter);

// 3. MongoDB injection sanitization
app.use(mongoSanitize());

// 4. XSS protection (Express 5 compatible sanitizer)
app.use(xssSanitizer());

// ===============================================
// CORS
// ===============================================

app.use(cors({
    origin: [
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://localhost:3000"
    ],
    credentials: true
}));

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use(express.static(path.join(__dirname, "../frontend")));


// ===============================================
// ENV CHECK
// ===============================================

console.log("====================================");

console.log("PORT :",process.env.PORT);

console.log(

"JWT_SECRET :",

process.env.JWT_SECRET

? "Loaded"

: "Missing"

);

console.log(

"MONGO_URI :",

process.env.MONGO_URI

? "Loaded"

: "Missing"

);

console.log(

"GOOGLE_CLIENT_ID :",

process.env.GOOGLE_CLIENT_ID

? "Loaded"

: "Missing"

);

console.log("====================================");


// ===============================================
// ROUTES
// ===============================================


// AUTH

try{

app.use(

"/api/auth",

require("./routes/auth")

);

console.log("✅ Auth Route Loaded");

}catch(err){

console.log("❌ Auth Route Error");

console.log(err);

}


// GOOGLE AUTH

try{

app.use(

"/api/google",

require("./routes/google")

);

console.log("✅ Google Route Loaded");

}catch(err){

console.log("❌ Google Route Error");

console.log(err);

}


// OTP

try{

app.use(

"/api/otp",

require("./routes/otp")

);

console.log("✅ OTP Route Loaded");

}catch(err){

console.log("❌ OTP Route Error");

console.log(err);

}


// ===============================================
// PROPERTY ROUTES
// ONLY KEEP ONE FILE
// routes/properties.js
// ===============================================

try{

app.use(

"/api/properties",

require("./routes/properties")

);

console.log("✅ Properties Route Loaded");

}catch(err){

console.log("❌ Properties Route Error");

console.log(err);

}


// BOOKINGS

try{

app.use(

"/api/bookings",

require("./routes/bookings")

);

console.log("✅ Bookings Route Loaded");

}catch(err){

console.log("❌ Bookings Route Error");

console.log(err);

}


// DASHBOARD

try{

app.use(

"/api/dashboard",

require("./routes/dashboard")

);

console.log("✅ Dashboard Route Loaded");

}catch(err){

console.log("❌ Dashboard Route Error");

console.log(err);

}


// CONTACT

try{

app.use(

"/api/contact",

require("./routes/contact")

);

console.log("✅ Contact Route Loaded");

}catch(err){

console.log("❌ Contact Route Error");

console.log(err);

}


// LOCATION

try{

app.use(

"/api/location",

require("./routes/location")

);

console.log("✅ Location Route Loaded");

}catch(err){

console.log("❌ Location Route Error");

console.log(err);

}


// REVIEWS

try{

app.use(

"/api/reviews",

require("./routes/reviews")

);

console.log("✅ Reviews Route Loaded");

}catch(err){

console.log("❌ Reviews Route Error");

console.log(err);

}


// PAYMENT

try{

app.use(

"/api/payment",

require("./routes/payment")

);

console.log("✅ Payment Route Loaded");

}catch(err){

console.log("❌ Payment Route Error");

console.log(err);

}


// UPLOAD

try{

app.use(

"/api/upload",

require("./routes/upload")

);

console.log("✅ Upload Route Loaded");

}catch(err){

console.log("❌ Upload Route Error");

console.log(err);

}


// ===============================================
// STUDENT ROUTES
// ===============================================

const studentRoutes = require("./routes/student");

try {

    app.use(
        "/api/student",
        studentRoutes
    );

    console.log("✅ Student Route Loaded");

} catch (err) {

    console.log("❌ Student Route Error");

    console.log(err);

}

// ===============================================
// OWNER ROUTES
// ===============================================

const ownerRoutes = require("./routes/owner");

try {

    app.use(
        "/api/owner",
        ownerRoutes
    );

    console.log("✅ Owner Route Loaded");

} catch (err) {

    console.log("❌ Owner Route Error");

    console.log(err);

}

// ===============================================
// OWNER V3 SUB-ROUTES (messaging / maintenance / finance)
// ===============================================

try {

    app.use(
        "/api/owner/messages",
        require("./routes/owner-messaging")
    );

    console.log("✅ Owner Messaging Route Loaded");

} catch (err) {

    console.log("❌ Owner Messaging Route Error");

    console.log(err);

}

try {

    app.use(
        "/api/owner/maintenance",
        require("./routes/owner-maintenance")
    );

    console.log("✅ Owner Maintenance Route Loaded");

} catch (err) {

    console.log("❌ Owner Maintenance Route Error");

    console.log(err);

}

try {

    app.use(
        "/api/owner/finance",
        require("./routes/owner-finance")
    );

    console.log("✅ Owner Finance Route Loaded");

} catch (err) {

    console.log("❌ Owner Finance Route Error");

    console.log(err);

}


// ===============================================
// STUDENT V3 SUB-ROUTES (messaging / maintenance / finance)
// ===============================================

try {

    app.use(
        "/api/student/messages",
        require("./routes/student-messaging")
    );

    console.log("✅ Student Messaging Route Loaded");

} catch (err) {

    console.log("❌ Student Messaging Route Error");

    console.log(err);

}

try {

    app.use(
        "/api/student/maintenance",
        require("./routes/student-maintenance")
    );

    console.log("✅ Student Maintenance Route Loaded");

} catch (err) {

    console.log("❌ Student Maintenance Route Error");

    console.log(err);

}

try {

    app.use(
        "/api/student/finance",
        require("./routes/student-finance")
    );

    console.log("✅ Student Finance Route Loaded");

} catch (err) {

    console.log("❌ Student Finance Route Error");

    console.log(err);

}

// ===============================================
// ADMIN ROUTES
// ===============================================

try {

    app.use(
        "/api/admin",
        require("./routes/admin")
    );

    console.log("✅ Admin Route Loaded");

} catch (err) {

    console.log("❌ Admin Route Error");

    console.log(err);

}

// ===============================================
// FUTURE ADMIN ROUTES
// ===============================================

// ===============================================
// HOME
// ===============================================

app.get("/",(req,res)=>{

res.send("🚀 Campora Backend Running Successfully");

});


// ===============================================
// HEALTH CHECK
// ===============================================

app.get("/api/health",(req,res)=>{

res.json({

success:true,

name:"Campora Backend",

status:"Running",

uptime:process.uptime(),

timestamp:new Date(),

node:process.version

});

});

// ===============================================
// PUBLIC STATISTICS
// ===============================================

app.get("/api/statistics", async (req, res) => {

    try {

        const User = require("./models/User");
        const Property = require("./models/Property");
        const Booking = require("./models/Booking");

        const approvedFilter = {
            status: "approved",
            published: true,
            blacklisted: { $ne: true }
        };

        const [properties, cities, owners, students, bookings] = await Promise.all([
            Property.countDocuments(approvedFilter),
            Property.distinct("city", approvedFilter),
            User.countDocuments({ role: "owner", accountStatus: "ACTIVE" }),
            User.countDocuments({ role: "student" }),
            Booking.countDocuments()
        ]);

        const universities = await Property.distinct("college", {
            ...approvedFilter,
            college: { $ne: "" }
        });

        res.json({
            success: true,
            statistics: {
                properties,
                owners,
                students,
                cities: cities.length,
                universities: universities.length,
                bookings
            }
        });

    } catch (err) {

        console.log(err);

        res.status(500).json({
            success: false,
            message: err.message
        });

    }

});


// ===============================================
// CENTRALIZED ERROR HANDLER
// ===============================================

class AppError extends Error {
    constructor(message, statusCode) {
        super(message);
        this.statusCode = statusCode;
        this.isOperational = true;
    }
}

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: `Route ${req.originalUrl} not found`
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error("====================================");
    console.error("SERVER ERROR:", err);
    console.error("====================================");

    // Mongoose validation error
    if (err.name === "ValidationError") {
        const messages = Object.values(err.errors).map(e => e.message);
        return res.status(400).json({
            success: false,
            message: messages.join(". ")
        });
    }

    // Mongoose duplicate key
    if (err.code === 11000) {
        const field = Object.keys(err.keyValue)[0];
        return res.status(409).json({
            success: false,
            message: `Duplicate value for ${field}. This ${field} is already in use.`
        });
    }

    // Mongoose bad ObjectId
    if (err.name === "CastError") {
        return res.status(400).json({
            success: false,
            message: `Invalid ${err.path}: ${err.value}`
        });
    }

    // JWT errors
    if (err.name === "JsonWebTokenError") {
        return res.status(401).json({
            success: false,
            message: "Invalid token. Please log in again."
        });
    }
    if (err.name === "TokenExpiredError") {
        return res.status(401).json({
            success: false,
            message: "Your token has expired. Please log in again."
        });
    }

    // Rate limit error
    if (err.statusCode === 429) {
        return res.status(429).json({
            success: false,
            message: err.message
        });
    }

    const statusCode = err.statusCode || 500;
    res.status(statusCode).json({
        success: false,
        message: err.isOperational ? err.message : "Internal server error. Please try again later."
    });
});


// ===============================================
// START SERVER
// ===============================================

const PORT=process.env.PORT || 5000;

app.listen(PORT,()=>{

console.log("");

console.log("====================================");

console.log("🚀 CAMPORA BACKEND RUNNING");

console.log(`🌐 http://localhost:${PORT}`);

console.log(`❤️ Health : http://localhost:${PORT}/api/health`);

console.log("====================================");

});