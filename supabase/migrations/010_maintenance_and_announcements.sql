-- ======================================================
-- MIGRATION 010: MAINTENANCE & ANNOUNCEMENTS
-- (Maintenance & Announcement Models)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS maintenance_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    student_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    category VARCHAR DEFAULT 'Other' CHECK (category IN (
        'Electrical', 'Internet', 'Cleaning', 'Furniture', 'Plumbing',
        'Water', 'Appliance', 'Pest Control', 'Other'
    )),
    title VARCHAR NOT NULL,
    description TEXT DEFAULT '',
    priority VARCHAR DEFAULT 'Medium' CHECK (priority IN ('Low', 'Medium', 'High', 'Urgent')),
    status VARCHAR DEFAULT 'open' CHECK (status IN ('open', 'assigned', 'in-progress', 'resolved', 'rejected')),
    assigned_to VARCHAR DEFAULT '',
    images TEXT[] DEFAULT '{}',
    resolved_at TIMESTAMPTZ NULL,
    rejected_reason TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subdocument table for maintenance request comments
CREATE TABLE IF NOT EXISTS maintenance_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    maintenance_id UUID NOT NULL REFERENCES maintenance_requests(id) ON DELETE CASCADE,
    author_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    author_name VARCHAR DEFAULT '',
    text TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    owner_id UUID NOT NULL REFERENCES profiles(id) ON DELETE RESTRICT,
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    active BOOLEAN DEFAULT TRUE,
    expires_at TIMESTAMPTZ NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Target students list for announcement delivery
CREATE TABLE IF NOT EXISTS announcement_targets (
    announcement_id UUID NOT NULL REFERENCES announcements(id) ON DELETE CASCADE,
    student_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (announcement_id, student_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_maintenance_status_created ON maintenance_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_maintenance_priority_status ON maintenance_requests(priority, status);
CREATE INDEX IF NOT EXISTS idx_maintenance_property_id ON maintenance_requests(property_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_owner_id ON maintenance_requests(owner_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_student_id ON maintenance_requests(student_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_comments_maint_id ON maintenance_comments(maintenance_id);

CREATE INDEX IF NOT EXISTS idx_announcements_property_active_created ON announcements(property_id, active, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_announcements_owner_id ON announcements(owner_id);
