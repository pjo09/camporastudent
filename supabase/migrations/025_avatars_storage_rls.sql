-- ======================================================
-- MIGRATION 025: SUPABASE STORAGE RLS POLICIES FOR AVATARS
-- CAMPORA Supabase Storage Security Hardening for Profile Photos
-- ======================================================

-- Drop existing policies if any
DROP POLICY IF EXISTS "Public select avatar storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users insert avatar storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Users update own avatar storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Users delete own avatar storage objects" ON storage.objects;

-- 1. SELECT Policy: Public read access to avatars bucket
CREATE POLICY "Public select avatar storage objects"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'avatars');

-- 2. INSERT Policy: Authenticated users can upload to avatars bucket
CREATE POLICY "Authenticated users insert avatar storage objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'avatars');

-- 3. UPDATE Policy: Allow users to update their own avatar objects
CREATE POLICY "Users update own avatar storage objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND owner_id = (select auth.uid()::text)
)
WITH CHECK (
    bucket_id = 'avatars' 
    AND owner_id = (select auth.uid()::text)
);

-- 4. DELETE Policy: Allow users to delete their own avatar objects
CREATE POLICY "Users delete own avatar storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'avatars' 
    AND owner_id = (select auth.uid()::text)
);
