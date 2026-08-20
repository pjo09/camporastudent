const { getSupabaseClient } = require('../../config/supabase');
const { mongoIdToPostgresId } = require('../../utils/idMapper');

async function findBookingById(id) {
    if (!id) return null;
    const db = await getSupabaseClient();
    const pgId = mongoIdToPostgresId(id) || id;
    const res = await db.query(`
        SELECT * FROM bookings WHERE id = $1 OR mongo_id = $2 LIMIT 1
    `, [pgId, String(id)]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
        _id: r.mongo_id || r.id,
        id: r.id,
        bookingStatus: r.booking_status,
        paymentStatus: r.payment_status,
        price: parseFloat(r.price),
        inventoryReserved: r.inventory_reserved,
        inventoryReleased: r.inventory_released,
        checkIn: r.check_in,
        checkOut: r.check_out,
        createdAt: r.created_at
    };
}

async function listBookings(filter = {}) {
    const db = await getSupabaseClient();
    const res = await db.query(`SELECT * FROM bookings ORDER BY created_at DESC`);
    return res.rows.map(r => ({
        _id: r.mongo_id || r.id,
        id: r.id,
        bookingStatus: r.booking_status,
        paymentStatus: r.payment_status,
        price: parseFloat(r.price),
        inventoryReserved: r.inventory_reserved,
        inventoryReleased: r.inventory_released,
        checkIn: r.check_in,
        checkOut: r.check_out,
        createdAt: r.created_at
    }));
}

module.exports = {
    findBookingById,
    listBookings
};
