const Property = require('../../models/Property');

async function findPropertyById(id) {
    if (!id) return null;
    return await Property.findById(id).populate('owner', 'name email phone');
}

async function listProperties(filter = {}) {
    return await Property.find(filter).populate('owner', 'name email phone');
}

async function searchProperties(options = {}) {
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

    const filter = {
        status: "approved",
        published: true,
        available: true,
        blacklisted: { $ne: true }
    };

    if (city) filter.city = new RegExp(city.trim(), "i");
    if (state) filter.state = new RegExp(state.trim(), "i");

    const targetUni = college || university;
    if (targetUni) filter.college = new RegExp(targetUni.trim(), "i");

    if (propertyType) filter.propertyType = propertyType;
    if (gender) filter.gender = gender;
    if (sharing) filter.sharing = sharing;

    if (minRent || maxRent) {
        filter.rent = {};
        if (minRent) filter.rent.$gte = Number(minRent);
        if (maxRent) filter.rent.$lte = Number(maxRent);
    }

    if (minRating) filter.averageRating = { $gte: Number(minRating) };

    if (amenities) {
        const list = Array.isArray(amenities) ? amenities : amenities.split(",").map(s => s.trim());
        filter.amenities = { $all: list };
    }

    if (search && search.trim()) {
        const regex = new RegExp(search.trim(), "i");
        filter.$or = [
            { propertyName: regex },
            { city: regex },
            { college: regex },
            { address: regex },
            { description: regex }
        ];
    }

    let sortOption = { createdAt: -1 };
    if (sort === "rent_asc" || sort === "priceLow") sortOption = { rent: 1 };
    if (sort === "rent_desc" || sort === "priceHigh") sortOption = { rent: -1 };
    if (sort === "rating") sortOption = { averageRating: -1 };
    if (sort === "popular") sortOption = { views: -1 };

    const pageNum = Math.max(1, Number(page));
    const limitNum = Math.min(100, Math.max(1, Number(limit)));
    const skip = (pageNum - 1) * limitNum;

    const [properties, totalCount] = await Promise.all([
        Property.find(filter)
            .populate("owner", "name email phone businessName rating")
            .sort(sortOption)
            .skip(skip)
            .limit(limitNum),
        Property.countDocuments(filter)
    ]);

    return {
        properties,
        total: totalCount,
        page: pageNum,
        totalPages: Math.ceil(totalCount / limitNum)
    };
}

module.exports = {
    findPropertyById,
    listProperties,
    searchProperties
};
