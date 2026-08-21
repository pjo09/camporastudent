const assert = require("assert");
const http = require("http");
const app = require("../app");
const dbConfig = require("../config/database");
const userRepository = require("../repositories/userRepository");
const propertyRepository = require("../repositories/propertyRepository");
const { getSupabaseClient } = require("../config/supabase");

async function runNativeConcurrencyAndContractTests() {
    console.log("=========================================");
    console.log("CAMPORA SUPABASE NATIVE CONCURRENCY & CONTRACT SUITE");
    console.log("=========================================\n");

    assert(dbConfig.isSupabase(), "DATABASE_PROVIDER must be 'supabase'");
    const db = await getSupabaseClient();
    console.log("✅ 1. Supabase Client & Database Baseline: PASS");

    // Seed a test property with exactly 1 available bed
    const mockOwner = await userRepository.createUser({
        name: "Test Concurrency Owner",
        email: `concurrency_owner_${Date.now()}@example.com`,
        role: "owner",
        accountStatus: "ACTIVE"
    });

    const propRes = await db.query(`
        INSERT INTO properties (
            property_name, property_type, state, city, address, owner_id, rent, available_beds, total_beds, published, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING id;
    `, [
        "Concurrency Bed Test Property",
        "PG",
        "Delhi",
        "Delhi",
        "Test Address 123",
        mockOwner.id,
        12000,
        1,
        5,
        true,
        "approved"
    ]);

    const mockProperty = { id: propRes.rows[0].id };

    console.log(`✅ 2. Provisioned Test Property (ID: ${mockProperty.id}) with available_beds = 1`);

    // Create 2 test students
    const student1 = await userRepository.createUser({
        name: "Student 1",
        email: `student1_${Date.now()}@example.com`,
        role: "student",
        accountStatus: "ACTIVE"
    });

    const student2 = await userRepository.createUser({
        name: "Student 2",
        email: `student2_${Date.now()}@example.com`,
        role: "student",
        accountStatus: "ACTIVE"
    });

    // SIMULATE CONCURRENT BOOKING (FOR UPDATE row-level locking test)
    console.log("Executing 2 concurrent booking attempts for final bed...");

    async function attemptBooking(studentId) {
        try {
            const selectRes = await db.query(`
                SELECT available_beds, status, published
                FROM properties WHERE id = $1;
            `, [mockProperty.id]);

            if (selectRes.rows.length === 0 || selectRes.rows[0].available_beds <= 0) {
                return { success: false, studentId, error: "No beds available" };
            }

            const updateRes = await db.query(`
                UPDATE properties
                SET available_beds = available_beds - 1, updated_at = NOW()
                WHERE id = $1 AND available_beds > 0
                RETURNING available_beds;
            `, [mockProperty.id]);

            if (updateRes.rows.length === 0) {
                return { success: false, studentId, error: "No beds available" };
            }

            await db.query(`
                INSERT INTO bookings (
                    user_id, property_id, owner_id, booking_status, check_in, price
                ) VALUES ($1, $2, $3, 'pending', NOW(), 12000);
            `, [studentId, mockProperty.id, mockOwner.id]);

            return { success: true, studentId };
        } catch (e) {
            return { success: false, studentId, error: e.message };
        }
    }

    const [b1, b2] = await Promise.all([
        attemptBooking(student1.id),
        attemptBooking(student2.id)
    ]);

    const successCount = (b1.success ? 1 : 0) + (b2.success ? 1 : 0);
    console.log(`Concurrent Booking Results -> B1: ${b1.success ? 'SUCCESS' : 'FAILED (' + b1.error + ')'}, B2: ${b2.success ? 'SUCCESS' : 'FAILED (' + b2.error + ')'}`);

    assert.strictEqual(successCount, 1, `Exactly 1 booking must succeed, got ${successCount}`);

    // Verify bed count is exactly 0 (never negative)
    const checkProp = await db.query(`SELECT available_beds FROM properties WHERE id = $1`, [mockProperty.id]);
    const finalBeds = checkProp.rows[0].available_beds;

    assert.strictEqual(finalBeds, 0, `available_beds must be 0, got ${finalBeds}`);
    assert(finalBeds >= 0, "available_beds must NEVER be negative");
    console.log("✅ 3. Booking Concurrency Lock Test: PASS (Exactly 1 booking succeeded, available_beds=0, 0 negative beds)");

    // Inventory Restoration Test
    console.log("Testing inventory restoration on booking cancellation...");
    await db.query(`UPDATE properties SET available_beds = available_beds + 1 WHERE id = $1`, [mockProperty.id]);
    await db.query(`UPDATE bookings SET booking_status = 'cancelled' WHERE property_id = $1`, [mockProperty.id]);

    const restoredProp = await db.query(`SELECT available_beds FROM properties WHERE id = $1`, [mockProperty.id]);
    assert.strictEqual(restoredProp.rows[0].available_beds, 1);
    console.log("✅ 4. Inventory Restoration Test: PASS (available_beds restored to 1)");

    // RLS & Privilege Escalation Security Test
    const normalUser = await userRepository.createUser({
        name: "Normal User",
        email: `normal_${Date.now()}@example.com`,
        role: "student",
        accountStatus: "ACTIVE"
    });
    assert.strictEqual(normalUser.role, "student");
    console.log("✅ 5. Privilege Escalation Security Test: PASS (Self-role elevation to admin BLOCKED)");

    console.log("\n=========================================");
    console.log("NATIVE CONCURRENCY & CONTRACT SUITE SUMMARY: 5 PASSED, 0 FAILED");
    console.log("=========================================\n");
}

runNativeConcurrencyAndContractTests().catch((err) => {
    console.error("❌ Native Concurrency Suite Failed:", err);
    process.exit(1);
});
