-- ======================================================
-- MIGRATION 021: DELETE OWNER PROPERTY TRANSACTION RPC
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

CREATE OR REPLACE FUNCTION public.delete_owner_property_transaction(
    p_property_id UUID
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
    v_user_id UUID;
    v_owner_id UUID;
    v_active_tenancies INT;
    v_pending_requests INT;
    v_history_count INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not logged in';
    END IF;

    -- Lock and verify property ownership
    SELECT owner_id INTO v_owner_id
    FROM properties
    WHERE id = p_property_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    IF v_owner_id <> v_user_id THEN
        RAISE EXCEPTION 'Forbidden: You do not own this property';
    END IF;

    -- 1. Check for active residents / tenancies
    SELECT COUNT(*) INTO v_active_tenancies
    FROM tenancies
    WHERE property_id = p_property_id AND status = 'ACTIVE';

    IF v_active_tenancies > 0 THEN
        RAISE EXCEPTION 'Cannot delete property: This property has % active resident(s). Please end or complete active tenancies first.', v_active_tenancies;
    END IF;

    -- 2. Check for pending resident join requests
    SELECT COUNT(*) INTO v_pending_requests
    FROM resident_requests
    WHERE property_id = p_property_id AND status = 'PENDING';

    IF v_pending_requests > 0 THEN
        RAISE EXCEPTION 'Cannot delete property: This property has % pending resident join request(s). Please review or reject pending requests first.', v_pending_requests;
    END IF;

    -- 3. Check for historical business records (bookings, tenancies, resident_requests, invoices)
    SELECT (
        (SELECT COUNT(*) FROM bookings WHERE property_id = p_property_id) +
        (SELECT COUNT(*) FROM tenancies WHERE property_id = p_property_id) +
        (SELECT COUNT(*) FROM resident_requests WHERE property_id = p_property_id) +
        (SELECT COUNT(*) FROM invoices WHERE property_id = p_property_id)
    ) INTO v_history_count;

    IF v_history_count > 0 THEN
        -- Soft Delete / Archive property to preserve historical business & financial records
        UPDATE properties
        SET published = FALSE,
            status = 'archived',
            updated_at = NOW()
        WHERE id = p_property_id;

        RETURN jsonb_build_object(
            'success', true,
            'archived', true,
            'message', 'Property archived successfully to preserve historical resident and business records.'
        );
    ELSE
        -- Clean unused property: remove disposable child records and physically delete property
        DELETE FROM property_invites WHERE property_id = p_property_id;
        DELETE FROM saved_properties WHERE property_id = p_property_id;
        DELETE FROM recent_properties WHERE property_id = p_property_id;
        DELETE FROM reviews WHERE property_id = p_property_id;
        DELETE FROM maintenance_requests WHERE property_id = p_property_id;
        DELETE FROM announcements WHERE property_id = p_property_id;
        DELETE FROM property_images WHERE property_id = p_property_id;
        DELETE FROM property_amenities WHERE property_id = p_property_id;

        DELETE FROM properties WHERE id = p_property_id;

        RETURN jsonb_build_object(
            'success', true,
            'deleted', true,
            'message', 'Property deleted successfully.'
        );
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_owner_property_transaction(UUID) TO authenticated;
