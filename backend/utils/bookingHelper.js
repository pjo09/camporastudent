const mongoose = require("mongoose");
const { MessageConversation, Message } = require("../models/Message");
const Notification = require("../models/Notification");
const User = require("../models/User");

/**
 * Synchronizes/creates a conversation for a confirmed booking.
 * Idempotent.
 */
async function syncBookingConversation(booking) {
    if (!booking) return null;

    // Only confirmed bookings can have active conversations
    if (booking.bookingStatus !== "confirmed") {
        return null;
    }

    // 1. Try to find conversation by bookingId
    let conv = await MessageConversation.findOne({ bookingId: booking._id });

    // 2. Fallback: check if conversation exists for the student + owner + property without bookingId
    if (!conv) {
        conv = await MessageConversation.findOne({
            studentId: booking.userId,
            ownerId: booking.ownerId,
            propertyId: booking.propertyId
        });

        if (conv) {
            // Update it with the bookingId
            conv.bookingId = booking._id;
            await conv.save();
        }
    }

    // 3. Create a new conversation if not found
    if (!conv) {
        conv = await MessageConversation.create({
            studentId: booking.userId,
            ownerId: booking.ownerId,
            propertyId: booking.propertyId,
            bookingId: booking._id,
            status: "active",
            lastMessage: "Your booking is confirmed. You can now communicate with your property owner here and coordinate your move-in.",
            lastMessageAt: new Date(),
            lastSender: "owner",
            unreadByStudent: 1,
            unreadByOwner: 0
        });
    }

    // 4. Create the initial system message if it doesn't exist
    const systemText = "Your booking is confirmed. You can now communicate with your property owner here and coordinate your move-in.";
    const systemMsgExists = await Message.exists({
        conversationId: conv._id,
        sender: "system",
        text: systemText
    });

    if (!systemMsgExists) {
        await Message.create({
            conversationId: conv._id,
            sender: "system",
            senderId: booking.ownerId, // Required field in schema
            text: systemText,
            isRead: false
        });
    }

    // 5. Send idempotent notifications (only if not already notified for this booking confirmation)
    // We check if a BOOKING_CONFIRMED notification has already been sent for this booking receiverId
    const studentNotified = await Notification.exists({
        receiverId: booking.userId,
        type: "BOOKING_CONFIRMED",
        message: { $regex: booking.propertyName || "", $options: "i" }
    });

    if (!studentNotified) {
        try {
            await Notification.create({
                receiverId: booking.userId,
                title: "Booking Confirmed! 🎉",
                message: `Your booking for ${booking.propertyName || "property"} is confirmed. Start coordinating with the owner in the Move-In Center.`,
                type: "BOOKING_CONFIRMED"
            });
        } catch (e) {
            console.error("Error creating student booking confirmation notification:", e.message);
        }
    }

    const ownerNotified = await Notification.exists({
        receiverId: booking.ownerId,
        type: "BOOKING_CONFIRMED",
        message: { $regex: booking.userName || "", $options: "i" }
    });

    if (!ownerNotified) {
        try {
            await Notification.create({
                receiverId: booking.ownerId,
                title: "Booking Confirmed! 📢",
                message: `Booking for property ${booking.propertyName || ""} by ${booking.userName || "student"} is confirmed.`,
                type: "BOOKING_CONFIRMED"
            });
        } catch (e) {
            console.error("Error creating owner booking confirmation notification:", e.message);
        }
    }

    return conv;
}

/**
 * Scans all confirmed bookings and repairs any missing conversations.
 * Run on startup.
 */
async function syncAllBookingConversations() {
    try {
        const Booking = require("../models/Booking");
        const bookings = await Booking.find({ bookingStatus: "confirmed" });
        console.log(`[Sync] Running database check. Found ${bookings.length} confirmed bookings.`);
        let count = 0;
        for (const booking of bookings) {
            const conv = await syncBookingConversation(booking);
            if (conv) count++;
        }
        console.log(`[Sync] Database check complete. Synchronized ${count} conversations.`);
    } catch (err) {
        console.error("[Sync] Error in database synchronization:", err.message);
    }
}

/**
 * Checks and sends move-in reminders (7 days and 1 day before check-in).
 * Idempotent. Excludes cancelled, rejected, checked-in/out, or invalid bookings.
 */
async function checkAndSendMoveInReminders() {
    try {
        const Booking = require("../models/Booking");
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        // Find confirmed bookings with check-in dates
        const bookings = await Booking.find({
            bookingStatus: "confirmed",
            checkIn: { $ne: null }
        });

        console.log(`[Scheduler] Checking move-in reminders for ${bookings.length} bookings...`);

        let sent7Days = 0;
        let sent1Day = 0;

        for (const booking of bookings) {
            const checkInDate = new Date(booking.checkIn);
            checkInDate.setHours(0, 0, 0, 0);

            const diffTime = checkInDate.getTime() - today.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            // Exclude already checked-in or past check-in dates
            if (diffDays < 0) continue;

            // 7-day reminder
            if (diffDays <= 7 && diffDays > 1 && !booking.reminderSent7Days) {
                await Notification.create({
                    receiverId: booking.userId,
                    title: "Move-In Reminder (7 Days) ⏳",
                    message: `Your move-in for ${booking.propertyName} is coming up in ${diffDays} days! Visit the Move-In Center for instructions.`,
                    type: "MOVE_IN_REMINDER"
                });
                booking.reminderSent7Days = true;
                await booking.save();
                sent7Days++;
            }

            // 1-day reminder
            if (diffDays <= 1 && diffDays >= 0 && !booking.reminderSent1Day) {
                await Notification.create({
                    receiverId: booking.userId,
                    title: "Move-In Tomorrow! 📦",
                    message: `Your move-in for ${booking.propertyName} is tomorrow! Please check your check-in instructions.`,
                    type: "MOVE_IN_REMINDER"
                });
                booking.reminderSent1Day = true;
                await booking.save();
                sent1Day++;
            }
        }

        console.log(`[Scheduler] Reminders sent: 7-day (${sent7Days}), 1-day (${sent1Day}).`);
    } catch (err) {
        console.error("[Scheduler] Error running move-in reminders:", err.message);
    }
}

module.exports = {
    syncBookingConversation,
    syncAllBookingConversations,
    checkAndSendMoveInReminders
};
