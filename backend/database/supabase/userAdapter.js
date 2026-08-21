const { getSupabaseClient } = require('../../config/supabase');
const { mongoIdToPostgresId } = require('../../utils/idMapper');

function formatUserRow(row) {
    if (!row) return null;
    return {
        _id: row.mongo_id || row.id,
        id: row.id,
        name: row.name,
        email: row.email,
        role: row.role,
        accountStatus: row.account_status, // Authoritative approval state
        verified: row.verified,
        status: row.status,
        phone: row.phone || '',
        password: row.password_hash || '',
        googleId: row.google_id || '',
        avatar: row.avatar_url || row.profile_image || '',
        profileImage: row.profile_image || row.avatar_url || '',
        businessName: row.business_name || '',
        city: row.city || '',
        college: row.college || '',
        course: row.course || '',
        year: row.year || '',
        createdAt: row.created_at
    };
}

async function findUserByEmail(email) {
    if (!email) return null;
    const db = await getSupabaseClient();
    const res = await db.query(
        `SELECT * FROM profiles WHERE LOWER(email) = LOWER($1) LIMIT 1`,
        [email.trim()]
    );
    if (res.rows.length === 0) return null;
    return formatUserRow(res.rows[0]);
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
    return formatUserRow(res.rows[0]);
}

async function createUser(userData) {
    const db = await getSupabaseClient();
    const cleanEmail = (userData.email || '').toLowerCase().trim();
    const res = await db.query(`
        INSERT INTO profiles (
            name, email, password_hash, role, phone, account_status, status, verified, google_id, avatar_url, profile_image
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
    `, [
        userData.name || 'Unknown',
        cleanEmail,
        userData.password || userData.passwordHash || null,
        userData.role || 'student',
        userData.phone || '',
        userData.accountStatus || 'ACTIVE',
        userData.status || 'active',
        !!userData.verified,
        userData.googleId || null,
        userData.avatar || userData.profileImage || '',
        userData.profileImage || userData.avatar || ''
    ]);
    return formatUserRow(res.rows[0]);
}

async function updateUser(id, updates) {
    if (!id) return null;
    const db = await getSupabaseClient();
    const strId = String(id);

    const fields = [];
    const values = [];
    let idx = 1;

    if (updates.googleId !== undefined) {
        fields.push(`google_id = $${idx++}`);
        values.push(updates.googleId);
    }
    if (updates.profileImage !== undefined || updates.avatar !== undefined) {
        const img = updates.profileImage || updates.avatar;
        fields.push(`profile_image = $${idx++}`);
        values.push(img);
        fields.push(`avatar_url = $${idx++}`);
        values.push(img);
    }
    if (updates.accountStatus !== undefined) {
        fields.push(`account_status = $${idx++}`);
        values.push(updates.accountStatus);
    }
    if (updates.status !== undefined) {
        fields.push(`status = $${idx++}`);
        values.push(updates.status);
    }
    if (updates.verified !== undefined) {
        fields.push(`verified = $${idx++}`);
        values.push(!!updates.verified);
    }

    fields.push(`updated_at = NOW()`);
    values.push(strId);

    const sql = `UPDATE profiles SET ${fields.join(', ')} WHERE id::text = $${idx} OR mongo_id = $${idx} RETURNING *`;
    const res = await db.query(sql, values);
    if (res.rows.length === 0) return null;
    return formatUserRow(res.rows[0]);
}

async function updateUserApprovalStatus(id, accountStatus) {
    return await updateUser(id, {
        accountStatus,
        verified: accountStatus === 'ACTIVE',
        status: accountStatus === 'ACTIVE' ? 'active' : 'inactive'
    });
}

module.exports = {
    findUserByEmail,
    findUserById,
    createUser,
    updateUser,
    updateUserApprovalStatus
};
