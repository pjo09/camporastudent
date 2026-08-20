-- ======================================================
-- MIGRATION 008: TENANCIES & RESIDENT REQUESTS
-- (Tenancy and ResidentRequest Models)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS tenancies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    room VARCHAR NOT NULL,
    bed VARCHAR DEFAULT '',
    start_date TIMESTAMPTZ NOT NULL,
    end_date TIMESTAMPTZ NULL,
    status VARCHAR DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'ENDED', 'CANCELLED')),
    source VARCHAR NOT NULL CHECK (source IN ('BOOKING', 'EXISTING_RESIDENT')),
    verified_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resident_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
    room VARCHAR NOT NULL,
    bed VARCHAR DEFAULT '',
    move_in_date TIMESTAMPTZ NOT NULL,
    expected_move_out_date TIMESTAMPTZ NULL,
    residence_source VARCHAR NOT NULL CHECK (residence_source IN ('DIRECT_OWNER', 'OTHER_PLATFORM', 'FRIEND', 'OFFLINE', 'OTHER')),
    proof_document TEXT DEFAULT '',
    message TEXT DEFAULT '',
    status VARCHAR DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED')),
    requested_at TIMESTAMPTZ DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ NULL,
    reviewed_by UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    rejection_reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tenancies_student_id ON tenancies(student_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_property_id ON tenancies(property_id);
CREATE INDEX IF NOT EXISTS idx_tenancies_status ON tenancies(status);
CREATE INDEX IF NOT EXISTS idx_resident_requests_student_id ON resident_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_resident_requests_property_id ON resident_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_resident_requests_status ON resident_requests(status);
CREATE INDEX IF NOT EXISTS idx_resident_requests_student_prop_status ON resident_requests(student_id, property_id, status);
