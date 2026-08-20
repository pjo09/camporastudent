-- ======================================================
-- MIGRATION 004: BOOKINGS (Booking Model)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS bookings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    property_id UUID NULL REFERENCES properties(id) ON DELETE RESTRICT,
    property_name VARCHAR DEFAULT '',
    user_id UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    user_name VARCHAR DEFAULT '',
    user_email VARCHAR DEFAULT '',
    price NUMERIC(10,2) NOT NULL CHECK (price >= 0),
    owner_id UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    check_in TIMESTAMPTZ NULL,
    check_out TIMESTAMPTZ NULL,
    duration VARCHAR DEFAULT '',
    number_of_guests INTEGER DEFAULT 1 CHECK (number_of_guests >= 1),
    payment_status VARCHAR DEFAULT 'pending' CHECK (payment_status IN ('pending', 'paid', 'partially-paid', 'failed', 'refunded')),
    booking_status VARCHAR DEFAULT 'pending' CHECK (booking_status IN ('pending', 'confirmed', 'cancelled', 'rejected', 'completed', 'checked-in', 'checked_in', 'active', 'expired', 'refunded')),
    payment_id VARCHAR DEFAULT '',
    payment_date TIMESTAMPTZ NULL,
    payment_method VARCHAR DEFAULT 'UPI',
    special_request TEXT DEFAULT '',
    cancel_reason TEXT DEFAULT '',
    check_in_instructions TEXT DEFAULT '',
    check_in_window VARCHAR DEFAULT '',
    meeting_instructions TEXT DEFAULT '',
    special_instructions TEXT DEFAULT '',
    reminder_sent_7days BOOLEAN DEFAULT FALSE,
    reminder_sent_1day BOOLEAN DEFAULT FALSE,
    inventory_reserved BOOLEAN DEFAULT FALSE,
    inventory_released BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subdocument table for required documents list
CREATE TABLE IF NOT EXISTS booking_documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    required BOOLEAN DEFAULT TRUE,
    submitted BOOLEAN DEFAULT FALSE,
    document_url TEXT DEFAULT '',
    file_name VARCHAR DEFAULT '',
    submitted_at TIMESTAMPTZ NULL
);

-- Indexes for status, owner, student and property lookups
CREATE INDEX IF NOT EXISTS idx_bookings_owner_status_created ON bookings(owner_id, booking_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_user_status_created ON bookings(user_id, booking_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_bookings_property_status ON bookings(property_id, booking_status);
CREATE INDEX IF NOT EXISTS idx_bookings_payment_status_created ON bookings(payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_booking_documents_booking_id ON booking_documents(booking_id);
