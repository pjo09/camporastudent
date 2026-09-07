-- Migration 023: Safe Transactional Legacy Profile Relinking & Alignment RPC
-- Resolves production legacy-profile ID mismatch where auth.users.id != profiles.id for existing email.

CREATE OR REPLACE FUNCTION public.relink_legacy_profile_by_email(
    p_email TEXT,
    p_target_auth_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
    v_caller_id UUID;
    v_is_admin BOOLEAN := FALSE;
    v_auth_email TEXT;
    v_legacy_id UUID;
    v_existing_target_id UUID;
    v_name VARCHAR;
    v_role VARCHAR;
    v_account_status VARCHAR;
    v_phone VARCHAR;
    v_business_name VARCHAR;
    v_avatar TEXT;
    v_created_at TIMESTAMPTZ;
BEGIN
    v_caller_id := auth.uid();

    IF p_email IS NULL OR TRIM(p_email) = '' OR p_target_auth_id IS NULL THEN
        RAISE EXCEPTION 'Invalid parameters: email and target_auth_id are required';
    END IF;

    -- Security check 1: Caller must be authenticated
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: caller must be authenticated';
    END IF;

    -- Security check 2: Check if caller is admin
    SELECT EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = v_caller_id AND LOWER(role) = 'admin'
    ) INTO v_is_admin;

    -- Security check 3: auth.uid() must match p_target_auth_id UNLESS caller is admin
    IF v_caller_id != p_target_auth_id AND NOT v_is_admin THEN
        RAISE EXCEPTION 'Unauthorized: caller (%) cannot relink profile for target user (%)', v_caller_id, p_target_auth_id;
    END IF;

    -- Security check 4: Verify target auth user exists in auth.users and email matches p_email
    SELECT email INTO v_auth_email
    FROM auth.users
    WHERE id = p_target_auth_id;

    IF v_auth_email IS NULL THEN
        RAISE EXCEPTION 'Target auth user % does not exist in auth.users', p_target_auth_id;
    END IF;

    IF LOWER(v_auth_email) != LOWER(TRIM(p_email)) THEN
        RAISE EXCEPTION 'Target auth user email (%) does not match specified email (%)', v_auth_email, p_email;
    END IF;

    -- 1. Check if target_auth_id profile is already aligned in public.profiles
    SELECT id INTO v_existing_target_id
    FROM public.profiles
    WHERE id = p_target_auth_id;

    IF v_existing_target_id IS NOT NULL THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Profile already aligned to target Auth ID',
            'profile_id', p_target_auth_id
        );
    END IF;

    -- 2. Find legacy profile row matching email
    SELECT id, name, role, account_status, phone, business_name, avatar, created_at
    INTO v_legacy_id, v_name, v_role, v_account_status, v_phone, v_business_name, v_avatar, v_created_at
    FROM public.profiles
    WHERE LOWER(email) = LOWER(TRIM(p_email))
    LIMIT 1;

    IF v_legacy_id IS NULL THEN
        RETURN jsonb_build_object(
            'success', false,
            'message', 'No profile found matching specified email'
        );
    END IF;

    IF v_legacy_id = p_target_auth_id THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Profile already aligned',
            'profile_id', p_target_auth_id
        );
    END IF;

    -- 3. Temporarily update legacy email to release the UNIQUE constraint on email
    UPDATE public.profiles
    SET email = 'relinking_' || v_legacy_id || '_' || TRIM(p_email)
    WHERE id = v_legacy_id;

    -- 4. Create new profile row aligned with Auth ID, preserving role and account status
    INSERT INTO public.profiles (
        id,
        email,
        name,
        role,
        account_status,
        phone,
        business_name,
        avatar,
        created_at,
        updated_at
    ) VALUES (
        p_target_auth_id,
        LOWER(TRIM(p_email)),
        COALESCE(v_name, 'User'),
        COALESCE(v_role, 'student'),
        COALESCE(v_account_status, 'ACTIVE'),
        v_phone,
        v_business_name,
        v_avatar,
        COALESCE(v_created_at, NOW()),
        NOW()
    );

    -- 5. Update all 25 dependent foreign keys in historical & active relational tables
    UPDATE public.properties SET owner_id = p_target_auth_id WHERE owner_id = v_legacy_id;
    UPDATE public.bookings SET user_id = p_target_auth_id WHERE user_id = v_legacy_id;
    UPDATE public.bookings SET owner_id = p_target_auth_id WHERE owner_id = v_legacy_id;
    UPDATE public.saved_properties SET user_id = p_target_auth_id WHERE user_id = v_legacy_id;
    UPDATE public.recently_viewed SET user_id = p_target_auth_id WHERE user_id = v_legacy_id;
    UPDATE public.reviews SET user_id = p_target_auth_id WHERE user_id = v_legacy_id;
    UPDATE public.conversations SET owner_id = p_target_auth_id WHERE owner_id = v_legacy_id;
    UPDATE public.conversations SET student_id = p_target_auth_id WHERE student_id = v_legacy_id;
    UPDATE public.messages SET sender_id = p_target_auth_id WHERE sender_id = v_legacy_id;
    UPDATE public.chat_read_receipts SET user_id = p_target_auth_id WHERE user_id = v_legacy_id;
    UPDATE public.tenancies SET student_id = p_target_auth_id WHERE student_id = v_legacy_id;
    UPDATE public.tenancies SET verified_by = p_target_auth_id WHERE verified_by = v_legacy_id;
    UPDATE public.resident_requests SET student_id = p_target_auth_id WHERE student_id = v_legacy_id;
    UPDATE public.resident_requests SET reviewed_by = p_target_auth_id WHERE reviewed_by = v_legacy_id;
    UPDATE public.notifications SET receiver_id = p_target_auth_id WHERE receiver_id = v_legacy_id;
    UPDATE public.maintenance_requests SET owner_id = p_target_auth_id WHERE owner_id = v_legacy_id;
    UPDATE public.maintenance_requests SET student_id = p_target_auth_id WHERE student_id = v_legacy_id;
    UPDATE public.announcements SET author_id = p_target_auth_id WHERE author_id = v_legacy_id;
    UPDATE public.announcements SET owner_id = p_target_auth_id WHERE owner_id = v_legacy_id;
    UPDATE public.owner_tenant_links SET student_id = p_target_auth_id WHERE student_id = v_legacy_id;
    UPDATE public.invoices SET owner_id = p_target_auth_id WHERE owner_id = v_legacy_id;
    UPDATE public.invoices SET student_id = p_target_auth_id WHERE student_id = v_legacy_id;
    UPDATE public.system_audit_logs SET user_id = p_target_auth_id WHERE user_id = v_legacy_id;
    UPDATE public.admin_scopes SET admin_user_id = p_target_auth_id WHERE admin_user_id = v_legacy_id;

    -- 6. Delete orphaned legacy profile row
    DELETE FROM public.profiles WHERE id = v_legacy_id;

    RETURN jsonb_build_object(
        'success', true,
        'message', 'Legacy profile successfully aligned to Auth ID',
        'legacy_id', v_legacy_id,
        'new_id', p_target_auth_id
    );
END;
$$;

-- Restrict execution permissions
REVOKE EXECUTE ON FUNCTION public.relink_legacy_profile_by_email(TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.relink_legacy_profile_by_email(TEXT, UUID) TO authenticated, service_role;

