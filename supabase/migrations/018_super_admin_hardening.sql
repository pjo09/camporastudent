-- =====================================================
-- CAMPORA 017: SUPER ADMIN HARDENING & SCOPE RLS
-- Explicitly restricts Super Admin privilege to camporaforstudents@gmail.com
-- =====================================================

-- 1. SUPER ADMIN IDENTITY CHECK FUNCTION
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.profiles
    WHERE id = auth.uid()
      AND role = 'admin'
      AND (account_status = 'ACTIVE' OR account_status IS NULL)
      AND LOWER(TRIM(email)) = 'camporaforstudents@gmail.com'
  );
$$;

-- Grant execution permission to authenticated users only
REVOKE EXECUTE ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- 2. HARDENED ROLE ESCALATION TRIGGER (ONLY SUPER ADMIN CAN GRANT/MODIFY ADMIN ROLE)
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent non-super-admins from granting or modifying admin roles
    IF (OLD.role IS DISTINCT FROM NEW.role) THEN
        IF (NEW.role = 'admin' OR OLD.role = 'admin') AND NOT public.is_super_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only the Super Admin (camporaforstudents@gmail.com) can manage admin roles';
        END IF;
        IF NOT public.is_admin() THEN
            RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles';
        END IF;
    END IF;

    -- Prevent non-admins from self-activating account_status if banned or pending
    IF (OLD.account_status IS DISTINCT FROM NEW.account_status) AND (OLD.account_status IN ('BANNED', 'DELETED', 'PENDING')) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Account status modification restricted';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp;

-- 3. HARDEN ADMIN SCOPES RLS POLICIES
ALTER TABLE admin_scopes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins read assigned scopes" ON admin_scopes;
DROP POLICY IF EXISTS "Super admins manage admin scopes" ON admin_scopes;

CREATE POLICY "Admins read assigned scopes" ON admin_scopes
    FOR SELECT USING (public.is_admin());

CREATE POLICY "Super admins insert admin scopes" ON admin_scopes
    FOR INSERT WITH CHECK (public.is_super_admin());

CREATE POLICY "Super admins update admin scopes" ON admin_scopes
    FOR UPDATE USING (public.is_super_admin());

CREATE POLICY "Super admins delete admin scopes" ON admin_scopes
    FOR DELETE USING (public.is_super_admin());
