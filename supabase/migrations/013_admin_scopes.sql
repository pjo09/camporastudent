-- ======================================================
-- MIGRATION 013: ADMIN SCOPES
-- (Area-Based Admin Access Control Schema)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS admin_scopes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    admin_user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    scope_type VARCHAR NOT NULL CHECK (scope_type IN ('GLOBAL', 'STATE', 'CITY')),
    state VARCHAR DEFAULT '',
    city VARCHAR DEFAULT '',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT chk_admin_scope_values CHECK (
        (scope_type = 'GLOBAL' AND state = '' AND city = '') OR
        (scope_type = 'STATE' AND state <> '' AND city = '') OR
        (scope_type = 'CITY' AND state <> '' AND city <> '')
    )
);

CREATE INDEX IF NOT EXISTS idx_admin_scopes_user ON admin_scopes(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_scopes_type ON admin_scopes(scope_type);
CREATE INDEX IF NOT EXISTS idx_admin_scopes_state_city ON admin_scopes(state, city);
CREATE INDEX IF NOT EXISTS idx_admin_scopes_active ON admin_scopes(is_active);
