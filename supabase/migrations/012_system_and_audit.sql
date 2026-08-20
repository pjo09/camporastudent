-- ======================================================
-- MIGRATION 012: SYSTEM & AUDIT
-- (AuditLog, Contact, PropertyInvite, Setting Models)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    user_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    user_email VARCHAR DEFAULT '',
    role VARCHAR NOT NULL,
    action VARCHAR NOT NULL CHECK (action IN (
        'ADMIN_LOGIN', 'OWNER_APPROVAL', 'OWNER_REJECTION', 'PROPERTY_APPROVAL',
        'PROPERTY_REJECTION', 'PROPERTY_BLACKLISTED', 'USER_BAN', 'USER_UNBAN',
        'PROPERTY_DELETION', 'BOOKING_APPROVAL', 'BOOKING_REJECTION',
        'REVIEW_DELETION', 'CONTACT_RESOLUTION'
    )),
    resource VARCHAR NOT NULL,
    resource_id VARCHAR DEFAULT '',
    details JSONB DEFAULT '{}'::jsonb,
    ip_address VARCHAR DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    name VARCHAR DEFAULT '',
    email VARCHAR DEFAULT '',
    message TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS property_invites (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    property_id UUID NULL REFERENCES properties(id) ON DELETE CASCADE,
    token VARCHAR NOT NULL UNIQUE,
    expires_at TIMESTAMPTZ NULL,
    status VARCHAR DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'REVOKED')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    site_name VARCHAR DEFAULT 'Campora',
    site_description TEXT DEFAULT 'India''s Smart Student Accommodation Platform',
    support_email VARCHAR DEFAULT 'support@campora.in',
    support_phone VARCHAR DEFAULT '',
    maintenance_mode BOOLEAN DEFAULT FALSE,
    allow_registration BOOLEAN DEFAULT TRUE,
    allow_property_upload BOOLEAN DEFAULT TRUE,
    featured_property_fee NUMERIC(10,2) DEFAULT 0 CHECK (featured_property_fee >= 0),
    commission_percentage NUMERIC(5,2) DEFAULT 5 CHECK (commission_percentage >= 0),
    currency VARCHAR DEFAULT 'INR',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action ON audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_property_invites_property_id ON property_invites(property_id);
CREATE INDEX IF NOT EXISTS idx_property_invites_token ON property_invites(token);
