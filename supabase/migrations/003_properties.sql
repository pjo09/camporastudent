-- ======================================================
-- MIGRATION 003: PROPERTIES (Property Model)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS properties (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    owner_id UUID NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    property_name VARCHAR NOT NULL,
    property_type VARCHAR NOT NULL CHECK (property_type IN ('PG', 'Hostel', 'Apartment', 'Flat', 'Coliving')),
    state VARCHAR NOT NULL,
    city VARCHAR NOT NULL,
    college VARCHAR DEFAULT '',
    address TEXT NOT NULL,
    latitude NUMERIC(10,8) NULL,
    longitude NUMERIC(11,8) NULL,
    rent NUMERIC(10,2) NOT NULL CHECK (rent >= 0),
    deposit NUMERIC(10,2) DEFAULT 0 CHECK (deposit >= 0),
    gender VARCHAR CHECK (gender IN ('Boys', 'Girls', 'Co-ed', 'Unisex')),
    sharing VARCHAR CHECK (sharing IN ('Single', 'Double', 'Triple', 'Four Sharing')),
    amenities TEXT[] DEFAULT '{}',
    description TEXT DEFAULT '',
    images TEXT[] DEFAULT '{}',
    available_beds INTEGER DEFAULT 0 CHECK (available_beds >= 0),
    total_beds INTEGER DEFAULT 0 CHECK (total_beds >= 0),
    featured BOOLEAN DEFAULT FALSE,
    verified BOOLEAN DEFAULT FALSE,
    status VARCHAR DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    average_rating NUMERIC(3,2) DEFAULT 0 CHECK (average_rating >= 0 AND average_rating <= 5),
    total_reviews INTEGER DEFAULT 0 CHECK (total_reviews >= 0),
    views INTEGER DEFAULT 0 CHECK (views >= 0),
    house_rules JSONB DEFAULT '{"smoking": false, "drinking": false, "pets": false, "visitors": true, "gateClosingTime": ""}'::jsonb,
    maintenance_charge NUMERIC(10,2) DEFAULT 0 CHECK (maintenance_charge >= 0),
    electricity_charge NUMERIC(10,2) DEFAULT 0 CHECK (electricity_charge >= 0),
    food_charge NUMERIC(10,2) DEFAULT 0 CHECK (food_charge >= 0),
    available BOOLEAN DEFAULT TRUE,
    published BOOLEAN DEFAULT FALSE,
    blacklisted BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relational table for normalized property images
CREATE TABLE IF NOT EXISTS property_images (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Relational table for normalized nearby points of interest
CREATE TABLE IF NOT EXISTS property_nearby (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    title VARCHAR NOT NULL,
    distance VARCHAR NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for search & filtering performance
CREATE INDEX IF NOT EXISTS idx_properties_owner_id ON properties(owner_id);
CREATE INDEX IF NOT EXISTS idx_properties_city ON properties(city);
CREATE INDEX IF NOT EXISTS idx_properties_state ON properties(state);
CREATE INDEX IF NOT EXISTS idx_properties_college ON properties(college);
CREATE INDEX IF NOT EXISTS idx_properties_rent ON properties(rent);
CREATE INDEX IF NOT EXISTS idx_properties_property_type ON properties(property_type);
CREATE INDEX IF NOT EXISTS idx_properties_status ON properties(status);
CREATE INDEX IF NOT EXISTS idx_properties_featured ON properties(featured);
CREATE INDEX IF NOT EXISTS idx_properties_average_rating ON properties(average_rating DESC);
CREATE INDEX IF NOT EXISTS idx_properties_created_at ON properties(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_images_property_id ON property_images(property_id);
CREATE INDEX IF NOT EXISTS idx_property_nearby_property_id ON property_nearby(property_id);
