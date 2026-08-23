-- Migration 017: Secure User Account Deletion / Anonymization
-- Production-hardened version.
--
-- Behavior:
--   1. Requires an authenticated Supabase user.
--   2. Derives identity exclusively from auth.uid().
--   3. Blocks deletion while active bookings/tenancies exist.
--   4. Archives owner properties/announcements.
--   5. Removes transient personal records.
--   6. Anonymizes the profiles row to preserve historical FK references.
--   7. Removes the corresponding Supabase Auth account.
--
-- IMPORTANT:
--   profiles.id and auth.users.id use the same UUID values,
--   but profiles does not have an FK to auth.users.

CREATE OR REPLACE FUNCTION public.delete_user_account()
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    current_user_id UUID;
    user_role VARCHAR;
    active_booking_count INTEGER := 0;
    active_tenancy_count INTEGER := 0;
BEGIN
    -- 1. Get identity exclusively from the authenticated Supabase session.
    current_user_id := auth.uid();

    IF current_user_id IS NULL THEN
        RAISE EXCEPTION 'Not authenticated';
    END IF;

    -- 2. Get the user's role from the profile.
    SELECT role
    INTO user_role
    FROM public.profiles
    WHERE id = current_user_id;

    -- If the profile is already gone, remove the Auth account only.
    IF user_role IS NULL THEN
        DELETE FROM auth.users
        WHERE id = current_user_id;

        RETURN json_build_object(
            'success', true,
            'message', 'Auth account removed'
        );
    END IF;

    -- 3. Prevent deletion while active bookings exist.
    SELECT COUNT(*)
    INTO active_booking_count
    FROM public.bookings
    WHERE (user_id = current_user_id OR owner_id = current_user_id)
      AND booking_status IN (
          'confirmed',
          'checked-in',
          'checked_in',
          'active'
      );

    -- 4. Prevent deletion while an active tenancy exists.
    SELECT COUNT(*)
INTO active_tenancy_count
FROM public.tenancies t
LEFT JOIN public.properties p
    ON t.property_id = p.id
WHERE (
    t.student_id = current_user_id
    OR p.owner_id = current_user_id
)
AND t.status = 'ACTIVE';

    IF active_booking_count > 0 OR active_tenancy_count > 0 THEN
        RAISE EXCEPTION
            'Cannot delete account while you have active bookings or ongoing tenancies. Please complete or cancel them first.';
    END IF;

    -- 5. Owner-specific cleanup.
    IF user_role = 'owner' THEN

        -- Preserve historical property records,
        -- but remove them from the active marketplace.
        UPDATE public.properties
        SET
            published = false,
            available = false,
            status = 'rejected',
            updated_at = NOW()
        WHERE owner_id = current_user_id;

        -- Disable owner announcements.
        UPDATE public.announcements
        SET
            active = false,
            updated_at = NOW()
        WHERE owner_id = current_user_id;

    END IF;

    -- 6. Delete transient/personal records.
    DELETE FROM public.saved_properties
    WHERE user_id = current_user_id;

    DELETE FROM public.recently_viewed
    WHERE user_id = current_user_id;

    DELETE FROM public.notifications
    WHERE receiver_id = current_user_id;

    DELETE FROM public.announcement_targets
    WHERE student_id = current_user_id;

    -- 7. Anonymize reviews while preserving historical reviews.
    UPDATE public.reviews
    SET
        name = 'Former Resident',
        comment = '[User account deleted]'
    WHERE user_id = current_user_id;

    -- 8. Anonymize the profile.
    --
    -- IMPORTANT:
    -- The profile row is intentionally preserved because many
    -- historical tables use RESTRICT foreign keys to profiles.id.
    UPDATE public.profiles
    SET
        name = 'Deleted User',
        email = 'deleted_' || current_user_id || '@deleted.campora.in',
        phone = '',
        avatar = '',
        profile_image = '',
        bio = '',
        college = '',
        course = '',
        year = '',
        business_name = '',
        city = '',
        status = 'inactive',
        account_status = 'DELETED',
        emergency_contact = '{"name": "", "phone": ""}'::jsonb,
        updated_at = NOW()
    WHERE id = current_user_id;

    -- 9. Delete the corresponding Supabase Auth account.
    --
    -- profiles.id is NOT FK-linked to auth.users.id,
    -- so historical public records remain intact.
    DELETE FROM auth.users
    WHERE id = current_user_id;

    RETURN json_build_object(
        'success', true,
        'message', 'Account deleted and anonymized successfully'
    );
END;
$$;

-- Revoke default public execution rights.
REVOKE EXECUTE
ON FUNCTION public.delete_user_account()
FROM PUBLIC;

-- Allow only authenticated Supabase users to execute account deletion.
GRANT EXECUTE
ON FUNCTION public.delete_user_account()
TO authenticated;