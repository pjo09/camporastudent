-- =====================================================
-- CAMPORA 015: ADMIN NATIVE RLS & SECURITY DEFINER HELPERS
-- =====================================================

-- 1. SECURITY DEFINER HELPER FUNCTION FOR NON-RECURSIVE ADMIN CHECK
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND (account_status = 'ACTIVE' OR account_status IS NULL)
  );
$$;

-- 2. ADMIN RLS POLICIES FOR PROFILES
CREATE POLICY "Admins select all profiles" ON profiles
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update all profiles" ON profiles
    FOR UPDATE USING (public.is_admin());

-- 3. ADMIN RLS POLICIES FOR PROPERTIES
CREATE POLICY "Admins select all properties" ON properties
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update all properties" ON properties
    FOR UPDATE USING (public.is_admin());

-- 4. ADMIN RLS POLICIES FOR BOOKINGS
CREATE POLICY "Admins select all bookings" ON bookings
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update all bookings" ON bookings
    FOR UPDATE USING (public.is_admin());

-- 5. ADMIN RLS POLICIES FOR REVIEWS
CREATE POLICY "Admins select all reviews" ON reviews
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Admins update all reviews" ON reviews
    FOR UPDATE USING (public.is_admin());

CREATE POLICY "Admins delete all reviews" ON reviews
    FOR DELETE USING (public.is_admin());
