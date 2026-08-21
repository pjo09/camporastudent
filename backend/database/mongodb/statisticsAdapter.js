const User = require('../../models/User');
const Property = require('../../models/Property');
const Booking = require('../../models/Booking');
const Review = require('../../models/Review');

async function getPublicStatistics() {
    const [
        properties,
        verifiedOwners,
        students,
        cities,
        universities,
        bookings,
        reviews
    ] = await Promise.all([
        Property.countDocuments({
            status: "approved",
            published: true,
            available: true,
            blacklisted: { $ne: true }
        }),
        User.countDocuments({
            role: "owner",
            accountStatus: "ACTIVE",
            status: "active"
        }),
        User.countDocuments({
            role: "student",
            accountStatus: "ACTIVE",
            status: "active"
        }),
        Property.distinct("city", {
            status: "approved",
            published: true,
            available: true,
            blacklisted: { $ne: true }
        }).then((arr) => arr.filter(Boolean).length),
        Property.distinct("college", {
            status: "approved",
            published: true,
            available: true,
            blacklisted: { $ne: true }
        }).then((arr) => arr.filter(Boolean).length),
        Booking.countDocuments({}),
        Review.countDocuments({})
    ]);

    return {
        properties,
        verifiedOwners,
        students,
        cities,
        universities,
        bookings,
        reviews
    };
}

module.exports = {
    getPublicStatistics
};
