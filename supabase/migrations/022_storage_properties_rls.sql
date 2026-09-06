-- ======================================================
-- MIGRATION 022: SUPABASE STORAGE RLS POLICIES FOR PROPERTIES
-- CAMPORA Supabase Storage Security Hardening
-- Minimum required SELECT, INSERT, UPDATE, and DELETE policies.
-- Uses owner_id = (select auth.uid()::text) exclusively.
-- RLS is enabled on storage.objects by default in Supabase.
-- ======================================================

-- Drop existing policies if any (idempotent migration)
DROP POLICY IF EXISTS "Authenticated users select property storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users insert property storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners update own property storage objects" ON storage.objects;
DROP POLICY IF EXISTS "Owners delete own property storage objects" ON storage.objects;

-- 1. SELECT Policy: Required for upsert: true metadata check during upload
CREATE POLICY "Authenticated users select property storage objects"
ON storage.objects FOR SELECT
TO authenticated
USING (bucket_id = 'properties');

-- 2. INSERT Policy: Allow authenticated users to upload property images to 'properties' bucket
CREATE POLICY "Authenticated users insert property storage objects"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'properties');

-- 3. UPDATE Policy: Allow property owners to update their own objects in 'properties' bucket
CREATE POLICY "Owners update own property storage objects"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'properties' 
    AND owner_id = (select auth.uid()::text)
)
WITH CHECK (
    bucket_id = 'properties' 
    AND owner_id = (select auth.uid()::text)
);

-- 4. DELETE Policy: Allow property owners to delete their own objects in 'properties' bucket
CREATE POLICY "Owners delete own property storage objects"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'properties' 
    AND owner_id = (select auth.uid()::text)
);
