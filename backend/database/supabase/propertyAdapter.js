const { getSupabaseClient } = require('../../config/supabase');
const { mongoIdToPostgresId } = require('../../utils/idMapper');

function formatPropertyRow(r) {
    if (!r) return null;
    const imgs = Array.isArray(r.images) ? r.images : [];
    const mainImg = imgs.length > 0 ? imgs[0] : '';
    const rating = parseFloat(r.average_rating || r.rating || 0);

    return {
        _id: r.mongo_id || r.id,
        id: r.id,
        propertyName: r.property_name,
        title: r.property_name, // legacy fallback
        name: r.property_name,  // legacy fallback
        propertyType: r.property_type,
        city: r.city || '',
        state: r.state || '',
        college: r.college || '',
        university: r.college || '',
        address: r.address || '',
        description: r.description || '',
        rent: parseFloat(r.rent || 0),
        price: parseFloat(r.rent || 0), // legacy fallback
        deposit: parseFloat(r.deposit || 0),
        gender: r.gender || '',
        sharing: r.sharing || '',
        rating: rating,
        averageRating: rating,
        totalReviews: r.total_reviews || 0,
        views: r.views || 0,
        images: imgs,
        image: mainImg,
        amenities: r.amenities || [],
        availableBeds: r.available_beds || 0,
        totalBeds: r.total_beds || 0,
        featured: !!r.featured,
        verified: !!r.verified,
        status: r.status || 'pending',
        published: r.published !== false,
        available: r.available !== false,
        owner: {
            id: r.owner_id,
            _id: r.owner_id,
            name: r.owner_name || '',
            email: r.owner_email || '',
            phone: r.owner_phone || '',
            businessName: r.owner_business_name || ''
        },
        createdAt: r.created_at
    };
}

async function findPropertyById(id) {
    if (!id) return null;
    const db = await getSupabaseClient();
    const strId = String(id);
    const res = await db.query(`
        SELECT p.*, prof.name AS owner_name, prof.email AS owner_email, prof.phone AS owner_phone
        FROM properties p
        LEFT JOIN profiles prof ON p.owner_id = prof.id
        WHERE p.id::text = $1 OR p.mongo_id = $1
        LIMIT 1
    `, [strId]);

    if (res.rows.length === 0) return null;
    return formatPropertyRow(res.rows[0]);
}

async function listProperties(filter = {}) {
    const db = await getSupabaseClient();
    const res = await db.query(`
        SELECT p.*, prof.name AS owner_name, prof.email AS owner_email, prof.phone AS owner_phone
        FROM properties p
        LEFT JOIN profiles prof ON p.owner_id = prof.id
        ORDER BY p.created_at DESC
    `);
    return res.rows.map(formatPropertyRow);
}

async function searchProperties(options = {}) {
    const db = await getSupabaseClient();
    const {
        search,
        city,
        state,
        college,
        university,
        propertyType,
        gender,
        sharing,
        minRent,
        maxRent,
        minRating,
        amenities,
        sort = 'latest',
        page = 1,
        limit = 20
    } = options;

    const conditions = ["p.status = 'approved'", "p.published = true", "p.available = true", "(p.blacklisted IS NULL OR p.blacklisted = false)"];
    const params = [];
    let idx = 1;

    if (city) {
        conditions.push(`LOWER(p.city) LIKE $${idx++}`);
        params.push(`%${city.trim().toLowerCase()}%`);
    }
    if (state) {
        conditions.push(`LOWER(p.state) LIKE $${idx++}`);
        params.push(`%${state.trim().toLowerCase()}%`);
    }

    const targetUni = college || university;
    if (targetUni) {
        conditions.push(`LOWER(p.college) LIKE $${idx++}`);
        params.push(`%${targetUni.trim().toLowerCase()}%`);
    }

    if (propertyType) {
        conditions.push(`p.property_type = $${idx++}`);
        params.push(propertyType);
    }
    if (gender) {
        conditions.push(`p.gender = $${idx++}`);
        params.push(gender);
    }
    if (sharing) {
        conditions.push(`p.sharing = $${idx++}`);
        params.push(sharing);
    }

    if (minRent) {
        conditions.push(`p.rent >= $${idx++}`);
        params.push(Number(minRent));
    }
    if (maxRent) {
        conditions.push(`p.rent <= $${idx++}`);
        params.push(Number(maxRent));
    }
    if (minRating) {
        conditions.push(`p.average_rating >= $${idx++}`);
        params.push(Number(minRating));
    }

    if (search && search.trim()) {
        const s = `%${search.trim().toLowerCase()}%`;
        conditions.push(`(LOWER(p.property_name) LIKE $${idx} OR LOWER(p.city) LIKE $${idx} OR LOWER(p.college) LIKE $${idx} OR LOWER(p.address) LIKE $${idx} OR LOWER(p.description) LIKE $${idx})`);
        params.push(s);
        idx++;
    }

    if (amenities) {
        const list = Array.isArray(amenities) ? amenities : amenities.split(',').map(a => a.trim()).filter(Boolean);
        if (list.length > 0) {
            conditions.push(`p.amenities @> $${idx++}::text[]`);
            params.push(list);
        }
    }

    const whereClause = conditions.join(' AND ');

    let orderBy = 'p.created_at DESC';
    if (sort === 'rent_asc' || sort === 'priceLow') orderBy = 'p.rent ASC';
    if (sort === 'rent_desc' || sort === 'priceHigh') orderBy = 'p.rent DESC';
    if (sort === 'rating') orderBy = 'p.average_rating DESC, p.created_at DESC';
    if (sort === 'popular') orderBy = 'p.views DESC, p.created_at DESC';

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const offset = (pageNum - 1) * limitNum;

    const countSql = `SELECT COUNT(*) as cnt FROM properties p WHERE ${whereClause}`;
    const dataSql = `
        SELECT p.*, prof.name AS owner_name, prof.email AS owner_email, prof.phone AS owner_phone
        FROM properties p
        LEFT JOIN profiles prof ON p.owner_id = prof.id
        WHERE ${whereClause}
        ORDER BY ${orderBy}
        LIMIT $${idx++} OFFSET $${idx++}
    `;

    const countRes = await db.query(countSql, params);
    const total = parseInt(countRes.rows[0]?.cnt || 0, 10);

    const dataRes = await db.query(dataSql, [...params, limitNum, offset]);
    const properties = dataRes.rows.map(formatPropertyRow);

    return {
        properties,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum)
    };
}

module.exports = {
    findPropertyById,
    listProperties,
    searchProperties
};
