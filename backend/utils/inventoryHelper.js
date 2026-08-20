const Booking = require("../models/Booking");
const Property = require("../models/Property");

/**
 * Atomically reserves a bed on the specified property.
 * @param {string} propertyId
 * @param {Object} [session] Optional Mongoose transaction session
 */
async function reserveBookingInventory(propertyId, session = null) {
    const query = {
        _id: propertyId,
        status: "approved",
        published: true,
        blacklisted: { $ne: true },
        availableBeds: { $gt: 0 }
    };
    const update = {
        $inc: { availableBeds: -1 }
    };
    const options = session ? { session, new: true } : { new: true };
    return await Property.findOneAndUpdate(query, update, options);
}

/**
 * Atomically releases a bed for the specified booking.
 * Idempotent. Ensures a bed is never released twice for the same booking.
 * @param {string} bookingId
 * @param {Object} [session] Optional Mongoose transaction session
 */
async function releaseBookingInventory(bookingId, session = null) {
    const query = {
        _id: bookingId,
        inventoryReserved: true,
        inventoryReleased: { $ne: true }
    };
    const update = {
        $set: { inventoryReleased: true }
    };
    const options = session ? { session, new: false } : { new: false };
    
    // Atomically find the booking and mark it as released
    const booking = await Booking.findOneAndUpdate(query, update, options);

    if (!booking) {
        // Booking did not have inventory reserved or was already released
        return false;
    }

    // Atomically increment the property's availableBeds count
    const propOptions = session ? { session } : {};
    await Property.updateOne(
        { _id: booking.propertyId },
        { $inc: { availableBeds: 1 } },
        propOptions
    );

    return true;
}

/**
 * Executes a function block within a transaction and retries on write conflict.
 * @param {Object} session Mongoose session
 * @param {Function} fn Async function block to run
 * @param {number} [retries=5] Maximum transaction attempts
 */
async function executeTransactionWithRetry(session, fn, retries = 5) {
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            session.startTransaction();
            const result = await fn(session);
            await session.commitTransaction();
            return result;
        } catch (err) {
            if (session.inTransaction()) {
                await session.abortTransaction();
            }
            const isWriteConflict = err.code === 112 || 
                                    err.message.includes("WriteConflict") || 
                                    err.message.includes("write conflict");
            if (isWriteConflict && attempt < retries) {
                // Exponential random delay backoff
                const delay = Math.round(Math.random() * 50 * attempt + 10);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw err;
        }
    }
}

module.exports = {
    reserveBookingInventory,
    releaseBookingInventory,
    executeTransactionWithRetry
};
