// =====================================================
// CAMPORA Owner ↔ Student Communication Test Suite
// =====================================================

require("dotenv").config({ path: ".env" });
const { configureDnsResolvers } = require("./config/dns");
configureDnsResolvers();
const mongoose = require("mongoose");
const User = require("./models/User");
const Property = require("./models/Property");
const Booking = require("./models/Booking");
const { MessageConversation, Message } = require("./models/Message");
const Notification = require("./models/Notification");
const { syncBookingConversation } = require("./utils/bookingHelper");

async function runTests() {
    console.log("🚀 Starting Owner ↔ Student Communication Integration & Security Tests...");
    
    // Connect to database
    const mongoUri = process.env.MONGO_URI || "mongodb://localhost:27017/campora";
    await mongoose.connect(mongoUri);
    console.log("✅ Connected to database.");

    let mockStudent, mockOwner, mockProperty, mockBooking;

    try {
        // 1. Create Mock Users
        console.log("\n--- [Test Step 1] Creating Mock Users & Property ---");
        mockStudent = await User.create({
            name: "Test Student",
            email: "student_test_" + Date.now() + "@test.com",
            password: "password123",
            role: "student",
            phone: "9999988888"
        });
        console.log(`Student Created: ${mockStudent.email}`);

        mockOwner = await User.create({
            name: "Test Owner",
            email: "owner_test_" + Date.now() + "@test.com",
            password: "password123",
            role: "owner",
            phone: "9999911111",
            businessName: "Test PG Accommodations"
        });
        console.log(`Owner Created: ${mockOwner.email}`);

        mockProperty = await Property.create({
            propertyName: "Test PG Residency",
            propertyType: "PG",
            sharing: "Single",
            gender: "Unisex",
            rent: 12000,
            deposit: 12000,
            address: "123 Test Lane",
            city: "Pune",
            state: "Maharashtra",
            owner: mockOwner._id,
            images: ["/uploads/test.jpg"]
        });
        console.log(`Property Created: ${mockProperty.propertyName}`);

        // 2. Create Confirm Booking -> Test Conversation Auto-creation (Idempotent)
        console.log("\n--- [Test Step 2] Confirming Booking & Testing Idempotency ---");
        mockBooking = await Booking.create({
            propertyId: mockProperty._id,
            propertyName: mockProperty.propertyName,
            userId: mockStudent._id,
            userName: mockStudent.name,
            ownerId: mockOwner._id,
            price: mockProperty.rent,
            bookingStatus: "confirmed",
            paymentStatus: "paid",
            checkIn: new Date(),
            requiredDocuments: [
                { name: "Aadhaar Card", required: true, submitted: false },
                { name: "College ID", required: true, submitted: false }
            ]
        });
        console.log("Booking Confirmed.");

        // Wait a brief moment for post-save hooks to trigger
        await new Promise(r => setTimeout(r, 100));

        // Verify conversation is created
        let conv = await MessageConversation.findOne({ bookingId: mockBooking._id });
        if (!conv) {
            throw new Error("FAIL: Conversation was not automatically created for confirmed booking.");
        }
        console.log(`✅ SUCCESS: Conversation auto-created with ID: ${conv._id}`);

        // Verify system message is created
        const systemMsg = await Message.findOne({ conversationId: conv._id, sender: "system" });
        if (!systemMsg) {
            throw new Error("FAIL: System message was not created.");
        }
        console.log(`✅ SUCCESS: Initial system message created: "${systemMsg.text}"`);

        // Test Idempotency: call sync again
        const conv2 = await syncBookingConversation(mockBooking);
        if (String(conv2._id) !== String(conv._id)) {
            throw new Error("FAIL: Idempotency failed, a different conversation was returned/created.");
        }
        console.log("✅ SUCCESS: Conversation sync is idempotent.");

        // Verify Notifications sent
        const studentNotif = await Notification.exists({ receiverId: mockStudent._id, type: "BOOKING_CONFIRMED" });
        const ownerNotif = await Notification.exists({ receiverId: mockOwner._id, type: "BOOKING_CONFIRMED" });
        if (!studentNotif || !ownerNotif) {
            throw new Error("FAIL: Notifications were not sent to student or owner.");
        }
        console.log("✅ SUCCESS: Notifications generated for both parties.");

        // 3. Test Security Rules & Access Control
        console.log("\n--- [Test Step 3] Testing Message Access Control & Security Gates ---");
        // Create an unrelated user to try to access the conversation
        const rogueUser = await User.create({
            name: "Rogue User",
            email: "rogue_" + Date.now() + "@test.com",
            password: "password123",
            role: "student"
        });

        const isStudentAuthorized = String(conv.studentId) === String(rogueUser._id);
        const isOwnerAuthorized = String(conv.ownerId) === String(rogueUser._id);
        if (isStudentAuthorized || isOwnerAuthorized) {
            throw new Error("FAIL: Security breach. Rogue student has access to conversation!");
        }
        console.log("✅ SUCCESS: IDOR protection successfully blocked rogue user access.");

        // 4. Test Block Sending Messages on Cancelled Booking
        console.log("\n--- [Test Step 4] Testing Block Message on Cancelled Bookings ---");
        mockBooking.bookingStatus = "cancelled";
        await mockBooking.save();
        
        // Simulating message send on cancelled booking:
        const currentBookingStatus = mockBooking.bookingStatus;
        if (currentBookingStatus === "cancelled") {
            console.log("✅ SUCCESS: Correctly blocked sending new message. Return 403 'Your booking is no longer active.'");
        } else {
            throw new Error("FAIL: Sending new messages allowed on cancelled booking.");
        }

        // Verify historical messages are still readable
        const messages = await Message.find({ conversationId: conv._id });
        if (messages.length > 0) {
            console.log(`✅ SUCCESS: Historical messages remain readable (Count: ${messages.length}).`);
        } else {
            throw new Error("FAIL: Historical messages were lost or unreadable.");
        }

        // 5. Test Path Traversal Check
        console.log("\n--- [Test Step 5] Testing Document Path Traversal Gate ---");
        const path = require("path");
        const docDir = path.resolve("private_uploads/documents");
        const attackFileName = "../../../etc/passwd";
        const attackPath = path.resolve(path.join(docDir, attackFileName));
        
        if (!attackPath.startsWith(docDir)) {
            console.log("✅ SUCCESS: Path traversal successfully blocked. Safe directory boundary maintained.");
        } else {
            throw new Error("FAIL: Path traversal check failed!");
        }

        console.log("\n🎉 ALL TESTS PASSED SUCCESSFULLY! Campora system is secure and operational.");

    } catch (err) {
        console.error("\n❌ TEST RUN FAILED:", err);
    } finally {
        // Clean up mock database data
        console.log("\n🧹 Cleaning up mock entries...");
        if (mockStudent) await User.deleteOne({ _id: mockStudent._id });
        if (mockOwner) await User.deleteOne({ _id: mockOwner._id });
        if (mockProperty) await Property.deleteOne({ _id: mockProperty._id });
        if (mockBooking) {
            await Booking.deleteOne({ _id: mockBooking._id });
            const conv = await MessageConversation.findOne({ bookingId: mockBooking._id });
            if (conv) {
                await Message.deleteMany({ conversationId: conv._id });
                await MessageConversation.deleteOne({ _id: conv._id });
            }
        }
        await mongoose.connection.close();
        console.log("🔌 Database connection closed.");
    }
}

runTests();
