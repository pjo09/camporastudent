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
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32)
            ON CONFLICT (email) DO NOTHING
        `, [
            pgId,
            mongoIdStr,
            u.name || 'Unknown',
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
            u.status || 'active',
            u.accountStatus || 'ACTIVE',
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
        const mongoIdStr = typeof p._id === 'object' && p._id.$oid ? p._id.$oid : p._id.toString();
        let ownerPgId = null;
        if (p.owner) {
            const ownerStr = typeof p.owner === 'object' && p.owner.$oid ? p.owner.$oid : p.owner.toString();
            ownerPgId = validUserMongoIds.has(ownerStr) ? getId(ownerStr) : adminPgId;
        } else {
            ownerPgId = adminPgId;
        }

        const resolvedPropName = p.propertyName || p.title || p.name || 'Property';

        await db.query(`
            INSERT INTO properties (
                id, mongo_id, owner_id, property_name, property_type, state, city, college,
                address, latitude, longitude, rent, deposit, gender, sharing, amenities,
                description, images, available_beds, total_beds, featured, verified, status,
                average_rating, total_reviews, views, house_rules, maintenance_charge,
                electricity_charge, food_charge, available, published, blacklisted, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34, $35)
            ON CONFLICT (id) DO NOTHING
        `, [
            pgId,
            mongoIdStr,
            ownerPgId,
            resolvedPropName,
            p.propertyType || 'PG',
            p.state || 'Maharashtra',
            p.city || 'Pune',
            p.college || '',
            p.address || '',
            p.latitude || null,
            p.longitude || null,
            p.rent || 0,
            p.deposit || 0,
            p.gender || 'Co-ed',
            p.sharing || 'Single',
            p.amenities || [],
            p.description || '',
            p.images || [],
            p.availableBeds || 0,
            p.totalBeds || 0,
            !!p.featured,
            !!p.verified,
            p.status || 'pending',
            p.averageRating || 0,
            p.totalReviews || 0,
            p.views || 0,
            JSON.stringify(p.houseRules || {}),
            p.maintenanceCharge || 0,
            p.electricityCharge || 0,
            p.foodCharge || 0,
            p.available !== undefined ? !!p.available : true,
            !!p.published,
            !!p.blacklisted,
            p.createdAt ? new Date(p.createdAt) : new Date(),
            p.updatedAt ? new Date(p.updatedAt) : new Date()
        ]);
    }

    // STEP C: BOOKINGS
    for (const b of rawBookings) {
        const pgId = getId(b._id);
        const mongoIdStr = typeof b._id === 'object' && b._id.$oid ? b._id.$oid : b._id.toString();

        let propPgId = b.propertyId && validPropMongoIds.has(typeof b.propertyId === 'object' && b.propertyId.$oid ? b.propertyId.$oid : b.propertyId.toString()) ? getId(b.propertyId) : null;
        let userPgId = b.userId && validUserMongoIds.has(typeof b.userId === 'object' && b.userId.$oid ? b.userId.$oid : b.userId.toString()) ? getId(b.userId) : null;
        let ownerPgId = b.ownerId && validUserMongoIds.has(typeof b.ownerId === 'object' && b.ownerId.$oid ? b.ownerId.$oid : b.ownerId.toString()) ? getId(b.ownerId) : null;

        await db.query(`
            INSERT INTO bookings (
                id, mongo_id, property_id, property_name, user_id, user_name, user_email,
                price, owner_id, check_in, check_out, duration, number_of_guests, payment_status,
                booking_status, payment_id, payment_date, payment_method, special_request,
                cancel_reason, check_in_instructions, check_in_window, meeting_instructions,
                special_instructions, reminder_sent_7days, reminder_sent_1day,
                inventory_reserved, inventory_released, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30)
            ON CONFLICT (id) DO NOTHING
        `, [
            pgId,
            mongoIdStr,
            propPgId,
            b.propertyName || '',
            userPgId,
            b.userName || '',
            b.userEmail || '',
            b.price || 0,
            ownerPgId,
            b.checkIn ? new Date(b.checkIn) : null,
            b.checkOut ? new Date(b.checkOut) : null,
            b.duration || '',
            b.numberOfGuests || 1,
            b.paymentStatus || 'pending',
            b.bookingStatus || 'pending',
            b.paymentId || '',
            b.paymentDate ? new Date(b.paymentDate) : null,
            b.paymentMethod || 'UPI',
            b.specialRequest || '',
            b.cancelReason || '',
            b.checkInInstructions || '',
            b.checkInWindow || '',
            b.meetingInstructions || '',
            b.specialInstructions || '',
            !!b.reminderSent7Days,
            !!b.reminderSent1Day,
            !!b.inventoryReserved,
            !!b.inventoryReleased,
            b.createdAt ? new Date(b.createdAt) : new Date(),
            b.updatedAt ? new Date(b.updatedAt) : new Date()
        ]);
    }

    // STEP D: REVIEWS
    for (const r of rawReviews) {
        const pgId = getId(r._id);
        const mongoIdStr = typeof r._id === 'object' && r._id.$oid ? r._id.$oid : r._id.toString();
        let propPgId = r.property && validPropMongoIds.has(typeof r.property === 'object' && r.property.$oid ? r.property.$oid : r.property.toString()) ? getId(r.property) : null;
        let userPgId = r.user && validUserMongoIds.has(typeof r.user === 'object' && r.user.$oid ? r.user.$oid : r.user.toString()) ? getId(r.user) : null;

        await db.query(`
            INSERT INTO reviews (
                id, mongo_id, property_id, user_id, name, rating, comment, status, reported, likes, owner_reply, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
        `, [
            pgId,
            mongoIdStr,
            propPgId,
            userPgId,
            r.name || '',
            r.rating || 5,
            r.comment || '',
            r.status || 'approved',
            !!r.reported,
            r.likes || 0,
            r.ownerReply || '',
            r.createdAt ? new Date(r.createdAt) : new Date(),
            r.updatedAt ? new Date(r.updatedAt) : new Date()
        ]);
    }

    // STEP E: CONVERSATIONS & MESSAGES
    for (const c of rawConversations) {
        const pgId = getId(c._id);
        const mongoIdStr = typeof c._id === 'object' && c._id.$oid ? c._id.$oid : c._id.toString();
        let ownerPgId = c.ownerId && validUserMongoIds.has(typeof c.ownerId === 'object' && c.ownerId.$oid ? c.ownerId.$oid : c.ownerId.toString()) ? getId(c.ownerId) : null;
        let studentPgId = c.studentId && validUserMongoIds.has(typeof c.studentId === 'object' && c.studentId.$oid ? c.studentId.$oid : c.studentId.toString()) ? getId(c.studentId) : null;
        let propPgId = c.propertyId && validPropMongoIds.has(typeof c.propertyId === 'object' && c.propertyId.$oid ? c.propertyId.$oid : c.propertyId.toString()) ? getId(c.propertyId) : null;
        let bookingPgId = c.bookingId && validBookingMongoIds.has(typeof c.bookingId === 'object' && c.bookingId.$oid ? c.bookingId.$oid : c.bookingId.toString()) ? getId(c.bookingId) : null;

        await db.query(`
            INSERT INTO conversations (
                id, mongo_id, owner_id, student_id, property_id, booking_id, status,
                last_message, last_message_at, last_sender, unread_by_owner, unread_by_student, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (id) DO NOTHING
        `, [
            pgId,
            mongoIdStr,
            ownerPgId,
            studentPgId,
            propPgId,
            bookingPgId,
            c.status || 'active',
            c.lastMessage || '',
            c.lastMessageAt ? new Date(c.lastMessageAt) : new Date(),
            c.lastSender || 'owner',
            c.unreadByOwner || 0,
            c.unreadByStudent || 0,
            c.createdAt ? new Date(c.createdAt) : new Date(),
            c.updatedAt ? new Date(c.updatedAt) : new Date()
        ]);
    }

    for (const m of rawMessages) {
        const pgId = getId(m._id);
        const mongoIdStr = typeof m._id === 'object' && m._id.$oid ? m._id.$oid : m._id.toString();
        let senderPgId = m.senderId && validUserMongoIds.has(typeof m.senderId === 'object' && m.senderId.$oid ? m.senderId.$oid : m.senderId.toString()) ? getId(m.senderId) : null;

        await db.query(`
            INSERT INTO messages (
                id, mongo_id, conversation_id, sender, sender_id, text, attachment, is_read, read_at, is_broadcast, broadcast_type, created_at, updated_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (id) DO NOTHING
        `, [
            pgId,
            mongoIdStr,
            getId(m.conversationId),
            m.sender || 'owner',
            senderPgId,
            m.text || '',
            JSON.stringify(m.attachment || { url: '', type: '' }),
            !!m.isRead,
            m.readAt ? new Date(m.readAt) : null,
            !!m.isBroadcast,
            m.broadcastType || '',
            m.createdAt ? new Date(m.createdAt) : new Date(),
            m.updatedAt ? new Date(m.updatedAt) : new Date()
        ]);
    }

    // STEP F: TENANCIES, RESIDENT REQUESTS, NOTIFICATIONS, AUDIT LOGS, CONTACTS, INVITES, SETTINGS
    for (const t of rawTenancies) {
        const pgId = getId(t._id);
        await db.query(`
            INSERT INTO tenancies (id, mongo_id, student_id, property_id, room, bed, start_date, end_date, status, source, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT DO NOTHING
        `, [pgId, typeof t._id === 'object' ? t._id.$oid : t._id.toString(), getId(t.student), getId(t.property), t.room || 'R1', t.bed || '', t.startDate ? new Date(t.startDate) : new Date(), t.endDate ? new Date(t.endDate) : null, t.status || 'ACTIVE', t.source || 'BOOKING', t.createdAt ? new Date(t.createdAt) : new Date(), t.updatedAt ? new Date(t.updatedAt) : new Date()]);
    }

    for (const rr of rawResidentRequests) {
        const pgId = getId(rr._id);
        await db.query(`
            INSERT INTO resident_requests (id, mongo_id, student_id, property_id, room, bed, move_in_date, residence_source, proof_document, message, status, created_at, updated_at)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) ON CONFLICT DO NOTHING
        `, [pgId, typeof rr._id === 'object' ? rr._id.$oid : rr._id.toString(), getId(rr.student), getId(rr.property), rr.room || 'R1', rr.bed || '', rr.moveInDate ? new Date(rr.moveInDate) : new Date(), rr.residenceSource || 'DIRECT_OWNER', rr.proofDocument || '', rr.message || '', rr.status || 'PENDING', rr.createdAt ? new Date(rr.createdAt) : new Date(), rr.updatedAt ? new Date(rr.updatedAt) : new Date()]);
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
}

module.exports = {
    seedSupabaseData
};
