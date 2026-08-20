const { getSupabaseClient } = require('../../config/supabase');
const { mongoIdToPostgresId } = require('../../utils/idMapper');

const isUUID = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

async function reserveBookingInventory(propertyId) {
    const db = await getSupabaseClient();
    const pgId = mongoIdToPostgresId(propertyId) || propertyId;

    let res = null;
    if (isUUID(pgId)) {
        res = await db.query(`
            UPDATE properties
            SET available_beds = available_beds - 1,
                updated_at = NOW()
            WHERE (id = $1 OR mongo_id = $2)
              AND status = 'approved'
              AND published = true
              AND blacklisted = false
              AND available_beds > 0
            RETURNING *
        `, [pgId, String(propertyId)]);
    } else {
        res = await db.query(`
            UPDATE properties
            SET available_beds = available_beds - 1,
                updated_at = NOW()
            WHERE mongo_id = $1
              AND status = 'approved'
              AND published = true
              AND blacklisted = false
              AND available_beds > 0
            RETURNING *
        `, [String(propertyId)]);
    }

    if (!res || res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
        _id: r.mongo_id || r.id,
        id: r.id,
        availableBeds: r.available_beds,
        totalBeds: r.total_beds
    };
}

async function releaseBookingInventory(bookingId) {
    const db = await getSupabaseClient();
    const pgId = mongoIdToPostgresId(bookingId) || bookingId;

    let bRes = null;
    if (isUUID(pgId)) {
        bRes = await db.query(`
            UPDATE bookings
            SET inventory_released = true,
                updated_at = NOW()
            WHERE (id = $1 OR mongo_id = $2)
              AND inventory_reserved = true
              AND inventory_released = false
            RETURNING property_id
        `, [pgId, String(bookingId)]);
    } else {
        bRes = await db.query(`
            UPDATE bookings
            SET inventory_released = true,
                updated_at = NOW()
            WHERE mongo_id = $1
              AND inventory_reserved = true
              AND inventory_released = false
            RETURNING property_id
        `, [String(bookingId)]);
    }

    if (!bRes || bRes.rows.length === 0) {
        return false; // Already released or inventory was never reserved
    }

    const propId = bRes.rows[0].property_id;
    if (propId) {
        await db.query(`
            UPDATE properties
            SET available_beds = available_beds + 1,
                updated_at = NOW()
            WHERE id = $1
        `, [propId]);
    }

    return true;
}

module.exports = {
    reserveBookingInventory,
    releaseBookingInventory
};
