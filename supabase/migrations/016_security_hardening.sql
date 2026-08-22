-- =====================================================
-- CAMPORA 016: SECURITY HARDENING TRIGGERS & CONSTRAINTS
-- =====================================================

-- 1. PREVENT PROFILE ROLE ESCALATION
CREATE OR REPLACE FUNCTION public.prevent_profile_role_escalation()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent non-admins from changing their role
    IF (OLD.role IS DISTINCT FROM NEW.role) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can modify user roles';
    END IF;

    -- Prevent non-admins from self-activating account_status if banned or pending
    IF (OLD.account_status IS DISTINCT FROM NEW.account_status) AND (OLD.account_status IN ('BANNED', 'DELETED', 'PENDING')) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Account status modification restricted';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_profile_role_escalation ON profiles;
CREATE TRIGGER trg_prevent_profile_role_escalation
    BEFORE UPDATE ON profiles
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_profile_role_escalation();

-- 2. PREVENT UNAUTHORIZED PROPERTY MODIFICATIONS
CREATE OR REPLACE FUNCTION public.prevent_property_unauthorized_fields()
RETURNS TRIGGER AS $$
BEGIN
    -- Prevent changing owner_id
    IF (OLD.owner_id IS DISTINCT FROM NEW.owner_id) AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Property owner_id cannot be transferred';
    END IF;

    -- Prevent self-approval of properties by non-admins
    IF (OLD.status <> 'approved' AND NEW.status = 'approved') AND NOT public.is_admin() THEN
        RAISE EXCEPTION 'Unauthorized: Only administrators can approve properties';
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_prevent_property_unauthorized_fields ON properties;
CREATE TRIGGER trg_prevent_property_unauthorized_fields
    BEFORE UPDATE ON properties
    FOR EACH ROW
    EXECUTE FUNCTION public.prevent_property_unauthorized_fields();
