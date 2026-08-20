const Booking = require('../../models/Booking');

async function findBookingById(id) {
    if (!id) return null;
    return await Booking.findById(id);
}

async function listBookings(filter = {}) {
    return await Booking.find(filter);
}

module.exports = {
    findBookingById,
    listBookings
};
