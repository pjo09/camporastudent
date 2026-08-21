// =====================================================
// CAMPORA SUPABASE NATIVE CLIENT
// 100% Native PostgREST & Auth Client (No Render / No Pooler URL)
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
        try {
            const localKey = window.localStorage ? window.localStorage.getItem("VITE_SUPABASE_ANON_KEY") : null;
            if (localKey) return localKey;
        } catch (e) {}
    }
    return CONFIG.SUPABASE_ANON_KEY;
};

// Always resolve to official project URL: https://wsldciqtznqjnmltgxpm.supabase.co
const rawUrl = getEnvUrl();
const supabaseUrl = (rawUrl.includes("pooler.supabase.com") || rawUrl.includes("campora.supabase.co"))
    ? "https://wsldciqtznqjnmltgxpm.supabase.co"
    : rawUrl;
const supabaseAnonKey = getEnvKey();

if (!supabaseAnonKey || supabaseAnonKey.includes("placeholder_public_anon_key")) {
    console.warn("⚠️ VITE_SUPABASE_ANON_KEY missing or placeholder. Set VITE_SUPABASE_ANON_KEY in Vercel Environment Variables or run: localStorage.setItem('VITE_SUPABASE_ANON_KEY', '<your-real-anon-key>') in browser console.");
}

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
