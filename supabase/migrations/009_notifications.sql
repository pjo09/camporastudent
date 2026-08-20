-- ======================================================
-- MIGRATION 009: NOTIFICATIONS (Notification Model)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    receiver_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR DEFAULT 'general' CHECK (type IN (
        'general', 'booking', 'payment', 'property', 'system',
        'NEW_MESSAGE', 'BOOKING_CONFIRMED', 'MOVE_IN_REMINDER', 'NEW_ANNOUNCEMENT',
        'CHECK_IN_UPDATE', 'DOCUMENT_REQUEST', 'BOOKING_UPDATE',
        'NEW_RESIDENT_REQUEST', 'RESIDENT_REQUEST_APPROVED', 'RESIDENT_REQUEST_REJECTED'
    )),
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_notifications_receiver_created ON notifications(receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);
