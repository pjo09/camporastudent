const { getSupabaseClient } = require('../../config/supabase');
const { mongoIdToPostgresId } = require('../../utils/idMapper');

async function findUserByEmail(email) {
    if (!email) return null;
    const db = await getSupabaseClient();
    const res = await db.query(
        `SELECT * FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email.trim()]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
        _id: row.mongo_id || row.id,
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        accountStatus: row.account_status, // Authoritative approval state
        verified: row.verified,
        status: row.status,
        phone: row.phone,
        createdAt: row.created_at
    };
}

async function findUserById(id) {
    if (!id) return null;
    const db = await getSupabaseClient();
    const strId = String(id);
    const res = await db.query(
        `SELECT * FROM profiles WHERE id::text = $1 OR mongo_id = $1 LIMIT 1`,
        [strId]
    );
    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
        _id: row.mongo_id || row.id,
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        accountStatus: row.account_status,
        verified: row.verified,
        status: row.status,
        phone: row.phone,
        createdAt: row.created_at
    };
}

async function createUser(userData) {
    const db = await getSupabaseClient();
    const res = await db.query(`
        INSERT INTO profiles (
            name, email, password_hash, role, phone, account_status, status, verified
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        RETURNING *
    `, [
        userData.name || 'Unknown',
        (userData.email || '').toLowerCase().trim(),
        userData.password || null,
        userData.role || 'student',
        userData.phone || '',
        userData.accountStatus || 'ACTIVE',
        userData.status || 'active',
        !!userData.verified
    ]);
    const row = res.rows[0];
    return {
        _id: row.id,
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        accountStatus: row.account_status,
        verified: row.verified,
        status: row.status
    };
}

async function updateUserApprovalStatus(id, accountStatus) {
    const db = await getSupabaseClient();
    const pgId = mongoIdToPostgresId(id) || id;
    const res = await db.query(`
        UPDATE profiles
        SET account_status = $1,
            verified = ($1 = 'ACTIVE'),
            status = CASE WHEN $1 = 'ACTIVE' THEN 'active' ELSE 'inactive' END,
            updated_at = NOW()
        WHERE id = $2 OR mongo_id = $3
        RETURNING *
    `, [accountStatus, pgId, String(id)]);

    if (res.rows.length === 0) return null;
    const row = res.rows[0];
    return {
        _id: row.mongo_id || row.id,
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        accountStatus: row.account_status,
        verified: row.verified,
        status: row.status
    };
}

module.exports = {
    findUserByEmail,
    findUserById,
    createUser,
    updateUserApprovalStatus
};
