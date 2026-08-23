-- =====================================================
-- CAMPORA 019: PROFILE INSERT RLS POLICY
-- Allows authenticated users to insert exclusively their own profile record.
-- =====================================================

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies
        WHERE tablename = 'profiles'
        AND policyname = 'Users insert own profile'
    ) THEN
        CREATE POLICY "Users insert own profile" ON public.profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
    END IF;
END $$;
