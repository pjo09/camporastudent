-- =====================================================
-- CAMPORA 014: SUPABASE NATIVE RLS POLICIES & TRANSACTIONAL RPCs
-- =====================================================

-- 1. PROFILES SECURITY
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles select" ON profiles
    FOR SELECT USING (true);

CREATE POLICY "Users update own profile" ON profiles
    FOR UPDATE USING (auth.uid() = id);

-- 2. PROPERTIES SECURITY
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read active approved properties" ON properties
    FOR SELECT USING (published = true AND status = 'approved');

CREATE POLICY "Owners read own properties" ON properties
    FOR SELECT USING (auth.uid() = owner_id);

CREATE POLICY "Owners insert own properties" ON properties
    FOR INSERT WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Owners update own properties" ON properties
    FOR UPDATE USING (auth.uid() = owner_id);

CREATE POLICY "Owners delete own properties" ON properties
    FOR DELETE USING (auth.uid() = owner_id);

-- 3. BOOKINGS SECURITY
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students read own bookings" ON bookings
    FOR SELECT USING (auth.uid() = student_id);

CREATE POLICY "Owners read property bookings" ON bookings
    FOR SELECT USING (auth.uid() = owner_id);

-- 4. SAVED & RECENT PROPERTIES
ALTER TABLE saved_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own saved properties" ON saved_properties
    FOR ALL USING (auth.uid() = user_id);

ALTER TABLE recent_properties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students manage own recent properties" ON recent_properties
    FOR ALL USING (auth.uid() = user_id);

-- 5. REVIEWS SECURITY
ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read approved reviews" ON reviews
    FOR SELECT USING (is_approved = true);

CREATE POLICY "Students insert own review" ON reviews
    FOR INSERT WITH CHECK (auth.uid() = student_id);

-- 6. MESSAGING SECURITY
ALTER TABLE message_conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read conversations" ON message_conversations
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = owner_id);

CREATE POLICY "Students start conversation" ON message_conversations
    FOR INSERT WITH CHECK (auth.uid() = student_id);

ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants read messages" ON messages
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM message_conversations mc
            WHERE mc.id = conversation_id
            AND (mc.student_id = auth.uid() OR mc.owner_id = auth.uid())
        )
    );

CREATE POLICY "Participants send message" ON messages
    FOR INSERT WITH CHECK (auth.uid() = sender_id);

-- 7. NOTIFICATIONS SECURITY
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own notifications" ON notifications
    FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users update own notifications" ON notifications
    FOR UPDATE USING (auth.uid() = user_id);

-- 8. TENANCIES & RESIDENTS
ALTER TABLE tenancies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents read own tenancy" ON tenancies
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = owner_id);

ALTER TABLE resident_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Residents manage requests" ON resident_requests
    FOR ALL USING (auth.uid() = student_id OR auth.uid() = owner_id);

-- 9. MAINTENANCE & ANNOUNCEMENTS
ALTER TABLE maintenances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read property maintenance" ON maintenances
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = owner_id);

ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read announcements" ON announcements
    FOR SELECT USING (true);

-- 10. INVOICES & OTPS
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own invoices" ON invoices
    FOR SELECT USING (auth.uid() = student_id OR auth.uid() = owner_id);

ALTER TABLE otps ENABLE ROW LEVEL SECURITY;

CREATE POLICY "No direct client access to otps" ON otps
    FOR ALL USING (false);

-- 11. ADMIN SCOPES SECURITY
ALTER TABLE admin_scopes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read assigned scopes" ON admin_scopes
    FOR SELECT USING (auth.uid() = user_id);

-- =====================================================
-- TRANSACTIONAL BOOKING RPC FUNCTIONS
-- =====================================================

CREATE OR REPLACE FUNCTION create_booking_transaction(
    p_property_id UUID,
    p_check_in TIMESTAMPTZ,
    p_price NUMERIC
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_owner_id UUID;
    v_beds INT;
    v_status VARCHAR;
    v_published BOOLEAN;
    v_booking_id UUID;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not logged in';
    END IF;

    -- Row locking FOR UPDATE
    SELECT owner_id, available_beds, status, published
    INTO v_owner_id, v_beds, v_status, v_published
    FROM properties
    WHERE id = p_property_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Property not found';
    END IF;

    IF v_status <> 'approved' OR NOT v_published THEN
        RAISE EXCEPTION 'Property is not available for booking';
    END IF;

    IF v_beds <= 0 THEN
        RAISE EXCEPTION 'No available beds left for this property';
    END IF;

    -- Decrement bed inventory
    UPDATE properties
    SET available_beds = available_beds - 1,
        updated_at = NOW()
    WHERE id = p_property_id;

    -- Create booking
    INSERT INTO bookings (
        user_id, property_id, owner_id, booking_status, check_in, price
    ) VALUES (
        v_user_id, p_property_id, v_owner_id, 'pending', p_check_in, p_price
    ) RETURNING id INTO v_booking_id;

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', v_booking_id,
        'message', 'Booking created successfully'
    );
END;
$$;

CREATE OR REPLACE FUNCTION update_booking_status_transaction(
    p_booking_id UUID,
    p_new_status VARCHAR
) RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_user_id UUID;
    v_property_id UUID;
    v_old_status VARCHAR;
BEGIN
    v_user_id := auth.uid();
    IF v_user_id IS NULL THEN
        RAISE EXCEPTION 'Unauthorized: User not logged in';
    END IF;

    SELECT property_id, booking_status INTO v_property_id, v_old_status
    FROM bookings
    WHERE id = p_booking_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Booking not found';
    END IF;

    -- Update booking status
    UPDATE bookings
    SET booking_status = p_new_status,
        updated_at = NOW()
    WHERE id = p_booking_id;

    -- Restore inventory if cancelled or rejected
    IF (v_old_status <> 'cancelled' AND v_old_status <> 'rejected') AND (p_new_status = 'cancelled' OR p_new_status = 'rejected') THEN
        UPDATE properties
        SET available_beds = available_beds + 1,
            updated_at = NOW()
        WHERE id = v_property_id;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'bookingId', p_booking_id,
        'newStatus', p_new_status
    );
END;
$$;
