// =====================================================
// CAMPORA SUPABASE NATIVE CLIENT ABSTRACTION
// Production-safe, zero-secret public client
// =====================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://aws-0-ap-south-1.pooler.supabase.com"; // Public Supabase project URL
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbXBvcmEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder_public_anon_key";

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
    }
});

// Feature flag for gradual parallel cutover (Defaults to native Supabase, set USE_SUPABASE_NATIVE=false in localStorage for instant Render rollback)
export const USE_SUPABASE_NATIVE = (window.localStorage.getItem("USE_SUPABASE_NATIVE") !== "false");

console.log("[SupabaseClient] Initialized native client. Feature flag USE_SUPABASE_NATIVE =", USE_SUPABASE_NATIVE);
