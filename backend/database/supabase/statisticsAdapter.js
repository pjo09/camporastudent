const { getSupabaseClient } = require('../../config/supabase');

async function getPublicStatistics() {
    const db = await getSupabaseClient();

    const [
        propsRes,
        ownersRes,
        studentsRes,
        citiesRes,
        unisRes,
        bookingsRes,
        reviewsRes
    ] = await Promise.all([
        db.query(`SELECT COUNT(*) as cnt FROM properties WHERE status = 'approved' AND published = true AND available = true AND (blacklisted IS NULL OR blacklisted = false)`),
        db.query(`SELECT COUNT(*) as cnt FROM profiles WHERE role = 'owner' AND account_status = 'ACTIVE'`),
        db.query(`SELECT COUNT(*) as cnt FROM profiles WHERE role = 'student' AND account_status = 'ACTIVE'`),
        db.query(`SELECT COUNT(DISTINCT city) as cnt FROM properties WHERE status = 'approved' AND published = true AND available = true AND (blacklisted IS NULL OR blacklisted = false) AND city <> ''`),
        db.query(`SELECT COUNT(DISTINCT college) as cnt FROM properties WHERE status = 'approved' AND published = true AND available = true AND (blacklisted IS NULL OR blacklisted = false) AND college <> ''`),
        db.query(`SELECT COUNT(*) as cnt FROM bookings`),
        db.query(`SELECT COUNT(*) as cnt FROM reviews`)
    ]);

    const parseCnt = (res) => {
        if (!res || !res.rows || res.rows.length === 0) return 0;
        const row = res.rows[0];
        return parseInt(row.cnt || row.count || 0, 10);
    };

    return {
        properties: parseCnt(propsRes),
        verifiedOwners: parseCnt(ownersRes),
        students: parseCnt(studentsRes),
        cities: parseCnt(citiesRes),
        universities: parseCnt(unisRes),
        bookings: parseCnt(bookingsRes),
        reviews: parseCnt(reviewsRes)
    };
}

module.exports = {
    getPublicStatistics
};
