-- ======================================================
-- MIGRATION 005: SAVED & RECENT PROPERTIES
-- (User.savedProperties and User.recentlyViewed arrays)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS saved_properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_saved_property UNIQUE (user_id, property_id)
);

CREATE TABLE IF NOT EXISTS recently_viewed (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_user_recent_property UNIQUE (user_id, property_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_saved_properties_user_id ON saved_properties(user_id);
CREATE INDEX IF NOT EXISTS idx_saved_properties_property_id ON saved_properties(property_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_user_id ON recently_viewed(user_id);
CREATE INDEX IF NOT EXISTS idx_recently_viewed_viewed_at ON recently_viewed(viewed_at DESC);
