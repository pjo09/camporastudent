require("dotenv").config({ path: require("path").resolve(__dirname, "../.env") });
const { configureDnsResolvers } = require("../config/dns");
configureDnsResolvers();

const mongoose = require("mongoose");
const Booking = require("../models/Booking");
const Property = require("../models/Property");
const User = require("../models/User");

const DB_URI = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/campora";

async function setupTestData() {
    // Clean up any stale test data from prior aborted runs
    await User.deleteMany({ email: { $in: ["testowner@example.com", "studenta@example.com", "studentb@example.com", "studentc@example.com"] } });
    await Property.deleteMany({ propertyName: { $in: ["Prop Approved 1 Bed", "Prop Approved 2 Beds", "Prop Pending", "Prop Unpublished", "Prop Blacklisted"] } });

    // Create Test Owner
    const owner = await User.create({
        name: "Test Owner",
        email: "testowner@example.com",
        password: "Password123!",
        role: "owner",
        verified: true,
        accountStatus: "ACTIVE"
    });

    // Create Test Students
    const studentA = await User.create({
        name: "Student A",
        email: "studenta@example.com",
        password: "Password123!",
        role: "student",
        verified: true,
        accountStatus: "ACTIVE"
    });

    const studentB = await User.create({
        name: "Student B",
        email: "studentb@example.com",
        password: "Password123!",
        role: "student",
        verified: true,
        accountStatus: "ACTIVE"
    });

    const studentC = await User.create({
        name: "Student C",
        email: "studentc@example.com",
        password: "Password123!",
        role: "student",
        verified: true,
        accountStatus: "ACTIVE"
    });

    // Create standard approved Property with 1 bed
    const propApproved1 = await Property.create({
        owner: owner._id,
        propertyName: "Prop Approved 1 Bed",
        propertyType: "PG",
        state: "Tamil Nadu",
        city: "Vellore",
        address: "VIT Road",
        rent: 10000,
        availableBeds: 1,
        totalBeds: 5,
        status: "approved",
        published: true,
        available: true
    });

    // Create standard approved Property with 2 beds (for concurrency)
    const propApproved2 = await Property.create({
        owner: owner._id,
        propertyName: "Prop Approved 2 Beds",
        propertyType: "PG",
        state: "Tamil Nadu",
        city: "Vellore",
        address: "VIT Road",
        rent: 10000,
        availableBeds: 2,
        totalBeds: 5,
        status: "approved",
        published: true,
        available: true
    });

    // Create pending Property
    const propPending = await Property.create({
        owner: owner._id,
        propertyName: "Prop Pending",
        propertyType: "PG",
        state: "Tamil Nadu",
        city: "Vellore",
        address: "VIT Road",
        rent: 10000,
        availableBeds: 5,
        totalBeds: 5,
        status: "pending",
        published: true,
        available: true
    });

    // Create unpublished Property
    const propUnpublished = await Property.create({
        owner: owner._id,
        propertyName: "Prop Unpublished",
        propertyType: "PG",
        state: "Tamil Nadu",
        city: "Vellore",
        address: "VIT Road",
        rent: 10000,
        availableBeds: 5,
        totalBeds: 5,
        status: "approved",
        published: false,
        available: true
    });

    // Create blacklisted Property
    const propBlacklisted = await Property.create({
        owner: owner._id,
        propertyName: "Prop Blacklisted",
        propertyType: "PG",
        state: "Tamil Nadu",
        city: "Vellore",
        address: "VIT Road",
        rent: 10000,
        availableBeds: 5,
        totalBeds: 5,
        status: "approved",
        published: true,
        blacklisted: true,
        available: true
    });

    return {
        owner,
        studentA,
        studentB,
        studentC,
        propApproved1,
        propApproved2,
        propPending,
        propUnpublished,
        propBlacklisted
    };
}

async function cleanTestData(testData) {
    const ids = Object.values(testData).map(doc => doc._id);
    await User.deleteMany({ _id: { $in: ids } });
    await Property.deleteMany({ _id: { $in: ids } });
    await Booking.deleteMany({ propertyId: { $in: ids } });
}

// Simulated mock API handlers (similar to routes)
async function simulateBookingCreation(reqBody, user) {
    const { propertyId, moveInDate, duration, specialRequest } = reqBody;
    const student = await User.findById(user._id);

    if (user.role !== "student") {
        return { status: 403, body: { success: false, message: "Unauthorized: Only students can create bookings" } };
    }

    const selectedProperty = await Property.findById(propertyId);
    if (!selectedProperty) {
        return { status: 404, body: { success: false, message: "Property not found" } };
    }

    if (selectedProperty.status !== "approved" || selectedProperty.published !== true || selectedProperty.blacklisted === true) {
        return { status: 409, body: { success: false, message: "Property is not currently bookable." } };
    }

    if (selectedProperty.availableBeds <= 0) {
        return { status: 409, body: { success: false, message: "No beds available for this property." } };
    }

    // Check duplicate
    const duplicateBooking = await Booking.findOne({
        userId: student._id,
        propertyId: selectedProperty._id,
        bookingStatus: { $in: ["pending", "confirmed", "checked-in"] }
    });
    if (duplicateBooking) {
        return { status: 400, body: { success: false, message: "You already have an active booking for this property." } };
    }

    let useTransaction = false;
    let session = null;
    try {
        session = await mongoose.startSession();
        // session.startTransaction(); // handled by executeTransactionWithRetry
        useTransaction = true;
    } catch (e) {
        useTransaction = false;
        if (session) {
            session.endSession();
            session = null;
        }
    }

    let booking;
    if (useTransaction) {
        try {
            const { reserveBookingInventory, executeTransactionWithRetry } = require("../utils/inventoryHelper");
            
            await executeTransactionWithRetry(session, async (s) => {
                const reservedProperty = await reserveBookingInventory(selectedProperty._id, s);
                if (!reservedProperty) {
                    const err = new Error("No beds available");
                    err.code = 409;
                    throw err;
                }

                const newBookings = await Booking.create([{
                    propertyId: selectedProperty._id,
                    propertyName: selectedProperty.propertyName,
                    userId: student._id,
                    userName: student.name,
                    userEmail: student.email,
                    price: selectedProperty.rent,
                    ownerId: selectedProperty.owner,
                    checkIn: moveInDate ? new Date(moveInDate) : null,
                    duration: duration || "",
                    status: "pending",
                    bookingStatus: "pending",
                    specialRequest: specialRequest || "",
                    inventoryReserved: true,
                    inventoryReleased: false
                }], { session: s });

                booking = newBookings[0];
            });
            return { status: 201, body: { success: true, booking } };
        } catch (err) {
            if (err.code === 409 || err.message === "No beds available") {
                return { status: 409, body: { success: false, message: "No beds available for this property." } };
            }
            if (err.code === 112 || err.message.includes("WriteConflict") || err.message.includes("write conflict")) {
                return { status: 409, body: { success: false, message: "No beds available for this property." } };
            }
            return { status: 500, body: { success: false, message: err.message } };
        } finally {
            if (session) session.endSession();
        }
    } else {
        const { reserveBookingInventory } = require("../utils/inventoryHelper");
        const reservedProperty = await reserveBookingInventory(selectedProperty._id);
        if (!reservedProperty) {
            return { status: 409, body: { success: false, message: "No beds available for this property." } };
        }

        let propertyReserved = true;
        try {
            booking = await Booking.create({
                propertyId: selectedProperty._id,
                propertyName: selectedProperty.propertyName,
                userId: student._id,
                userName: student.name,
                userEmail: student.email,
                price: selectedProperty.rent,
                ownerId: selectedProperty.owner,
                checkIn: moveInDate ? new Date(moveInDate) : null,
                duration: duration || "",
                status: "pending",
                bookingStatus: "pending",
                specialRequest: specialRequest || "",
                inventoryReserved: true,
                inventoryReleased: false
            });
            return { status: 201, body: { success: true, booking } };
        } catch (err) {
            if (propertyReserved) {
                try {
                    await Property.updateOne(
                        { _id: selectedProperty._id },
                        { $inc: { availableBeds: 1 } }
                    );
                } catch (rollbackErr) {
                    console.error("🚨 CRITICAL INVENTORY-INTEGRITY ERROR:", rollbackErr.message);
                }
            }
            if (err.code === 112 || err.message.includes("WriteConflict") || err.message.includes("write conflict")) {
                return { status: 409, body: { success: false, message: "No beds available for this property." } };
            }
            return { status: 500, body: { success: false, message: err.message } };
        }
    }
}

async function simulateBookingCreationFailure(reqBody, user) {
    // Intentionally bypass Booking model schema or throw error during creation
    const { propertyId } = reqBody;
    const { reserveBookingInventory } = require("../utils/inventoryHelper");

    let useTransaction = false;
    let session = null;
    try {
        session = await mongoose.startSession();
        session.startTransaction();
        useTransaction = true;
    } catch (e) {
        useTransaction = false;
        if (session) {
            session.endSession();
            session = null;
        }
    }

    if (useTransaction) {
        try {
            await reserveBookingInventory(propertyId, session);
            // Trigger failure
            throw new Error("Simulated creation database failure");
        } catch (err) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            session.endSession();
            return { status: 500, body: { success: false, message: err.message } };
        } finally {
            if (session) session.endSession();
        }
    } else {
        await reserveBookingInventory(propertyId);
        try {
            throw new Error("Simulated creation database failure");
        } catch (err) {
            // Programmatic rollback
            try {
                await Property.updateOne(
                    { _id: propertyId },
                    { $inc: { availableBeds: 1 } }
                );
            } catch (rollbackErr) {
                console.error("Rollback failure");
            }
            return { status: 500, body: { success: false, message: err.message } };
        }
    }
}

async function simulateCancel(bookingId, userId) {
    const booking = await Booking.findOne({ _id: bookingId, userId });
    if (booking.bookingStatus === "cancelled") {
        return { status: 400, body: { success: false, message: "Booking already cancelled" } };
    }

    const { releaseBookingInventory } = require("../utils/inventoryHelper");
    await releaseBookingInventory(booking._id);

    booking.bookingStatus = "cancelled";
    await booking.save();
    return { status: 200, body: { success: true, booking } };
}

async function simulateReject(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (booking.bookingStatus === "cancelled") {
        return { status: 400, body: { success: false, message: "Booking already cancelled" } };
    }

    const { releaseBookingInventory } = require("../utils/inventoryHelper");
    await releaseBookingInventory(booking._id);

    booking.bookingStatus = "cancelled";
    await booking.save();
    return { status: 200, body: { success: true, booking } };
}

async function simulateCheckout(bookingId) {
    const booking = await Booking.findById(bookingId);
    if (booking.bookingStatus === "checked-out") {
        return { status: 400, body: { success: false, message: "Booking already checked out" } };
    }

    const { releaseBookingInventory } = require("../utils/inventoryHelper");
    await releaseBookingInventory(booking._id);

    booking.bookingStatus = "checked-out";
    await booking.save();
    return { status: 200, body: { success: true, booking } };
}

async function runTests() {
    console.log("🚀 Starting Phase 2A Integration Tests...");
    await mongoose.connect(DB_URI);
    console.log("🌐 Connected to MongoDB.");

    let testData;
    try {
        testData = await setupTestData();
        const { propApproved1, propApproved2, propPending, propUnpublished, propBlacklisted, studentA, studentB, studentC } = testData;

        // ----------------------------------------------------
        // TEST A: Approved Property + 1 Bed
        // ----------------------------------------------------
        console.log("\n- Test A: Booking Approved Property (1 Bed)...");
        let res = await simulateBookingCreation({ propertyId: propApproved1._id }, studentA);
        console.log(`  Result: Status ${res.status}, Success: ${res.body.success}`);
        let prop = await Property.findById(propApproved1._id);
        console.log(`  availableBeds count: ${prop.availableBeds} (Expected: 0)`);
        if (res.status !== 201 || prop.availableBeds !== 0) throw new Error("Test A failed!");

        // ----------------------------------------------------
        // TEST B: Second Booking (0 beds available)
        // ----------------------------------------------------
        console.log("\n- Test B: Booking Property with 0 Beds...");
        res = await simulateBookingCreation({ propertyId: propApproved1._id }, studentB);
        console.log(`  Result: Status ${res.status}, Message: ${res.body.message}`);
        if (res.status !== 409) throw new Error("Test B failed!");

        // ----------------------------------------------------
        // TEST C: Pending Property
        // ----------------------------------------------------
        console.log("\n- Test C: Booking Pending Property...");
        res = await simulateBookingCreation({ propertyId: propPending._id }, studentA);
        console.log(`  Result: Status ${res.status}, Message: ${res.body.message}`);
        prop = await Property.findById(propPending._id);
        if (res.status !== 409 || prop.availableBeds !== 5) throw new Error("Test C failed!");

        // ----------------------------------------------------
        // TEST D: Unpublished Property
        // ----------------------------------------------------
        console.log("\n- Test D: Booking Unpublished Property...");
        res = await simulateBookingCreation({ propertyId: propUnpublished._id }, studentA);
        console.log(`  Result: Status ${res.status}, Message: ${res.body.message}`);
        prop = await Property.findById(propUnpublished._id);
        if (res.status !== 409 || prop.availableBeds !== 5) throw new Error("Test D failed!");

        // ----------------------------------------------------
        // TEST E: Blacklisted Property
        // ----------------------------------------------------
        console.log("\n- Test E: Booking Blacklisted Property...");
        res = await simulateBookingCreation({ propertyId: propBlacklisted._id }, studentA);
        console.log(`  Result: Status ${res.status}, Message: ${res.body.message}`);
        prop = await Property.findById(propBlacklisted._id);
        if (res.status !== 409 || prop.availableBeds !== 5) throw new Error("Test E failed!");

        // ----------------------------------------------------
        // TEST F: Nonexistent Property
        // ----------------------------------------------------
        console.log("\n- Test F: Booking Nonexistent Property...");
        res = await simulateBookingCreation({ propertyId: new mongoose.Types.ObjectId() }, studentA);
        console.log(`  Result: Status ${res.status}, Message: ${res.body.message}`);
        if (res.status !== 404) throw new Error("Test F failed!");

        // ----------------------------------------------------
        // TEST G: Booking Creation Failure
        // ----------------------------------------------------
        console.log("\n- Test G: Simulating Booking Creation Database Failure...");
        prop = await Property.findById(propPending._id);
        console.log(`  Initial beds count: ${prop.availableBeds}`);
        res = await simulateBookingCreationFailure({ propertyId: propPending._id }, studentA);
        console.log(`  Result: Status ${res.status}, Message: ${res.body.message}`);
        prop = await Property.findById(propPending._id);
        console.log(`  Beds count after failure: ${prop.availableBeds} (Expected: 5)`);
        if (prop.availableBeds !== 5) throw new Error("Test G failed!");

        // ----------------------------------------------------
        // TEST H: Cancellation
        // ----------------------------------------------------
        console.log("\n- Test H: Cancelling Booking...");
        const firstBooking = (await Booking.findOne({ userId: studentA._id }))._id;
        res = await simulateCancel(firstBooking, studentA._id);
        prop = await Property.findById(propApproved1._id);
        console.log(`  Result: Status ${res.status}, Beds count after cancellation: ${prop.availableBeds} (Expected: 1)`);
        if (res.status !== 200 || prop.availableBeds !== 1) throw new Error("Test H failed!");

        // ----------------------------------------------------
        // TEST I: Duplicate Cancellation
        // ----------------------------------------------------
        console.log("\n- Test I: Attempting Duplicate Cancellation...");
        res = await simulateCancel(firstBooking, studentA._id);
        prop = await Property.findById(propApproved1._id);
        console.log(`  Result: Status ${res.status}, Beds count: ${prop.availableBeds} (Expected: 1)`);
        if (res.status !== 400 || prop.availableBeds !== 1) throw new Error("Test I failed!");

        // ----------------------------------------------------
        // TEST J: Owner Rejection
        // ----------------------------------------------------
        console.log("\n- Test J: Booking and Rejection...");
        // Re-book propApproved1
        res = await simulateBookingCreation({ propertyId: propApproved1._id }, studentA);
        const secondBooking = res.body.booking._id;
        prop = await Property.findById(propApproved1._id);
        console.log(`  Beds count after booking: ${prop.availableBeds} (Expected: 0)`);
        // Reject
        res = await simulateReject(secondBooking);
        prop = await Property.findById(propApproved1._id);
        console.log(`  Beds count after rejection: ${prop.availableBeds} (Expected: 1)`);
        if (prop.availableBeds !== 1) throw new Error("Test J failed!");

        // ----------------------------------------------------
        // TEST K: Confirmation
        // ----------------------------------------------------
        console.log("\n- Test K: Booking and Confirming (Inventory must not change)...");
        res = await simulateBookingCreation({ propertyId: propApproved1._id }, studentA);
        const thirdBooking = res.body.booking;
        prop = await Property.findById(propApproved1._id);
        console.log(`  Beds count after booking: ${prop.availableBeds} (Expected: 0)`);
        // Confirm
        thirdBooking.bookingStatus = "confirmed";
        await thirdBooking.save();
        prop = await Property.findById(propApproved1._id);
        console.log(`  Beds count after confirmation: ${prop.availableBeds} (Expected: 0)`);
        if (prop.availableBeds !== 0) throw new Error("Test K failed!");

        // ----------------------------------------------------
        // TEST L: Check-in
        // ----------------------------------------------------
        console.log("\n- Test L: Checking In (Inventory must not change)...");
        thirdBooking.bookingStatus = "checked-in";
        await thirdBooking.save();
        prop = await Property.findById(propApproved1._id);
        console.log(`  Beds count after check-in: ${prop.availableBeds} (Expected: 0)`);
        if (prop.availableBeds !== 0) throw new Error("Test L failed!");

        // ----------------------------------------------------
        // TEST M: Checkout
        // ----------------------------------------------------
        console.log("\n- Test M: Checking Out...");
        res = await simulateCheckout(thirdBooking._id);
        prop = await Property.findById(propApproved1._id);
        console.log(`  Result: Status ${res.status}, Beds count after checkout: ${prop.availableBeds} (Expected: 1)`);
        if (res.status !== 200 || prop.availableBeds !== 1) throw new Error("Test M failed!");

        // ----------------------------------------------------
        // TEST N: Concurrent Requests (1 bed available)
        // ----------------------------------------------------
        console.log("\n- Test N: Concurrent Booking Requests (1 Bed)...");
        // Reset propApproved1 to 1 bed
        await Property.updateOne({ _id: propApproved1._id }, { $set: { availableBeds: 1 } });
        await Booking.deleteMany({ propertyId: propApproved1._id });

        // Fire concurrent requests
        const reqsN = [
            simulateBookingCreation({ propertyId: propApproved1._id }, studentA),
            simulateBookingCreation({ propertyId: propApproved1._id }, studentB)
        ];
        const resultsN = await Promise.all(reqsN);
        console.log(`  Detailed Results N: ${JSON.stringify(resultsN)}`);
        const successesN = resultsN.filter(r => r.status === 201);
        const conflictsN = resultsN.filter(r => r.status === 409);
        prop = await Property.findById(propApproved1._id);
        console.log(`  Successes: ${successesN.length} (Expected: 1)`);
        console.log(`  Conflicts (409): ${conflictsN.length} (Expected: 1)`);
        console.log(`  Final availableBeds: ${prop.availableBeds} (Expected: 0)`);
        if (successesN.length !== 1 || conflictsN.length !== 1 || prop.availableBeds !== 0) {
            throw new Error("Test N failed!");
        }

        // ----------------------------------------------------
        // TEST O: Concurrent Requests (2 beds available)
        // ----------------------------------------------------
        console.log("\n- Test O: Concurrent Booking Requests (2 Beds)...");
        const reqsO = [
            simulateBookingCreation({ propertyId: propApproved2._id }, studentA),
            simulateBookingCreation({ propertyId: propApproved2._id }, studentB),
            simulateBookingCreation({ propertyId: propApproved2._id }, studentC)
        ];
        const resultsO = await Promise.all(reqsO);
        const successesO = resultsO.filter(r => r.status === 201);
        const conflictsO = resultsO.filter(r => r.status === 409);
        prop = await Property.findById(propApproved2._id);
        console.log(`  Successes: ${successesO.length} (Expected: 2)`);
        console.log(`  Conflicts (409): ${conflictsO.length} (Expected: 1)`);
        console.log(`  Final availableBeds: ${prop.availableBeds} (Expected: 0)`);
        if (successesO.length !== 2 || conflictsO.length !== 1 || prop.availableBeds !== 0) {
            throw new Error("Test O failed!");
        }

        console.log("\n🎉 ALL SCENARIO TESTS PASSED SUCCESSFULLY!");

    } catch (err) {
        console.error("\n❌ TEST FAILURE:", err.message);
        process.exit(1);
    } finally {
        if (testData) {
            console.log("\n🧹 Cleaning up test database data...");
            await cleanTestData(testData);
        }
        await mongoose.disconnect();
        console.log("🔌 Disconnected.");
    }
}

runTests();
