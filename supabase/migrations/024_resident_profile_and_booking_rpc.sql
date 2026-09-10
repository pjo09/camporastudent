-- ======================================================
-- MIGRATION 024: RESIDENT PROFILE EXTENSIONS & BOOKING RPCs
-- CAMPORA Supabase PostgreSQL Schema
-- ======================================================

-- 1. ADD RESIDENT PROFILE COLUMNS TO PROFILES TABLE
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS dob TIMESTAMPTZ NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS gender VARCHAR DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS branch VARCHAR DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS student_id_number VARCHAR DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_move_in_date TIMESTAMPTZ NULL;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS expected_duration VARCHAR DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS preferred_room_type VARCHAR DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS budget_range VARCHAR DEFAULT '';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS college_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS identity_verified BOOLEAN DEFAULT FALSE;

-- 2. PROFILE COMPLETENESS CALCULATION RPC FUNCTION
CREATE OR REPLACE FUNCTION check_profile_completeness(p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_prof RECORD;
    v_total_fields INT := 9;
    v_completed_fields INT := 0;
    v_missing_fields TEXT[] := '{}';
    v_percentage INT;
    v_is_complete BOOLEAN;
BEGIN
    SELECT * INTO v_prof FROM profiles WHERE id = p_user_id;

    IF NOT FOUND THEN
        RETURN jsonb_build_object(
            'is_complete', false,
            'completion_percentage', 0,
            'missing_fields', jsonb_build_array('profile_not_found')
        );
    END IF;

    -- 1. Name
    IF v_prof.name IS NOT NULL AND TRIM(v_prof.name) <> '' THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'name');
    END IF;

    -- 2. Phone
    IF v_prof.phone IS NOT NULL AND TRIM(v_prof.phone) <> '' THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'phone');
    END IF;

    -- 3. Profile Image / Avatar
    IF (v_prof.profile_image IS NOT NULL AND TRIM(v_prof.profile_image) <> '') OR (v_prof.avatar IS NOT NULL AND TRIM(v_prof.avatar) <> '') THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'profile_image');
    END IF;

    -- 4. College
    IF v_prof.college IS NOT NULL AND TRIM(v_prof.college) <> '' THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'college');
    END IF;

    -- 5. Course
    IF v_prof.course IS NOT NULL AND TRIM(v_prof.course) <> '' THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'course');
    END IF;

    -- 6. Year
    IF v_prof.year IS NOT NULL AND TRIM(v_prof.year) <> '' THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'year');
    END IF;

    -- 7. Gender
    IF v_prof.gender IS NOT NULL AND TRIM(v_prof.gender) <> '' THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'gender');
    END IF;

    -- 8. Emergency Contact Phone
    IF v_prof.emergency_contact IS NOT NULL AND (v_prof.emergency_contact->>'phone') IS NOT NULL AND TRIM(v_prof.emergency_contact->>'phone') <> '' THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'emergency_contact');
    END IF;

    -- 9. DOB or Branch or Stay Prefs
    IF (v_prof.dob IS NOT NULL) OR (v_prof.branch IS NOT NULL AND TRIM(v_prof.branch) <> '') OR (v_prof.preferred_move_in_date IS NOT NULL) THEN
        v_completed_fields := v_completed_fields + 1;
    ELSE
        v_missing_fields := array_append(v_missing_fields, 'stay_preferences');
    END IF;

    v_percentage := LEAST(100, GREATEST(0, ROUND((v_completed_fields::numeric / v_total_fields::numeric) * 100)));
    v_is_complete := (v_completed_fields >= 7); -- Minimum required threshold for complete resident portfolio

    RETURN jsonb_build_object(
        'is_complete', v_is_complete,
        'completion_percentage', v_percentage,
        'completed_count', v_completed_fields,
        'total_required', v_total_fields,
        'missing_fields', to_jsonb(v_missing_fields)
    );
END;
$$;

-- 3. TRANSACTIONAL BOOKING CREATION RPC WITH SERVER-SIDE PROFILE & AVAILABILITY VALIDATION
CREATE OR REPLACE FUNCTION create_booking_request_rpc(
    p_property_id UUID,
    p_check_in TIMESTAMPTZ,
    p_duration VARCHAR DEFAULT '',
    p_special_request TEXT DEFAULT '',
    p_room_type VARCHAR DEFAULT ''
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_owner_id UUID;
    v_beds INT;
    v_status VARCHAR;
    v_published BOOLEAN;
    v_rent NUMERIC;
    v_prop_name VARCHAR;
    v_user_name VARCHAR;
    v_user_email VARCHAR;
    v_completeness JSONB;
    v_is_complete BOOLEAN;
    v_booking_id UUID;
    v_existing_active INT;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated';
    END IF;

    -- Fetch user details
    SELECT name, email INTO v_user_name, v_user_email FROM profiles WHERE id = v_user_id;

    -- Validate profile completeness server-side
    v_completeness := check_profile_completeness(v_user_id);
    v_is_complete := (v_completeness->>'is_complete')::boolean;
    IF NOT v_is_complete THEN
        RAISE EXCEPTION 'Incomplete Resident Profile: Please complete your profile before requesting a booking.';
    END IF;

    -- Lock property FOR UPDATE
    SELECT owner_id, available_beds, status, published, rent, property_name
    INTO v_owner_id, v_beds, v_status, v_published, v_rent, v_prop_name
    FROM properties
    WHERE id = p_property_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    IF v_status <> 'approved' OR NOT v_published THEN
        RAISE EXCEPTION 'Property is not currently bookable';
    END IF;

    IF v_beds <= 0 THEN
        RAISE EXCEPTION 'No beds available for this property';
    END IF;

    -- Prevent active duplicate bookings for same property by same user
    SELECT COUNT(*) INTO v_existing_active
    FROM bookings
    WHERE user_id = v_user_id
      AND property_id = p_property_id
      AND booking_status IN ('pending', 'confirmed', 'checked-in', 'active', 'accepted');

    IF v_existing_active > 0 THEN
        RAISE EXCEPTION 'You already have an active booking request for this property';
    END IF;

    -- Create booking request with pending status
    INSERT INTO bookings (
        user_id,
        user_name,
        user_email,
        property_id,
        property_name,
        owner_id,
        booking_status,
        payment_status,
        check_in,
        duration,
        special_request,
        price,
        special_instructions
    ) VALUES (
        v_user_id,
        COALESCE(v_user_name, ''),
        COALESCE(v_user_email, ''),
        p_property_id,
        COALESCE(v_prop_name, ''),
        v_owner_id,
        'pending',
        'pending',
        p_check_in,
        COALESCE(p_duration, ''),
        COALESCE(p_special_request, ''),
        v_rent,
        COALESCE(p_room_type, '')
    ) RETURNING id INTO v_booking_id;

    -- Create notification for owner
    IF v_owner_id IS NOT NULL THEN
        INSERT INTO notifications (
            receiver_id,
            sender_id,
            title,
            message,
            type
        ) VALUES (
            v_owner_id,
            v_user_id,
            'New Booking Request',
            COALESCE(v_user_name, 'A student') || ' submitted a booking request for ' || COALESCE(v_prop_name, 'your property'),
            'booking'
        );
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', v_booking_id,
        'message', 'Booking request submitted successfully'
    );
END;
$$;

-- 4. OWNER RESPOND TO BOOKING REQUEST RPC (ACCEPT / REJECT)
CREATE OR REPLACE FUNCTION respond_booking_request_rpc(
    p_booking_id UUID,
    p_action VARCHAR,
    p_rejection_reason TEXT DEFAULT ''
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_caller_id UUID;
    v_booking RECORD;
    v_prop RECORD;
BEGIN
    v_caller_id := auth.uid();
    IF v_caller_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not authenticated';
    END IF;

    SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking request not found';
    END IF;

    -- Verify ownership
    IF v_booking.owner_id <> v_caller_id THEN
        RAISE EXCEPTION 'Unauthorized: You do not own this property';
    END IF;

    IF v_booking.booking_status <> 'pending' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Booking request is already processed',
            'status', v_booking.booking_status
        );
    END IF;

    IF UPPER(p_action) = 'ACCEPT' THEN
        -- Check & reserve bed inventory
        SELECT available_beds INTO v_prop FROM properties WHERE id = v_booking.property_id FOR UPDATE;
        IF v_prop.available_beds <= 0 THEN
            RAISE EXCEPTION 'Cannot accept: No available beds remaining';
        END IF;

        -- Decrement bed
        UPDATE properties
        SET available_beds = available_beds - 1,
            updated_at = NOW()
        WHERE id = v_booking.property_id;

        -- Update booking status to accepted / payment pending
        UPDATE bookings
        SET booking_status = 'accepted',
            payment_status = 'pending',
            inventory_reserved = true,
            updated_at = NOW()
        WHERE id = p_booking_id;

        -- Notify student
        INSERT INTO notifications (
            receiver_id,
            sender_id,
            title,
            message,
            type
        ) VALUES (
            v_booking.user_id,
            v_caller_id,
            'Booking Request Accepted',
            'Great news! The property owner accepted your booking request for ' || COALESCE(v_booking.property_name, 'the property') || '. Please complete payment to confirm.',
            'booking'
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'accepted',
            'message', 'Booking request accepted. Student notified for payment.'
        );

    ELSIF UPPER(p_action) = 'REJECT' THEN
        UPDATE bookings
        SET booking_status = 'rejected',
            cancel_reason = COALESCE(p_rejection_reason, 'Request declined by property owner'),
            updated_at = NOW()
        WHERE id = p_booking_id;

        -- Notify student
        INSERT INTO notifications (
            receiver_id,
            sender_id,
            title,
            message,
            type
        ) VALUES (
            v_booking.user_id,
            v_caller_id,
            'Booking Request Declined',
            'Your booking request for ' || COALESCE(v_booking.property_name, 'the property') || ' was declined by the owner. Reason: ' || COALESCE(p_rejection_reason, 'No reason specified'),
            'booking'
        );

        RETURN jsonb_build_object(
            'success', true,
            'status', 'rejected',
            'message', 'Booking request declined.'
        );
    ELSE
        RAISE EXCEPTION 'Invalid action. Must be ACCEPT or REJECT';
    END IF;
END;
$$;
