const { getSupabaseClient } = require('../../config/supabase');
const { mongoIdToPostgresId } = require('../../utils/idMapper');

async function findPropertyById(id) {
    if (!id) return null;
    const db = await getSupabaseClient();
    const pgId = mongoIdToPostgresId(id) || id;
    const res = await db.query(`
        SELECT p.*, prof.name AS owner_name, prof.email AS owner_email
        FROM properties p
        LEFT JOIN profiles prof ON p.owner_id = prof.id
        WHERE p.id = $1 OR p.mongo_id = $2
        LIMIT 1
    `, [pgId, String(id)]);

    if (res.rows.length === 0) return null;
    const r = res.rows[0];
    return {
        _id: r.mongo_id || r.id,
        id: r.id,
        propertyName: r.property_name,
        propertyType: r.property_type,
        rent: parseFloat(r.rent),
        deposit: parseFloat(r.deposit || 0),
        availableBeds: r.available_beds,
        totalBeds: r.total_beds,
        owner: {
            id: r.owner_id,
            name: r.owner_name || '',
            email: r.owner_email || ''
        },
        status: r.status,
        createdAt: r.created_at
    };
}

async function listProperties(filter = {}) {
    const db = await getSupabaseClient();
    const res = await db.query(`
        SELECT p.*, prof.name AS owner_name, prof.email AS owner_email
        FROM properties p
        LEFT JOIN profiles prof ON p.owner_id = prof.id
        ORDER BY p.created_at DESC
    `);
    return res.rows.map(r => ({
        _id: r.mongo_id || r.id,
        id: r.id,
        propertyName: r.property_name,
        propertyType: r.property_type,
        rent: parseFloat(r.rent),
        deposit: parseFloat(r.deposit || 0),
        availableBeds: r.available_beds,
        totalBeds: r.total_beds,
        owner: {
            id: r.owner_id,
            name: r.owner_name || '',
            email: r.owner_email || ''
        },
        status: r.status,
        createdAt: r.created_at
    }));
}

module.exports = {
    findPropertyById,
    listProperties
};
