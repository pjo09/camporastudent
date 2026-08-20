const dbConfig = require('../config/database');
const mongoBookingAdapter = require('../database/mongodb/bookingAdapter');
const supabaseBookingAdapter = require('../database/supabase/bookingAdapter');
const { executeShadowRead } = require('../services/shadowReadService');

function compareBookingFields(mongoBooking, supabaseBooking) {
    const mismatches = [];

    if (!mongoBooking && !supabaseBooking) return mismatches;

    if (mongoBooking && !supabaseBooking) {
        mismatches.push({ field: 'existence', mongoValue: 'EXISTS', supabaseValue: 'MISSING', mongoId: mongoBooking._id?.toString() });
        return mismatches;
    }

    if (!mongoBooking && supabaseBooking) {
        mismatches.push({ field: 'existence', mongoValue: 'MISSING', supabaseValue: 'EXISTS', mongoId: supabaseBooking.id });
        return mismatches;
    }

    const mId = mongoBooking._id ? mongoBooking._id.toString() : 'N/A';

    // Booking Status
    if ((mongoBooking.bookingStatus || '').toLowerCase() !== (supabaseBooking.bookingStatus || '').toLowerCase()) {
        mismatches.push({ field: 'bookingStatus', mongoValue: mongoBooking.bookingStatus, supabaseValue: supabaseBooking.bookingStatus, mongoId: mId, severity: 'HIGH' });
    }

    // Payment Status
    if ((mongoBooking.paymentStatus || '').toLowerCase() !== (supabaseBooking.paymentStatus || '').toLowerCase()) {
        mismatches.push({ field: 'paymentStatus', mongoValue: mongoBooking.paymentStatus, supabaseValue: supabaseBooking.paymentStatus, mongoId: mId, severity: 'HIGH' });
    }

    // Price
    if (parseFloat(mongoBooking.price || 0) !== parseFloat(supabaseBooking.price || 0)) {
        mismatches.push({ field: 'price', mongoValue: mongoBooking.price, supabaseValue: supabaseBooking.price, mongoId: mId, severity: 'MEDIUM' });
    }

    // Inventory Reserved & Released Flags
    if (!!mongoBooking.inventoryReserved !== !!supabaseBooking.inventoryReserved) {
        mismatches.push({ field: 'inventoryReserved', mongoValue: !!mongoBooking.inventoryReserved, supabaseValue: !!supabaseBooking.inventoryReserved, mongoId: mId, severity: 'CRITICAL' });
    }

    if (!!mongoBooking.inventoryReleased !== !!supabaseBooking.inventoryReleased) {
        mismatches.push({ field: 'inventoryReleased', mongoValue: !!mongoBooking.inventoryReleased, supabaseValue: !!supabaseBooking.inventoryReleased, mongoId: mId, severity: 'CRITICAL' });
    }

    return mismatches;
}

async function findBookingById(id) {
    return await executeShadowRead({
        domain: 'bookings',
        operation: 'findBookingById',
        mongoRead: async () => await mongoBookingAdapter.findBookingById(id),
        supabaseRead: async () => await supabaseBookingAdapter.findBookingById(id),
        compareFields: compareBookingFields
    });
}

async function listBookings(filter = {}) {
    return await executeShadowRead({
        domain: 'bookings',
        operation: 'listBookings',
        mongoRead: async () => await mongoBookingAdapter.listBookings(filter),
        supabaseRead: async () => await supabaseBookingAdapter.listBookings(filter),
        compareFields: (mList, sList) => {
            const mismatches = [];
            if ((mList || []).length !== (sList || []).length) {
                mismatches.push({ field: 'listCount', mongoValue: (mList || []).length, supabaseValue: (sList || []).length, severity: 'HIGH' });
            }
            return mismatches;
        }
    });
}

module.exports = {
    findBookingById,
    listBookings
};
