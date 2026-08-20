-- ======================================================
-- MIGRATION 001: PROFILES (User Model)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    name VARCHAR NOT NULL,
    email VARCHAR NOT NULL UNIQUE,
    password_hash VARCHAR NULL,
    auth_provider VARCHAR DEFAULT 'password' CHECK (auth_provider IN ('password', 'google', 'otp')),
    phone VARCHAR DEFAULT '',
    role VARCHAR DEFAULT 'student' CHECK (role IN ('student', 'owner', 'admin')),
    verified BOOLEAN DEFAULT FALSE,
    provider VARCHAR DEFAULT 'local' CHECK (provider IN ('local', 'google')),
    google_id VARCHAR DEFAULT '',
    avatar TEXT DEFAULT '',
    college VARCHAR DEFAULT '',
    course VARCHAR DEFAULT '',
    year VARCHAR DEFAULT '',
    business_name VARCHAR DEFAULT '',
    city VARCHAR DEFAULT '',
    profile_image TEXT DEFAULT '',
    bio TEXT DEFAULT '',
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'blocked', 'suspended')),
    account_status VARCHAR DEFAULT 'ACTIVE' CHECK (account_status IN ('ACTIVE', 'PENDING', 'REJECTED', 'BANNED', 'DELETED')),
    last_login TIMESTAMPTZ NULL,
    email_verified BOOLEAN DEFAULT FALSE,
    phone_verified BOOLEAN DEFAULT FALSE,
    emergency_contact JSONB DEFAULT '{"name": "", "phone": ""}'::jsonb,
    kyc_verified BOOLEAN DEFAULT FALSE,
    gst_number VARCHAR DEFAULT '',
    property_count INTEGER DEFAULT 0 CHECK (property_count >= 0),
    rating NUMERIC(3,2) DEFAULT 0 CHECK (rating >= 0 AND rating <= 5),
    notification_settings JSONB DEFAULT '{"email": true, "sms": true, "push": true}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_account_status ON profiles(account_status);
CREATE INDEX IF NOT EXISTS idx_profiles_status ON profiles(status);
CREATE INDEX IF NOT EXISTS idx_profiles_role_status ON profiles(role, status);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON profiles(created_at DESC);
