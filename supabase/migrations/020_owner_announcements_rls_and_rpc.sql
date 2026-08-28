-- ======================================================
-- MIGRATION 020: OWNER ANNOUNCEMENTS RLS & RPC
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

-- 1. Add INSERT policy on announcements for property owners
DROP POLICY IF EXISTS "Property owners insert own announcements" ON announcements;

CREATE POLICY "Property owners insert own announcements" ON announcements
    FOR INSERT WITH CHECK (
        auth.uid() = owner_id AND
        EXISTS (SELECT 1 FROM properties p WHERE p.id = announcements.property_id AND p.owner_id = auth.uid())
    );

-- 2. Create secure transactional RPC for owner announcements
CREATE OR REPLACE FUNCTION public.create_owner_announcement_transaction(
    p_title VARCHAR,
    p_message TEXT,
    p_property_id UUID DEFAULT NULL
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id UUID;
    v_target_prop_id UUID;
    v_announcement_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not logged in';
    END IF;

    IF p_message IS NULL OR TRIM(p_message) = '' THEN
        RAISE EXCEPTION 'Validation error: Announcement message cannot be empty';
    END IF;

    -- If property_id is passed, verify ownership
    IF p_property_id IS NOT NULL THEN
        SELECT id INTO v_target_prop_id
        FROM properties
        WHERE id = p_property_id AND owner_id = v_user_id;

        IF v_target_prop_id IS NULL THEN
            RAISE EXCEPTION 'Forbidden: You do not own property %', p_property_id;
        END IF;
    ELSE
        -- Default to the owner's first active property
        SELECT id INTO v_target_prop_id
        FROM properties
        WHERE owner_id = v_user_id
        ORDER BY created_at ASC
        LIMIT 1;

        IF v_target_prop_id IS NULL THEN
            RAISE EXCEPTION 'Forbidden: You do not have any registered properties to send a broadcast';
        END IF;
    END IF;

    -- Insert announcement safely
    INSERT INTO announcements (
        owner_id,
        property_id,
        title,
        message,
        active
    ) VALUES (
        v_user_id,
        v_target_prop_id,
        COALESCE(NULLIF(TRIM(p_title), ''), 'Announcement'),
        TRIM(p_message),
        TRUE
    ) RETURNING id INTO v_announcement_id;

    RETURN jsonb_build_object(
        'success', true,
        'announcementId', v_announcement_id,
        'message', 'Broadcast announcement created successfully'
    );
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_owner_announcement_transaction(VARCHAR, TEXT, UUID) TO authenticated;
