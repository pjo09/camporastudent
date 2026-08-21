// =====================================================
// CAMPORA SUPABASE NATIVE CLIENT
// 100% Native PostgREST & Auth Client (No Render Dependency)
// =====================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import CONFIG from "./config.js";

const getEnvUrl = () => {
    if (typeof window !== "undefined") {
        if (window.__ENV && window.__ENV.VITE_SUPABASE_URL) return window.__ENV.VITE_SUPABASE_URL;
        if (window.VITE_SUPABASE_URL) return window.VITE_SUPABASE_URL;
    }
    return CONFIG.SUPABASE_URL;
};

const getEnvKey = () => {
    if (typeof window !== "undefined") {
        if (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) return window.__ENV.VITE_SUPABASE_ANON_KEY;
        if (window.VITE_SUPABASE_ANON_KEY) return window.VITE_SUPABASE_ANON_KEY;
    }
    return CONFIG.SUPABASE_ANON_KEY;
};

const supabaseUrl = getEnvUrl();
const supabaseAnonKey = getEnvKey();

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true,
        storageKey: "campora_supabase_auth"
    },
    global: {
        headers: {
            "x-client-info": "campora-student-web"
        }
    }
});

console.log("⚡ Supabase Native Client initialized. URL:", supabaseUrl);
