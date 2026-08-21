// =====================================================
// CAMPORA SUPABASE NATIVE CLIENT ABSTRACTION
// Production-safe, zero-secret public client
// =====================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const supabaseUrl = (typeof window !== "undefined" && window.__ENV && window.__ENV.VITE_SUPABASE_URL) || "https://aws-0-ap-south-1.pooler.supabase.com";
const supabaseAnonKey = (typeof window !== "undefined" && window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbXBvcmEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder_public_anon_key";

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
    }
});

// Feature flag for gradual parallel cutover (Defaults to native Supabase, set USE_SUPABASE_NATIVE=false in localStorage for instant Render rollback)
export const USE_SUPABASE_NATIVE = (typeof window !== "undefined" && window.localStorage.getItem("USE_SUPABASE_NATIVE") !== "false");

console.log("[SupabaseClient] Initialized native client. Feature flag USE_SUPABASE_NATIVE =", USE_SUPABASE_NATIVE);
