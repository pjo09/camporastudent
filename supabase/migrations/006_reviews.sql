-- ======================================================
-- MIGRATION 006: REVIEWS (Review Model)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    property_id UUID NULL REFERENCES properties(id) ON DELETE CASCADE,
    user_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name VARCHAR DEFAULT '',
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT DEFAULT '',
    status VARCHAR DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'rejected')),
    reported BOOLEAN DEFAULT FALSE,
    likes INTEGER DEFAULT 0 CHECK (likes >= 0),
    owner_reply TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_reviews_property_status_created ON reviews(property_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reviews_user_id ON reviews(user_id);
