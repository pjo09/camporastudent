-- ======================================================
-- MIGRATION 002: LOCATION MASTER (State, City, College Models)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS states (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    name VARCHAR NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    state_id UUID REFERENCES states(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL
);

CREATE TABLE IF NOT EXISTS colleges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    state_id UUID NOT NULL REFERENCES states(id) ON DELETE CASCADE,
    city_id UUID NOT NULL REFERENCES cities(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL,
    latitude NUMERIC(10,8) NULL,
    longitude NUMERIC(11,8) NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_cities_state_id ON cities(state_id);
CREATE INDEX IF NOT EXISTS idx_colleges_state_id ON colleges(state_id);
CREATE INDEX IF NOT EXISTS idx_colleges_city_id ON colleges(city_id);
CREATE INDEX IF NOT EXISTS idx_colleges_name ON colleges(name);
