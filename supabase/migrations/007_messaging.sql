-- ======================================================
-- MIGRATION 007: MESSAGING (Message & MessageConversation Models)
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    owner_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE,
    student_id UUID NULL REFERENCES profiles(id) ON DELETE CASCADE,
    property_id UUID NULL REFERENCES properties(id) ON DELETE SET NULL,
    booking_id UUID NULL REFERENCES bookings(id) ON DELETE SET NULL,
    status VARCHAR DEFAULT 'active' CHECK (status IN ('active', 'archived', 'blocked')),
    last_message TEXT DEFAULT '',
    last_message_at TIMESTAMPTZ DEFAULT NOW(),
    last_sender VARCHAR DEFAULT 'owner',
    unread_by_owner INTEGER DEFAULT 0 CHECK (unread_by_owner >= 0),
    unread_by_student INTEGER DEFAULT 0 CHECK (unread_by_student >= 0),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mongo_id VARCHAR(24) UNIQUE NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender VARCHAR DEFAULT 'owner',
    sender_id UUID NULL REFERENCES profiles(id) ON DELETE SET NULL,
    text TEXT DEFAULT '',
    attachment JSONB DEFAULT '{"url": "", "type": ""}'::jsonb,
    is_read BOOLEAN DEFAULT FALSE,
    read_at TIMESTAMPTZ NULL,
    is_broadcast BOOLEAN DEFAULT FALSE,
    broadcast_type VARCHAR DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Subdocument table for broadcast message delivery tracking
CREATE TABLE IF NOT EXISTS message_broadcast_deliveries (
    message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_conversations_owner_status ON conversations(owner_id, status);
CREATE INDEX IF NOT EXISTS idx_conversations_student_status ON conversations(student_id, status);
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created ON messages(conversation_id, created_at ASC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON messages(sender_id);
