const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const backupDir = 'C:\\Users\\piyus\\.gemini\\antigravity\\brain\\ea8e4fcd-6d54-4f7b-bbb6-9bbce5e9d5ab\\scratch\\backup';

async function seedSupabaseData(db) {
    if (!fs.existsSync(backupDir)) {
        console.error("❌ Backup directory missing in seeder:", backupDir);
        return;
    }

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
    const rawNotifications = loadBackup('notifications');
    const rawAuditLogs = loadBackup('auditlogs');
    const rawContacts = loadBackup('contacts');
    const rawPropertyInvites = loadBackup('propertyinvites');
    const rawTenancies = loadBackup('tenancies');
    const rawResidentRequests = loadBackup('residentrequests');
    const rawSettings = loadBackup('settings');

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
    const validBookingMongoIds = new Set(rawBookings.map(b => typeof b._id === 'object' && b._id.$oid ? b._id.$oid : b._id.toString()));

    let adminPgId = null;

    // STEP A: PROFILES
    for (const u of rawUsers) {
        const pgId = getId(u._id);
        const mongoIdStr = typeof u._id === 'object' && u._id.$oid ? u._id.$oid : u._id.toString();
        const emailClean = (u.email || '').toLowerCase().trim();
        if (emailClean === 'camporaforstudents@gmail.com') adminPgId = pgId;

        await db.query(`
            INSERT INTO profiles (
                id, mongo_id, name, email, password_hash, auth_provider, phone, role, verified,
                provider, google_id, avatar, college, course, year, business_name, city,
                profile_image, bio, status, account_status, last_login, email_verified,
                phone_verified, emergency_contact, kyc_verified, gst_number, property_count,
                rating, notification_settings, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9,
                $10, $11, $12, $13, $14, $15, $16, $17,
                $18, $19, $20, $21, $22, $23,
                $24, $25, $26, $27, $28,
                $29, $30, $31, $32
            ) ON CONFLICT DO NOTHING
        `, [
            pgId,
            mongoIdStr,
            u.name || 'User',
            emailClean,
            u.password || null,
            u.authProvider || 'password',
            u.phone || '',
            u.role || 'student',
            !!u.verified,
            u.provider || 'local',
            u.googleId || '',
            u.avatar || '',
            u.college || '',
            u.course || '',
            u.year || '',
            u.businessName || '',
            u.city || '',
            u.profileImage || '',
            u.bio || '',
            (u.status || 'active').toLowerCase(),
            u.accountStatus || (u.role === 'owner' ? 'PENDING' : 'ACTIVE'),
            u.lastLogin ? new Date(u.lastLogin) : null,
            !!u.emailVerified,
            !!u.phoneVerified,
            JSON.stringify(u.emergencyContact || { name: '', phone: '' }),
            !!u.kycVerified,
            u.gstNumber || '',
            Math.max(0, u.propertyCount || 0),
            u.rating || 0,
            JSON.stringify(u.notificationSettings || { email: true, sms: true, push: true }),
            u.createdAt ? new Date(u.createdAt) : new Date(),
            u.updatedAt ? new Date(u.updatedAt) : new Date()
        ]);
    }

    // STEP B: PROPERTIES
    for (const p of rawProperties) {
        const pgId = getId(p._id);
        let ownerPgId = p.owner && validUserMongoIds.has(typeof p.owner === 'object' && p.owner.$oid ? p.owner.$oid : p.owner.toString()) ? getId(p.owner) : null;
        
        // Property name fallback order
        const resolvedName = p.propertyName || p.title || p.name || 'Property';

        await db.query(`
            INSERT INTO properties (
                id, mongo_id, owner_id, property_name, property_type, state, city, college,
                address, latitude, longitude, rent, deposit, gender, sharing, amenities,
                description, images, available_beds, total_beds, featured, verified, status,
                average_rating, total_reviews, views, maintenance_charge, electricity_charge,
                food_charge, available, published, blacklisted, house_rules,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12, $13, $14, $15, $16,
                $17, $18, $19, $20, $21, $22, $23,
                $24, $25, $26, $27, $28,
                $29, $30, $31, $32, $33,
                $34, $35
            ) ON CONFLICT DO NOTHING
        `, [
            pgId,
            typeof p._id === 'object' ? p._id.$oid : p._id.toString(),
            ownerPgId,
            resolvedName,
            p.propertyType || 'PG',
            p.state || '',
            p.city || '',
            p.college || '',
            p.address || '',
            p.latitude || null,
            p.longitude || null,
            p.rent || 0,
            p.deposit || 0,
            p.gender || 'Boys',
            p.sharing || 'Single',
            p.amenities || [],
            p.description || '',
            p.images || [],
            p.availableBeds || 0,
            p.totalBeds || 0,
            !!p.featured,
            !!p.verified,
            (p.status || 'approved').toLowerCase(),
            p.averageRating || 0,
            p.totalReviews || 0,
            p.views || 0,
            p.maintenanceCharge || 0,
            p.electricityCharge || 0,
            p.foodCharge || 0,
            p.available !== undefined ? !!p.available : true,
            p.published !== undefined ? !!p.published : true,
            !!p.blacklisted,
            JSON.stringify(p.houseRules || {}),
            p.createdAt ? new Date(p.createdAt) : new Date(),
            p.updatedAt ? new Date(p.updatedAt) : new Date()
        ]);
    }

    // STEP C: BOOKINGS
    for (const b of rawBookings) {
        const pgId = getId(b._id);
        let propPgId = b.propertyId && validPropMongoIds.has(typeof b.propertyId === 'object' && b.propertyId.$oid ? b.propertyId.$oid : b.propertyId.toString()) ? getId(b.propertyId) : null;
        let userPgId = b.userId && validUserMongoIds.has(typeof b.userId === 'object' && b.userId.$oid ? b.userId.$oid : b.userId.toString()) ? getId(b.userId) : null;
        let ownerPgId = b.ownerId && validUserMongoIds.has(typeof b.ownerId === 'object' && b.ownerId.$oid ? b.ownerId.$oid : b.ownerId.toString()) ? getId(b.ownerId) : null;

        await db.query(`
            INSERT INTO bookings (
                id, mongo_id, property_id, user_id, owner_id, price, check_in, payment_status,
                booking_status, inventory_reserved, inventory_released, cancel_reason,
                created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8,
                $9, $10, $11, $12,
                $13, $14
            ) ON CONFLICT DO NOTHING
        `, [
            pgId,
            typeof b._id === 'object' ? b._id.$oid : b._id.toString(),
            propPgId,
            userPgId,
            ownerPgId,
            b.totalAmount || b.rentAmount || 0,
            b.moveInDate || b.checkInDate ? new Date(b.moveInDate || b.checkInDate) : new Date(),
            b.paymentStatus || 'pending',
            b.bookingStatus || 'pending',
            !!b.inventoryReserved,
            !!b.inventoryReleased,
            b.cancelReason || '',
            b.createdAt ? new Date(b.createdAt) : new Date(),
            b.updatedAt ? new Date(b.updatedAt) : new Date()
        ]);
    }

    // STEP D: REVIEWS
    for (const r of rawReviews) {
        const pgId = getId(r._id);
        let propPgId = r.propertyId && validPropMongoIds.has(typeof r.propertyId === 'object' && r.propertyId.$oid ? r.propertyId.$oid : r.propertyId.toString()) ? getId(r.propertyId) : null;
        let userPgId = r.userId && validUserMongoIds.has(typeof r.userId === 'object' && r.userId.$oid ? r.userId.$oid : r.userId.toString()) ? getId(r.userId) : null;

        await db.query(`
            INSERT INTO reviews (
                id, mongo_id, property_id, user_id, rating, comment, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8
            ) ON CONFLICT DO NOTHING
        `, [
            pgId,
            typeof r._id === 'object' ? r._id.$oid : r._id.toString(),
            propPgId,
            userPgId,
            Math.max(1, Math.min(5, r.rating || 5)),
            r.comment || '',
            r.createdAt ? new Date(r.createdAt) : new Date(),
            r.updatedAt ? new Date(r.updatedAt) : new Date()
        ]);
    }

    // STEP E: CONVERSATIONS & MESSAGES
    for (const c of rawConversations) {
        const pgId = getId(c._id);
        let propPgId = c.propertyId && validPropMongoIds.has(typeof c.propertyId === 'object' && c.propertyId.$oid ? c.propertyId.$oid : c.propertyId.toString()) ? getId(c.propertyId) : null;
        let bookingPgId = c.bookingId && validBookingMongoIds.has(typeof c.bookingId === 'object' && c.bookingId.$oid ? c.bookingId.$oid : c.bookingId.toString()) ? getId(c.bookingId) : null;
        let studentPgId = c.studentId && validUserMongoIds.has(typeof c.studentId === 'object' && c.studentId.$oid ? c.studentId.$oid : c.studentId.toString()) ? getId(c.studentId) : null;
        let ownerPgId = c.ownerId && validUserMongoIds.has(typeof c.ownerId === 'object' && c.ownerId.$oid ? c.ownerId.$oid : c.ownerId.toString()) ? getId(c.ownerId) : null;

        await db.query(`
            INSERT INTO conversations (
                id, mongo_id, property_id, booking_id, student_id, owner_id, last_message,
                last_message_at, unread_by_student, unread_by_owner, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
            ) ON CONFLICT DO NOTHING
        `, [
            pgId,
            typeof c._id === 'object' ? c._id.$oid : c._id.toString(),
            propPgId,
            bookingPgId,
            studentPgId,
            ownerPgId,
            c.lastMessage || '',
            c.lastMessageAt ? new Date(c.lastMessageAt) : new Date(),
            c.unreadCountStudent || 0,
            c.unreadCountOwner || 0,
            c.createdAt ? new Date(c.createdAt) : new Date(),
            c.updatedAt ? new Date(c.updatedAt) : new Date()
        ]);
    }

    for (const m of rawMessages) {
        const pgId = getId(m._id);
        let convPgId = m.conversationId && getId(m.conversationId);
        let senderPgId = m.senderId && validUserMongoIds.has(typeof m.senderId === 'object' && m.senderId.$oid ? m.senderId.$oid : m.senderId.toString()) ? getId(m.senderId) : null;

        await db.query(`
            INSERT INTO messages (
                id, mongo_id, conversation_id, sender_id, sender, text,
                is_read, created_at, updated_at
            ) VALUES (
                $1, $2, $3, $4, $5, $6, $7, $8, $9
            ) ON CONFLICT DO NOTHING
        `, [
            pgId,
            typeof m._id === 'object' ? m._id.$oid : m._id.toString(),
            convPgId,
            senderPgId,
            m.senderRole || 'student',
            m.content || m.text || '',
            !!m.isRead,
            m.createdAt ? new Date(m.createdAt) : new Date(),
            m.updatedAt ? new Date(m.updatedAt) : new Date()
        ]);
    }

    // STEP F: OTHER TABLES
    for (const t of rawTenancies) {
        const pgId = getId(t._id);
        let sPgId = t.studentId && validUserMongoIds.has(typeof t.studentId === 'object' && t.studentId.$oid ? t.studentId.$oid : t.studentId.toString()) ? getId(t.studentId) : null;
        let pPgId = t.propertyId && validPropMongoIds.has(typeof t.propertyId === 'object' && t.propertyId.$oid ? t.propertyId.$oid : t.propertyId.toString()) ? getId(t.propertyId) : null;

        if (sPgId && pPgId) {
            await db.query(`
                INSERT INTO tenancies (id, mongo_id, student_id, property_id, room, bed, start_date, status, source, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING
            `, [pgId, typeof t._id === 'object' ? t._id.$oid : t._id.toString(), sPgId, pPgId, t.roomNumber || t.room || '101', t.bedNumber || t.bed || 'A', t.moveInDate || t.startDate ? new Date(t.moveInDate || t.startDate) : new Date(), (t.status || 'ACTIVE').toUpperCase(), 'BOOKING', t.createdAt ? new Date(t.createdAt) : new Date(), t.updatedAt ? new Date(t.updatedAt) : new Date()]);
        }
    }

    for (const rr of rawResidentRequests) {
        const pgId = getId(rr._id);
        let sPgId = rr.studentId && validUserMongoIds.has(typeof rr.studentId === 'object' && rr.studentId.$oid ? rr.studentId.$oid : rr.studentId.toString()) ? getId(rr.studentId) : null;
        let pPgId = rr.propertyId && validPropMongoIds.has(typeof rr.propertyId === 'object' && rr.propertyId.$oid ? rr.propertyId.$oid : rr.propertyId.toString()) ? getId(rr.propertyId) : null;

        if (sPgId && pPgId) {
            await db.query(`
                INSERT INTO resident_requests (id, mongo_id, student_id, property_id, room, bed, move_in_date, residence_source, status, created_at, updated_at)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) ON CONFLICT DO NOTHING
            `, [pgId, typeof rr._id === 'object' ? rr._id.$oid : rr._id.toString(), sPgId, pPgId, rr.roomType || rr.room || '101', rr.bed || 'A', rr.moveInDate ? new Date(rr.moveInDate) : new Date(), 'DIRECT_OWNER', (rr.status || 'PENDING').toUpperCase(), rr.createdAt ? new Date(rr.createdAt) : new Date(), rr.updatedAt ? new Date(rr.updatedAt) : new Date()]);
        }
    }

    for (const n of rawNotifications) {
        const pgId = getId(n._id);
        let rPgId = n.receiverId && validUserMongoIds.has(typeof n.receiverId === 'object' && n.receiverId.$oid ? n.receiverId.$oid : n.receiverId.toString()) ? getId(n.receiverId) : null;
        await db.query(`
            INSERT INTO notifications (id, mongo_id, receiver_id, title, message, type, is_read, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) ON CONFLICT DO NOTHING
        `, [pgId, typeof n._id === 'object' ? n._id.$oid : n._id.toString(), rPgId, n.title || 'Notification', n.message || '', n.type || 'general', !!n.isRead, n.createdAt ? new Date(n.createdAt) : new Date(), n.updatedAt ? new Date(n.updatedAt) : new Date()]);
    }

    for (const a of rawAuditLogs) {
        const pgId = getId(a._id);
        await db.query(`
            INSERT INTO audit_logs (id, mongo_id, user_id, user_email, role, action, resource, resource_id, details, ip_address, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING
        `, [pgId, typeof a._id === 'object' ? a._id.$oid : a._id.toString(), getId(a.userId), a.userEmail || '', a.role || 'admin', a.action || 'ADMIN_LOGIN', a.resource || 'Auth', a.resourceId || '', JSON.stringify(a.details || {}), a.ipAddress || '', a.createdAt ? new Date(a.createdAt) : new Date(), a.updatedAt ? new Date(a.updatedAt) : new Date()]);
    }

    for (const ct of rawContacts) {
        const pgId = getId(ct._id);
        await db.query(`
            INSERT INTO contacts (id, mongo_id, name, email, message, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7) ON CONFLICT DO NOTHING
        `, [pgId, typeof ct._id === 'object' ? ct._id.$oid : ct._id.toString(), ct.name || '', ct.email || '', ct.message || '', ct.createdAt ? new Date(ct.createdAt) : new Date(), ct.updatedAt ? new Date(ct.updatedAt) : new Date()]);
    }

    for (const pi of rawPropertyInvites) {
        const pgId = getId(pi._id);
        let pPgId = pi.property && validPropMongoIds.has(typeof pi.property === 'object' && pi.property.$oid ? pi.property.$oid : pi.property.toString()) ? getId(pi.property) : null;
        await db.query(`
            INSERT INTO property_invites (id, mongo_id, property_id, token, expires_at, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8) ON CONFLICT DO NOTHING
        `, [pgId, typeof pi._id === 'object' ? pi._id.$oid : pi._id.toString(), pPgId, pi.token, pi.expiresAt ? new Date(pi.expiresAt) : null, pi.status || 'ACTIVE', pi.createdAt ? new Date(pi.createdAt) : new Date(), pi.updatedAt ? new Date(pi.updatedAt) : new Date()]);
    }

    for (const st of rawSettings) {
        const pgId = getId(st._id);
        await db.query(`
            INSERT INTO platform_settings (id, mongo_id, site_name, site_description, support_email, support_phone, maintenance_mode, allow_registration, allow_property_upload, featured_property_fee, commission_percentage, currency, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14) ON CONFLICT DO NOTHING
        `, [pgId, typeof st._id === 'object' ? st._id.$oid : st._id.toString(), st.siteName || 'Campora', st.siteDescription || "India's Smart Student Accommodation Platform", st.supportEmail || 'support@campora.in', st.supportPhone || '', !!st.maintenanceMode, st.allowRegistration !== undefined ? !!st.allowRegistration : true, st.allowPropertyUpload !== undefined ? !!st.allowPropertyUpload : true, st.featuredPropertyFee || 0, st.commissionPercentage || 5, st.currency || 'INR', st.createdAt ? new Date(st.createdAt) : new Date(), st.updatedAt ? new Date(st.updatedAt) : new Date()]);
    }

    // STEP G: DEFAULT GLOBAL ADMIN SCOPE SEEDING
    if (adminPgId) {
        await db.query(`
            INSERT INTO admin_scopes (admin_user_id, scope_type, state, city)
            VALUES ($1, 'GLOBAL', '', '') ON CONFLICT DO NOTHING
        `, [adminPgId]);
    }
}

module.exports = {
    seedSupabaseData
};
