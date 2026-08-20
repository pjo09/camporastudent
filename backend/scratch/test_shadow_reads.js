const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

// Enable Shadow Reads for test runner
process.env.DATABASE_SHADOW_READS = 'true';
process.env.SHADOW_READ_DOMAINS = 'users,properties,bookings';

const userRepository = require('../repositories/userRepository');
const propertyRepository = require('../repositories/propertyRepository');
const bookingRepository = require('../repositories/bookingRepository');
const { getShadowMetrics, resetShadowMetrics } = require('../services/shadowReadService');
const { getSupabaseClient } = require('../config/supabase');

async function runShadowReadTests() {
    console.log("\n=========================================");
    console.log("CAMPORA PHASE 5 — SHADOW READ TEST SUITE");
    console.log("=========================================\n");

    // 1. Connect MongoDB
    console.log("Connecting to MongoDB Atlas (READ-ONLY)...");
    await mongoose.connect(process.env.MONGO_URI);
    const dbMongo = mongoose.connection.db;

    // 2. Initialize Supabase PGlite Client
    console.log("Initializing Supabase Client...");
    await getSupabaseClient();

    resetShadowMetrics();

    let testPass = 0;
    let testFail = 0;

    function assertTest(cond, name, detail = "") {
        if (cond) {
            console.log(`✅ ${name}: PASS ${detail ? `(${detail})` : ""}`);
            testPass++;
        } else {
            console.error(`❌ ${name}: FAIL ${detail ? `(${detail})` : ""}`);
            testFail++;
        }
    }

    // TEST 1: User Lookup by Email (atharwacto@gmail.com)
    console.log("\n--- TEST GROUP 1: USERS DOMAIN SHADOW READS ---");
    const atharwaUser = await userRepository.findUserByEmail('atharwacto@gmail.com');
    assertTest(
        atharwaUser && atharwaUser.accountStatus === 'ACTIVE' && atharwaUser.verified === true,
        "User lookup by email (atharwacto@gmail.com)",
        `accountStatus=${atharwaUser?.accountStatus}, verified=${atharwaUser?.verified}`
    );

    // TEST 2: Pending Owner Lookup
    const pendingMongoUsers = await dbMongo.collection('users').find({ role: 'owner', accountStatus: 'PENDING' }).toArray();
    let pendingUserMatches = 0;
    for (const pUser of pendingMongoUsers) {
        const uRes = await userRepository.findUserByEmail(pUser.email);
        if (uRes && uRes.accountStatus === 'PENDING') {
            pendingUserMatches++;
        }
    }
    assertTest(
        pendingUserMatches === pendingMongoUsers.length,
        "Pending Owners Lookup Shadow Read",
        `Verified ${pendingUserMatches}/${pendingMongoUsers.length} pending owners`
    );

    // TEST 3: User Lookup by ID
    const sampleMongoUser = pendingMongoUsers[0];
    const userById = await userRepository.findUserById(sampleMongoUser._id.toString());
    assertTest(
        userById && userById.email.toLowerCase() === sampleMongoUser.email.toLowerCase(),
        "User lookup by ID",
        `email=${userById?.email}`
    );

    // TEST 4: Property Lookup by ID
    console.log("\n--- TEST GROUP 2: PROPERTIES DOMAIN SHADOW READS ---");
    const samplePropDoc = await dbMongo.collection('properties').findOne({ propertyName: { $exists: true, $ne: '' } });
    const samplePropName = (samplePropDoc.propertyName || samplePropDoc.title || samplePropDoc.name || '').trim();
    const propById = await propertyRepository.findPropertyById(samplePropDoc._id.toString());
    const propByIdName = (propById.propertyName || propById.title || propById.name || '').trim();
    assertTest(
        propById && propByIdName === samplePropName,
        "Property lookup by ID",
        `name='${propByIdName}'`
    );

    // TEST 5: Property List & Inventory Comparison
    const propList = await propertyRepository.listProperties({});
    const mongoProps = await dbMongo.collection('properties').find({}).toArray();
    assertTest(
        propList && propList.length === mongoProps.length,
        "Property list count match",
        `Count=${propList?.length}`
    );

    // TEST 6: Booking Lookup by ID
    console.log("\n--- TEST GROUP 3: BOOKINGS DOMAIN SHADOW READS ---");
    const sampleBookingDoc = await dbMongo.collection('bookings').findOne({});
    const bookingById = await bookingRepository.findBookingById(sampleBookingDoc._id.toString());
    assertTest(
        bookingById && bookingById.bookingStatus === sampleBookingDoc.bookingStatus,
        "Booking lookup by ID",
        `status=${bookingById?.bookingStatus}`
    );

    // TEST 7: Booking List
    const bookingList = await bookingRepository.listBookings({});
    const mongoBookings = await dbMongo.collection('bookings').find({}).toArray();
    assertTest(
        bookingList && bookingList.length === mongoBookings.length,
        "Booking list count match",
        `Count=${bookingList?.length}`
    );

    // TEST 8: Missing Record Lookup (returns null from mongo, shadow match)
    console.log("\n--- TEST GROUP 4: EDGE CASES & SUPABASE ERROR RESILIENCE ---");
    const missingUser = await userRepository.findUserByEmail('nonexistent_user_xyz_123@campora.in');
    assertTest(
        missingUser === null,
        "Missing record lookup returns null from Authoritative MongoDB",
        "Result is null"
    );

    // TEST 9: Simulated Supabase Failure / Exception Guard Verification
    const originalSupabaseFindUser = require('../database/supabase/userAdapter').findUserByEmail;
    require('../database/supabase/userAdapter').findUserByEmail = async () => {
        throw new Error("SIMULATED_SUPABASE_CONNECTION_TIMEOUT_TEST");
    };

    let errorResiliencePassed = false;
    try {
        const resultDuringError = await userRepository.findUserByEmail('atharwacto@gmail.com');
        if (resultDuringError && resultDuringError.email.toLowerCase() === 'atharwacto@gmail.com') {
            errorResiliencePassed = true;
        }
    } catch (e) {
        errorResiliencePassed = false;
    }
    require('../database/supabase/userAdapter').findUserByEmail = originalSupabaseFindUser;

    assertTest(
        errorResiliencePassed,
        "Supabase Error Resilience: Exception does NOT block request or throw 500",
        "Authoritative MongoDB result returned successfully during Supabase outage"
    );

    await mongoose.disconnect();

    const metrics = getShadowMetrics();
    console.log("\n--- SHADOW READ METRICS ---");
    console.log(`- Total Shadow Reads: ${metrics.totalReads}`);
    console.log(`- Total Matches: ${metrics.totalMatches}`);
    console.log(`- Total Mismatches: ${metrics.totalMismatches}`);
    console.log(`- Total Errors: ${metrics.totalErrors}`);

    console.log("\n=========================================");
    console.log(`SHADOW READ TEST SUITE SUMMARY: ${testPass} PASSED, ${testFail} FAILED`);
    console.log("=========================================\n");

    if (testFail > 0) {
        process.exit(1);
    }
}

runShadowReadTests().catch(err => {
    console.error("Shadow read test error:", err);
    process.exit(1);
});
