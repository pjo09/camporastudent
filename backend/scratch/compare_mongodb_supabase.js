const fs = require('fs');
const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { getSupabaseClient } = require('../config/supabase');
const { mongoIdToPostgresId } = require('../utils/idMapper');

async function compareDatabases() {
    console.log("\n=========================================");
    console.log("CAMPORA PHASE 4 — DUAL DATABASE VALIDATION TOOL");
    console.log("=========================================\n");

    // 1. Connect MongoDB
    console.log("Connecting to MongoDB Atlas (READ-ONLY)...");
    await mongoose.connect(process.env.MONGO_URI);
    const dbMongo = mongoose.connection.db;

    // 2. Initialize Supabase Client
    console.log("Initializing Supabase Client...");
    const dbPg = await getSupabaseClient();

    let totalMatches = 0;
    let totalMismatches = 0;

    function reportEntity(domain, name, isMatch, details = "") {
        if (isMatch) {
            console.log(`✅ [${domain.toUpperCase()}] ${name}: MATCH ${details ? `(${details})` : ""}`);
            totalMatches++;
        } else {
            console.error(`❌ [${domain.toUpperCase()}] ${name}: MISMATCH ${details ? `(${details})` : ""}`);
            totalMismatches++;
        }
    }

    // -------------------------------------------------------------
    // Domain 1: USERS & AUTHORITATIVE OWNER APPROVAL STATE
    // -------------------------------------------------------------
    console.log("\n--- DOMAIN 1: USERS & OWNER APPROVAL STATE ---");
    const mongoUsers = await dbMongo.collection('users').find({}).toArray();
    const pgUsersRes = await dbPg.query(`SELECT * FROM profiles`);
    const pgUsers = pgUsersRes.rows;

    const pgUserMap = new Map();
    for (const u of pgUsers) {
        if (u.mongo_id) pgUserMap.set(u.mongo_id, u);
    }

    reportEntity('users', 'Record Count Comparison', mongoUsers.length === pgUsers.length, `Mongo=${mongoUsers.length}, Postgres=${pgUsers.length}`);

    // Special Owner Validation: atharwacto@gmail.com
    const mongoAtharwa = mongoUsers.find(u => (u.email || '').toLowerCase() === 'atharwacto@gmail.com');
    const pgAtharwaRes = await dbPg.query(`SELECT * FROM profiles WHERE LOWER(email) = 'atharwacto@gmail.com'`);
    const pgAtharwa = pgAtharwaRes.rows[0];

    const atharwaMatch = mongoAtharwa && pgAtharwa &&
        mongoAtharwa.accountStatus === 'ACTIVE' &&
        pgAtharwa.account_status === 'ACTIVE' &&
        mongoAtharwa.verified === true &&
        pgAtharwa.verified === true &&
        mongoAtharwa.status === 'active' &&
        pgAtharwa.status === 'active';

    reportEntity(
        'users',
        'atharwacto@gmail.com Owner Approval Verification',
        !!atharwaMatch,
        `Mongo(accountStatus=${mongoAtharwa?.accountStatus}, verified=${mongoAtharwa?.verified}) == Supabase(account_status=${pgAtharwa?.account_status}, verified=${pgAtharwa?.verified})`
    );

    // Pending owners verification
    const mongoPendingOwners = mongoUsers.filter(u => u.role === 'owner' && u.accountStatus === 'PENDING');
    let pendingMatchCount = 0;
    for (const pOwner of mongoPendingOwners) {
        const strId = pOwner._id.toString();
        const pgMatch = pgUserMap.get(strId);
        if (pgMatch && pgMatch.account_status === 'PENDING') {
            pendingMatchCount++;
        }
    }
    reportEntity(
        'users',
        'Pending Owners Preservation Check',
        pendingMatchCount === mongoPendingOwners.length,
        `Preserved ${pendingMatchCount}/${mongoPendingOwners.length} pending owners as account_status=PENDING`
    );

    // -------------------------------------------------------------
    // Domain 2: PROPERTIES & INVENTORY PRESERVATION
    // -------------------------------------------------------------
    console.log("\n--- DOMAIN 2: PROPERTIES & INVENTORY COMPARISON ---");
    const mongoProperties = await dbMongo.collection('properties').find({}).toArray();
    const pgPropertiesRes = await dbPg.query(`SELECT * FROM properties`);
    const pgProperties = pgPropertiesRes.rows;

    const pgPropMap = new Map();
    for (const p of pgProperties) {
        if (p.mongo_id) pgPropMap.set(p.mongo_id, p);
    }

    reportEntity('properties', 'Record Count Comparison', mongoProperties.length === pgProperties.length, `Mongo=${mongoProperties.length}, Postgres=${pgProperties.length}`);

    let inventoryMismatches = 0;
    for (const mProp of mongoProperties) {
        const strId = mProp._id.toString();
        const pgProp = pgPropMap.get(strId);
        if (!pgProp) {
            inventoryMismatches++;
            continue;
        }
        const totalMatch = (mProp.totalBeds || 0) === pgProp.total_beds;
        const availMatch = (mProp.availableBeds || 0) === pgProp.available_beds;
        if (!totalMatch || !availMatch) {
            inventoryMismatches++;
            console.error(`Inventory Mismatch for property '${mProp.propertyName}' (${strId}): Mongo(total=${mProp.totalBeds}, avail=${mProp.availableBeds}) vs PG(total=${pgProp.total_beds}, avail=${pgProp.available_beds})`);
        }
    }
    reportEntity('properties', 'Property Inventory Beds Match (available_beds & total_beds)', inventoryMismatches === 0, `Mismatches=${inventoryMismatches}`);

    // -------------------------------------------------------------
    // Domain 3: BOOKINGS COMPARISON
    // -------------------------------------------------------------
    console.log("\n--- DOMAIN 3: BOOKINGS COMPARISON ---");
    const mongoBookings = await dbMongo.collection('bookings').find({}).toArray();
    const pgBookingsRes = await dbPg.query(`SELECT * FROM bookings`);
    const pgBookings = pgBookingsRes.rows;

    const pgBookingMap = new Map();
    for (const b of pgBookings) {
        if (b.mongo_id) pgBookingMap.set(b.mongo_id, b);
    }

    reportEntity('bookings', 'Record Count Comparison', mongoBookings.length === pgBookings.length, `Mongo=${mongoBookings.length}, Postgres=${pgBookings.length}`);

    let bookingMismatches = 0;
    for (const mBooking of mongoBookings) {
        const strId = mBooking._id.toString();
        const pgBooking = pgBookingMap.get(strId);
        if (!pgBooking) {
            bookingMismatches++;
            continue;
        }
        const statusMatch = mBooking.bookingStatus === pgBooking.booking_status;
        const payMatch = mBooking.paymentStatus === pgBooking.payment_status;
        const priceMatch = (mBooking.price || 0) === parseFloat(pgBooking.price);
        const resMatch = !!mBooking.inventoryReserved === pgBooking.inventory_reserved;
        const relMatch = !!mBooking.inventoryReleased === pgBooking.inventory_released;

        if (!statusMatch || !payMatch || !priceMatch || !resMatch || !relMatch) {
            bookingMismatches++;
            console.error(`Booking Mismatch for ID ${strId}`);
        }
    }
    reportEntity('bookings', 'Booking Fields & Inventory Flags Match', bookingMismatches === 0, `Mismatches=${bookingMismatches}`);

    // -------------------------------------------------------------
    // Domain 4: REVIEWS, MESSAGES, NOTIFICATIONS, OTHER DOMAINS
    // -------------------------------------------------------------
    console.log("\n--- DOMAIN 4: OTHER DOMAIN RECORD COUNT COMPARISONS ---");
    const compareDomainCount = async (colName, pgTable) => {
        const mongoDocs = await dbMongo.collection(colName).find({}).toArray();
        const pgRes = await dbPg.query(`SELECT COUNT(*) AS cnt FROM ${pgTable}`);
        const pgCount = parseInt(pgRes.rows[0].cnt, 10);
        reportEntity(colName, `Count Match: ${colName} -> ${pgTable}`, mongoDocs.length === pgCount, `Mongo=${mongoDocs.length}, Postgres=${pgCount}`);
    };

    await compareDomainCount('reviews', 'reviews');
    await compareDomainCount('messageconversations', 'conversations');
    await compareDomainCount('messages', 'messages');
    await compareDomainCount('tenancies', 'tenancies');
    await compareDomainCount('residentrequests', 'resident_requests');
    await compareDomainCount('notifications', 'notifications');
    await compareDomainCount('auditlogs', 'audit_logs');
    await compareDomainCount('contacts', 'contacts');
    await compareDomainCount('propertyinvites', 'property_invites');
    await compareDomainCount('settings', 'platform_settings');

    await mongoose.disconnect();

    console.log("\n=========================================");
    console.log(`DUAL DATABASE VALIDATION SUMMARY: ${totalMatches} PASSED, ${totalMismatches} FAILED`);
    console.log("=========================================\n");

    if (totalMismatches > 0) {
        process.exit(1);
    }
}

compareDatabases().catch(err => {
    console.error("Comparison Error:", err);
    process.exit(1);
});
