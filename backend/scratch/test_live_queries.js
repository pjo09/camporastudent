const path = require('path');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });
process.env.DATABASE_PROVIDER = 'supabase';

const { getSupabaseClient } = require('../config/supabase');

async function testLiveQueries() {
    console.log("=========================================");
    console.log("TESTING READ-ONLY LIVE SUPABASE QUERIES");
    console.log("=========================================\n");

    const db = await getSupabaseClient();

    // 1. Properties count
    const propsCount = await db.query(`SELECT COUNT(*) FROM properties WHERE status = 'approved' AND published = true AND available = true AND (blacklisted IS NULL OR blacklisted = false)`);
    console.log("Approved Properties Count:", propsCount.rows[0].cnt || propsCount.rows[0].count);

    // 2. Verified owners
    const ownersCount = await db.query(`SELECT COUNT(*) FROM profiles WHERE role = 'owner' AND account_status = 'ACTIVE'`);
    console.log("Verified Owners Count:", ownersCount.rows[0].cnt || ownersCount.rows[0].count);

    // 3. Students count
    const studentsCount = await db.query(`SELECT COUNT(*) FROM profiles WHERE role = 'student' AND account_status = 'ACTIVE'`);
    console.log("Students Count:", studentsCount.rows[0].cnt || studentsCount.rows[0].count);

    // 4. Distinct Cities count
    const citiesCount = await db.query(`SELECT COUNT(DISTINCT city) FROM properties WHERE status = 'approved' AND published = true AND available = true AND (blacklisted IS NULL OR blacklisted = false) AND city <> ''`);
    console.log("Distinct Cities Count:", citiesCount.rows[0].cnt || citiesCount.rows[0].count);

    // 5. Distinct Universities count
    const unisCount = await db.query(`SELECT COUNT(DISTINCT college) FROM properties WHERE status = 'approved' AND published = true AND available = true AND (blacklisted IS NULL OR blacklisted = false) AND college <> ''`);
    console.log("Distinct Universities Count:", unisCount.rows[0].cnt || unisCount.rows[0].count);

    // 6. Bookings count
    const bookingsCount = await db.query(`SELECT COUNT(*) FROM bookings`);
    console.log("Bookings Count:", bookingsCount.rows[0].cnt || bookingsCount.rows[0].count);

    // 7. Reviews count
    const reviewsCount = await db.query(`SELECT COUNT(*) FROM reviews`);
    console.log("Reviews Count:", reviewsCount.rows[0].cnt || reviewsCount.rows[0].count);

    // 8. Test properties search query with sort rating and limit
    const searchRes = await db.query(`
        SELECT p.*, prof.name AS owner_name, prof.email AS owner_email
        FROM properties p
        LEFT JOIN profiles prof ON p.owner_id = prof.id
        WHERE p.status = 'approved' AND p.published = true AND p.available = true AND (p.blacklisted IS NULL OR p.blacklisted = false)
        ORDER BY p.average_rating DESC, p.created_at DESC
        LIMIT 6 OFFSET 0
    `);
    console.log(`\nProperties Search (rating sort, limit 6) returned ${searchRes.rows.length} rows.`);

    console.log("\n=========================================");
    console.log("READ-ONLY QUERY TESTS COMPLETED");
    console.log("=========================================");
}

testLiveQueries().catch(err => {
    console.error("Test live queries error:", err);
    process.exit(1);
});
