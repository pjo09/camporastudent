// =====================================================
// CAMPORA SUPABASE NATIVE CLIENT
// 100% Native PostgREST & Auth Client (No Render / No Pooler URL)
// =====================================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import CONFIG from "./config.js";

const getEnvUrl = () => {
    try {
        if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_URL) {
            return import.meta.env.VITE_SUPABASE_URL;
        }
    } catch (e) {}
    if (typeof window !== "undefined") {
        if (window.__ENV && window.__ENV.VITE_SUPABASE_URL) return window.__ENV.VITE_SUPABASE_URL;
        if (window.VITE_SUPABASE_URL) return window.VITE_SUPABASE_URL;
    }
    return CONFIG.SUPABASE_URL;
};

const getEnvKey = () => {
    try {
        if (typeof import.meta !== "undefined" && import.meta.env && import.meta.env.VITE_SUPABASE_ANON_KEY) {
            return import.meta.env.VITE_SUPABASE_ANON_KEY;
        }
    } catch (e) {}
    if (typeof window !== "undefined") {
        if (window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) return window.__ENV.VITE_SUPABASE_ANON_KEY;
        if (window.VITE_SUPABASE_ANON_KEY) return window.VITE_SUPABASE_ANON_KEY;
    }
    return CONFIG.SUPABASE_ANON_KEY;
};

// Always resolve to official project URL: https://wsldciqtznqjnmltgxpm.supabase.co
const rawUrl = getEnvUrl();
const supabaseUrl = (rawUrl && (rawUrl.includes("pooler.supabase.com") || rawUrl.includes("campora.supabase.co")))
    ? "https://wsldciqtznqjnmltgxpm.supabase.co"
    : (rawUrl || "https://wsldciqtznqjnmltgxpm.supabase.co");

const supabaseAnonKey = getEnvKey() || CONFIG.SUPABASE_ANON_KEY;

const anonKeyPresent = Boolean(supabaseAnonKey && supabaseAnonKey !== "missing_key" && supabaseAnonKey !== "");
const anonKeyLength = supabaseAnonKey ? supabaseAnonKey.length : 0;

console.log("⚡ Supabase Client Config:", {
    url: supabaseUrl,
    anonKeyPresent: anonKeyPresent,
    anonKeyLength: anonKeyLength
});

if (!supabaseUrl) {
    console.error("❌ Supabase URL configuration is missing.");
} else if (!anonKeyPresent) {
    console.warn("⚠️ Supabase Client initialized in public/anonymous mode. Set VITE_SUPABASE_ANON_KEY in Vercel settings for direct authenticated Supabase APIs.");
} else {
    console.log("⚡ Supabase Native Client initialized. URL:", supabaseUrl);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || "missing_key", {
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

if (typeof window !== "undefined") {
    window.supabase = supabase;
}
