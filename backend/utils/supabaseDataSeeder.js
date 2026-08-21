const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function getBackupDir() {
    const candidates = [
        path.join(__dirname, '../scratch/backup'),
        path.join(__dirname, '../../scratch/backup'),
        'C:\\Users\\piyus\\.gemini\\antigravity\\brain\\ea8e4fcd-6d54-4f7b-bbb6-9bbce5e9d5ab\\scratch\\backup',
        path.join(process.cwd(), 'scratch/backup')
    ];
    for (const dir of candidates) {
        if (fs.existsSync(dir)) return dir;
    }
    return null;
}

async function seedSupabaseData(db) {
    const backupDir = getBackupDir();
    if (!backupDir) {
        console.log("ℹ️ No backup directory found for seeding. Initializing clean database.");
        return;
    }

    // Check if database already seeded
    try {
        const checkRes = await db.query(`SELECT COUNT(*) as cnt FROM profiles`);
        const count = parseInt(checkRes.rows[0]?.cnt || 0, 10);
        if (count > 0) {
            console.log(`[SupabaseSeeder] Database already contains ${count} profiles. Skipping seed.`);
            return;
        }
    } catch (e) {
        // Table may not exist yet or count error, continue seeding
    }

    console.log(`[SupabaseSeeder] Seeding initial dataset from ${backupDir}...`);

    const loadBackup = (colName) => {
        const p = path.join(backupDir, `${colName}.json`);
        if (!fs.existsSync(p)) return [];
        return JSON.parse(fs.readFileSync(p, 'utf8'));
    };

    const rawUsers = loadBackup('users');
    const rawProperties = loadBackup('properties');
    const rawBookings = loadBackup('bookings');
    const rawReviews = loadBackup('reviews');
    const rawConversations = loadBackup('messageconversations');
    const rawMessages = loadBackup('messages');

    const mongoToPgIdMap = new Map();
    const getId = (mongoId) => {
        if (!mongoId) return null;
        const strId = typeof mongoId === 'object' && mongoId.$oid ? mongoId.$oid : mongoId.toString();
        if (!mongoToPgIdMap.has(strId)) {
            mongoToPgIdMap.set(strId, crypto.randomUUID());
        }
        return mongoToPgIdMap.get(strId);
    };

    const validUserMongoIds = new Set(rawUsers.map(u => typeof u._id === 'object' && u._id.$oid ? u._id.$oid : u._id.toString()));
    const validPropMongoIds = new Set(rawProperties.map(p => typeof p._id === 'object' && p._id.$oid ? p._id.$oid : p._id.toString()));

    try {
        if (typeof db.exec === 'function') {
            await db.exec('BEGIN;');
        }

        let adminPgId = null;

        // STEP A: PROFILES
        for (const u of rawUsers) {
            const mongoIdStr = typeof u._id === 'object' && u._id.$oid ? u._id.$oid : u._id.toString();
            const pgId = getId(mongoIdStr);
            if (u.role === 'admin') adminPgId = pgId;

            const email = (u.email || '').toLowerCase().trim();
            const passwordHash = u.password || null;
            const role = u.role || 'student';
            const phone = u.phone || '';

            const accStatus = u.accountStatus || (role === 'owner' ? (u.verified ? 'ACTIVE' : 'PENDING') : 'ACTIVE');
            const isVerified = accStatus === 'ACTIVE';

            await db.query(`
                INSERT INTO profiles (
                    id, mongo_id, name, email, password_hash, role, phone,
                    business_name, city, college, course, year, google_id,
                    auth_provider, avatar, profile_image, verified,
                    account_status, status, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21
                ) ON CONFLICT (id) DO NOTHING
            `, [
                pgId,
                mongoIdStr,
                u.name || 'User',
                email,
                passwordHash,
                role,
                phone,
                u.businessName || null,
                u.city || null,
                u.college || null,
                u.course || null,
                u.year || null,
                u.googleId || null,
                u.authProvider || u.provider || 'password',
                u.avatar || u.profileImage || null,
                u.profileImage || u.avatar || null,
                isVerified,
                accStatus,
                u.status || 'active',
                u.createdAt ? new Date(u.createdAt) : new Date(),
                u.updatedAt ? new Date(u.updatedAt) : new Date()
            ]);
        }

        // Ensure fallback admin profile if missing
        if (!adminPgId) {
            const adminEmail = (process.env.ADMIN_EMAIL || 'camporaforstudents@gmail.com').toLowerCase().trim();
            const checkAdmin = await db.query(`SELECT id FROM profiles WHERE LOWER(email) = $1`, [adminEmail]);
            if (checkAdmin.rows.length > 0) {
                adminPgId = checkAdmin.rows[0].id;
            } else {
                adminPgId = crypto.randomUUID();
                await db.query(`
                    INSERT INTO profiles (id, name, email, role, verified, account_status, status)
                    VALUES ($1, 'Global Super Admin', $2, 'admin', true, 'ACTIVE', 'active')
                `, [adminPgId, adminEmail]);
            }
        }

        // Assign GLOBAL admin scope to Super Admin
        await db.query(`
            INSERT INTO admin_scopes (admin_user_id, scope_type, is_active)
            VALUES ($1, 'GLOBAL', true)
            ON CONFLICT DO NOTHING
        `, [adminPgId]);

        // STEP B: PROPERTIES
        for (const p of rawProperties) {
            const mongoIdStr = typeof p._id === 'object' && p._id.$oid ? p._id.$oid : p._id.toString();
            const pgId = getId(mongoIdStr);
            const ownerMongoId = typeof p.owner === 'object' && p.owner ? (p.owner.$oid || p.owner._id || p.owner.toString()) : p.owner;
            const ownerPgId = getId(ownerMongoId);

            if (!ownerPgId || !validUserMongoIds.has(ownerMongoId)) continue;

            const propName = p.propertyName || p.title || p.name || 'Untitled Property';
            const rent = parseFloat(p.rent || p.price || 0);

            await db.query(`
                INSERT INTO properties (
                    id, mongo_id, owner_id, property_name, property_type, state, city, college, address,
                    latitude, longitude, rent, deposit, gender, sharing, amenities, description, images,
                    available_beds, total_beds, featured, verified, status, average_rating, total_reviews,
                    views, house_rules, available, published, blacklisted, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32
                ) ON CONFLICT (id) DO NOTHING
            `, [
                pgId,
                mongoIdStr,
                ownerPgId,
                propName,
                p.propertyType || 'PG',
                p.state || 'State',
                p.city || 'City',
                p.college || '',
                p.address || 'Address',
                p.latitude || null,
                p.longitude || null,
                rent,
                parseFloat(p.deposit || 0),
                p.gender || 'Boys',
                p.sharing || 'Single',
                p.amenities || [],
                p.description || '',
                p.images || (p.image ? [p.image] : []),
                parseInt(p.availableBeds || p.available_beds || 0, 10),
                parseInt(p.totalBeds || p.total_beds || 0, 10),
                !!p.featured,
                !!p.verified,
                p.status || 'approved',
                parseFloat(p.averageRating || p.rating || 0),
                parseInt(p.totalReviews || 0, 10),
                parseInt(p.views || 0, 10),
                JSON.stringify(p.houseRules || {}),
                p.available !== false,
                p.published !== false,
                !!p.blacklisted,
                p.createdAt ? new Date(p.createdAt) : new Date(),
                p.updatedAt ? new Date(p.updatedAt) : new Date()
            ]);
        }

        // STEP C: BOOKINGS
        for (const b of rawBookings) {
            const mongoIdStr = typeof b._id === 'object' && b._id.$oid ? b._id.$oid : b._id.toString();
            const pgId = getId(mongoIdStr);
            const studentMongoId = typeof b.student === 'object' && b.student ? (b.student.$oid || b.student._id || b.student.toString()) : b.student;
            const propMongoId = typeof b.property === 'object' && b.property ? (b.property.$oid || b.property._id || b.property.toString()) : b.property;

            const studentPgId = getId(studentMongoId);
            const propPgId = getId(propMongoId);

            if (!studentPgId || !propPgId || !validUserMongoIds.has(studentMongoId) || !validPropMongoIds.has(propMongoId)) continue;

            await db.query(`
                INSERT INTO bookings (
                    id, mongo_id, student_id, property_id, status, rent_amount, deposit_amount,
                    move_in_date, sharing_type, payment_status, is_inventory_reserved, is_inventory_released,
                    created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14
                ) ON CONFLICT (id) DO NOTHING
            `, [
                pgId,
                mongoIdStr,
                studentPgId,
                propPgId,
                b.status || 'pending',
                parseFloat(b.rentAmount || b.rent || 0),
                parseFloat(b.depositAmount || b.deposit || 0),
                b.moveInDate ? new Date(b.moveInDate) : new Date(),
                b.sharingType || 'Single',
                b.paymentStatus || 'pending',
                !!b.isInventoryReserved,
                !!b.isInventoryReleased,
                b.createdAt ? new Date(b.createdAt) : new Date(),
                b.updatedAt ? new Date(b.updatedAt) : new Date()
            ]);
        }

        // STEP D: REVIEWS
        for (const r of rawReviews) {
            const mongoIdStr = typeof r._id === 'object' && r._id.$oid ? r._id.$oid : r._id.toString();
            const pgId = getId(mongoIdStr);
            const userMongoId = typeof r.user === 'object' && r.user ? (r.user.$oid || r.user._id || r.user.toString()) : r.user;
            const propMongoId = typeof r.property === 'object' && r.property ? (r.property.$oid || r.property._id || r.property.toString()) : r.property;

            const userPgId = getId(userMongoId);
            const propPgId = getId(propMongoId);

            if (!userPgId || !propPgId || !validUserMongoIds.has(userMongoId) || !validPropMongoIds.has(propMongoId)) continue;

            await db.query(`
                INSERT INTO reviews (
                    id, mongo_id, user_id, property_id, rating, comment, created_at, updated_at
                ) VALUES (
                    $1, $2, $3, $4, $5, $6, $7, $8
                ) ON CONFLICT (id) DO NOTHING
            `, [
                pgId,
                mongoIdStr,
                userPgId,
                propPgId,
                parseFloat(r.rating || 0),
                r.comment || '',
                r.createdAt ? new Date(r.createdAt) : new Date(),
                r.updatedAt ? new Date(r.updatedAt) : new Date()
            ]);
        }

        // STEP E: CONVERSATIONS & MESSAGES
        for (const c of rawConversations) {
            const mongoIdStr = typeof c._id === 'object' && c._id.$oid ? c._id.$oid : c._id.toString();
            const pgId = getId(mongoIdStr);
            const studentPgId = getId(typeof c.student === 'object' ? c.student.$oid : c.student);
            const ownerPgId = getId(typeof c.owner === 'object' ? c.owner.$oid : c.owner);
            const propPgId = getId(typeof c.property === 'object' ? c.property.$oid : c.property);

            if (!studentPgId || !ownerPgId) continue;

            await db.query(`
                INSERT INTO conversations (id, mongo_id, student_id, owner_id, property_id, last_message, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [
                pgId,
                mongoIdStr,
                studentPgId,
                ownerPgId,
                propPgId,
                c.lastMessage || '',
                c.updatedAt ? new Date(c.updatedAt) : new Date()
            ]);
        }

        for (const m of rawMessages) {
            const mongoIdStr = typeof m._id === 'object' && m._id.$oid ? m._id.$oid : m._id.toString();
            const pgId = getId(mongoIdStr);
            const convPgId = getId(typeof m.conversation === 'object' ? m.conversation.$oid : m.conversation);
            const senderPgId = getId(typeof m.sender === 'object' ? m.sender.$oid : m.sender);

            if (!convPgId || !senderPgId) continue;

            await db.query(`
                INSERT INTO messages (id, mongo_id, conversation_id, sender_id, text, is_read, created_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7)
                ON CONFLICT (id) DO NOTHING
            `, [
                pgId,
                mongoIdStr,
                convPgId,
                senderPgId,
                m.text || m.content || '',
                !!m.read || !!m.isRead,
                m.createdAt ? new Date(m.createdAt) : new Date()
            ]);
        }

        if (typeof db.exec === 'function') {
            await db.exec('COMMIT;');
        }
        console.log("[SupabaseSeeder] Initial dataset seeding completed successfully in single transaction.");
    } catch (err) {
        if (typeof db.exec === 'function') {
            try { await db.exec('ROLLBACK;'); } catch (e) {}
        }
        console.error("[SupabaseSeeder] Seeding error:", err);
    }
}

module.exports = {
    seedSupabaseData
};
