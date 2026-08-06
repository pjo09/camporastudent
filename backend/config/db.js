// ===============================================
// CAMPORA — MONGODB CONNECTION MANAGER
// ===============================================
// Production-hardened connection module.
//
// Guarantees:
//   • A MongoDB connection failure NEVER terminates
//     the Node.js process.
//   • Automatic reconnection with exponential
//     backoff (5s → 10s → 20s → 30s cap).
//   • The Express server keeps running even when
//     MongoDB is unavailable.
//   • Graceful shutdown via SIGINT/SIGTERM.
// ===============================================

const mongoose = require("mongoose");

// Base retry delay (ms)
const BASE_RETRY_DELAY_MS = 5 * 1000;
// Max retry delay (ms)
const MAX_RETRY_DELAY_MS = 30 * 1000;
// How long to wait for a single connection attempt
const CONNECT_TIMEOUT_MS = 10 * 1000;

let isConnected = false;
let retryCount = 0;
let retryTimer = null;
let connecting = false;
let shuttingDown = false;

function getRetryDelay() {
    const delay = BASE_RETRY_DELAY_MS * Math.pow(2, retryCount);
    return Math.min(delay, MAX_RETRY_DELAY_MS);
}

async function attemptConnection() {
    if (connecting || shuttingDown) return;

    connecting = true;
    try {
        console.log("Connecting to MongoDB...");

        await mongoose.connect(process.env.MONGO_URI, {
            serverSelectionTimeoutMS: CONNECT_TIMEOUT_MS,
            connectTimeoutMS: CONNECT_TIMEOUT_MS,
            socketTimeoutMS: 45000,
            maxPoolSize: 10
        });

        isConnected = true;
        retryCount = 0;
        console.log("====================================");
        console.log("✅ MongoDB Atlas Connected Successfully");
        console.log("====================================");
    } catch (err) {
        isConnected = false;
        console.log("");
        console.log("====================================");
        console.log("❌ DATABASE CONNECTION FAILED");
        console.log("====================================");
        console.log("Error Name   :", err.name);
        console.log("Error Code   :", err.code);
        console.log("Error Message:", err.message);
        console.log("====================================");
        console.log("⚠️ Backend will continue running.");
        console.log("⚠️ Database-dependent APIs will not work until MongoDB connects.");
        console.log("====================================");
        console.log("");

        // Schedule automatic reconnect with exponential backoff
        const delay = getRetryDelay();
        retryCount++;
        console.log(`⏳ Retrying MongoDB connection in ${delay / 1000}s (attempt ${retryCount})...`);
        retryTimer = setTimeout(attemptConnection, delay);
    } finally {
        connecting = false;
    }
}

async function connectDB() {
    // Make sure any previous retry is cleared
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    retryCount = 0;
    await attemptConnection();
}

function isDbConnected() {
    return isConnected;
}

async function closeDB() {
    shuttingDown = true;
    if (retryTimer) {
        clearTimeout(retryTimer);
        retryTimer = null;
    }
    try {
        await mongoose.connection.close();
    } catch (err) {
        console.log("⚠️ Error closing MongoDB connection:", err.message);
    }
}

// ===============================================
// MONGODB CONNECTION EVENT HANDLERS
// ===============================================

mongoose.connection.on("connected", () => {
    isConnected = true;
    retryCount = 0;
    console.log("✅ MongoDB Connection Established");
});

mongoose.connection.on("error", (err) => {
    isConnected = false;
    console.log("❌ MongoDB Runtime Error:", err.message);
});

mongoose.connection.on("disconnected", () => {
    isConnected = false;
    console.log("⚠️ MongoDB Disconnected");
    // Auto-reconnect if we're not shutting down and not already connecting
    if (!shuttingDown && !connecting) {
        const delay = getRetryDelay();
        retryCount++;
        console.log(`⏳ Reconnecting MongoDB in ${delay / 1000}s (attempt ${retryCount})...`);
        retryTimer = setTimeout(attemptConnection, delay);
    }
});

// ===============================================
// GRACEFUL SHUTDOWN
// ===============================================

async function handleShutdown(signal) {
    console.log("");
    console.log(`Received ${signal}. Closing MongoDB connection and shutting down gracefully...`);
    await closeDB();
    process.exit(0);
}

process.on("SIGINT", () => handleShutdown("SIGINT"));
process.on("SIGTERM", () => handleShutdown("SIGTERM"));

module.exports = connectDB;
module.exports.isDbConnected = isDbConnected;
module.exports.closeDB = closeDB;

