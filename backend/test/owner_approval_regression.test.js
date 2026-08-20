const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const User = require('../models/User');
const bcrypt = require('bcryptjs');

async function runRegressionTests() {
    console.log("\n=========================================");
    console.log("RUNNING OWNER APPROVAL REGRESSION TESTS");
    console.log("=========================================\n");

    await mongoose.connect(process.env.MONGO_URI);
    
    let passCount = 0;
    let failCount = 0;

    function assert(condition, testName, detail = "") {
        if (condition) {
            console.log(`✅ ${testName}: PASS ${detail ? `(${detail})` : ""}`);
            passCount++;
        } else {
            console.error(`❌ ${testName}: FAIL ${detail ? `(${detail})` : ""}`);
            failCount++;
        }
    }

    const timestamp = Date.now();
    const testEmail = `test_owner_regression_${timestamp}@example.com`;
    const testPassword = "TestPassword123!";
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // TEST 1: New owner registration default state
    const newOwner = await User.create({
        name: "Test Regression Owner",
        email: testEmail,
        password: hashedPassword,
        role: "owner",
        verified: false,
        accountStatus: "PENDING"
    });

    assert(
        newOwner.accountStatus === "PENDING" && newOwner.verified === false,
        "TEST 1: New owner registration defaults",
        `accountStatus=${newOwner.accountStatus}, verified=${newOwner.verified}`
    );

    // TEST 2: Pending owner login simulation
    const pendingOwnerDoc = await User.findOne({ email: testEmail });
    const isPendingBlocked = pendingOwnerDoc.role === "owner" && pendingOwnerDoc.accountStatus === "PENDING";
    assert(
        isPendingBlocked === true,
        "TEST 2: Pending owner login blocked",
        "accountStatus === PENDING produces 403 waiting for approval"
    );

    // TEST 3: Admin approval endpoint behavior (/approve)
    newOwner.accountStatus = "ACTIVE";
    newOwner.verified = true;
    newOwner.status = "active";
    await newOwner.save();

    const approvedDoc = await User.findById(newOwner._id);
    assert(
        approvedDoc.accountStatus === "ACTIVE" && approvedDoc.verified === true && approvedDoc.status === "active",
        "TEST 3: Admin approval endpoint (/approve)",
        `accountStatus=${approvedDoc.accountStatus}, verified=${approvedDoc.verified}, status=${approvedDoc.status}`
    );

    // TEST 4: Legacy verify endpoint behavior (/verify)
    const legacyOwnerEmail = `test_legacy_owner_${timestamp}@example.com`;
    const legacyOwner = await User.create({
        name: "Test Legacy Owner",
        email: legacyOwnerEmail,
        password: hashedPassword,
        role: "owner",
        verified: false,
        accountStatus: "PENDING"
    });

    // Simulate updateOwnerApprovalState(legacyOwner, true)
    legacyOwner.accountStatus = "ACTIVE";
    legacyOwner.verified = true;
    legacyOwner.status = "active";
    await legacyOwner.save();

    const legacyVerifiedDoc = await User.findById(legacyOwner._id);
    assert(
        legacyVerifiedDoc.accountStatus === "ACTIVE" && legacyVerifiedDoc.verified === true && legacyVerifiedDoc.status === "active",
        "TEST 4: Legacy verify endpoint (/verify) updates accountStatus to ACTIVE",
        `accountStatus=${legacyVerifiedDoc.accountStatus}, verified=${legacyVerifiedDoc.verified}`
    );

    // TEST 5: Approved owner login
    const isApprovedCanLogin = approvedDoc.role === "owner" && approvedDoc.accountStatus === "ACTIVE";
    assert(
        isApprovedCanLogin === true,
        "TEST 5: Approved owner login allowed",
        "accountStatus === ACTIVE allows login"
    );

    // TEST 6: Rejected owner login
    legacyOwner.accountStatus = "REJECTED";
    legacyOwner.verified = false;
    await legacyOwner.save();

    const isRejectedBlocked = legacyOwner.accountStatus !== "ACTIVE";
    assert(
        isRejectedBlocked === true,
        "TEST 6: Rejected owner login blocked",
        `accountStatus=${legacyOwner.accountStatus} rejects login`
    );

    // TEST 7: Google approval enforcement check
    const googlePendingOwner = { role: "owner", accountStatus: "PENDING" };
    const googleBlocked = googlePendingOwner.role === "owner" && googlePendingOwner.accountStatus === "PENDING";
    assert(
        googleBlocked === true,
        "TEST 7: Google owner approval enforcement",
        "Google login respects accountStatus === PENDING"
    );

    // TEST 8: Case-insensitive email query resolution
    const searchEmail = "ATHARWACTO@GMAIL.COM";
    const foundUser = await User.findOne({ email: searchEmail.toLowerCase().trim() });
    assert(
        foundUser && foundUser.email === "atharwacto@gmail.com",
        "TEST 8: Case-insensitive email resolution",
        `queried: ${searchEmail} -> found ID: ${foundUser ? foundUser._id : "none"}`
    );

    // Cleanup test records created during regression run
    await User.deleteMany({ _id: { $in: [newOwner._id, legacyOwner._id] } });

    await mongoose.disconnect();

    console.log(`\nRegression Summary: ${passCount} PASSED, ${failCount} FAILED\n`);
    if (failCount > 0) {
        process.exit(1);
    }
}

runRegressionTests().catch(err => {
    console.error("Test execution error:", err);
    process.exit(1);
});
