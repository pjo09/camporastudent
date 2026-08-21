// =====================================================
// CAMPORA FRONTEND CONFIGURATION — 100% SUPABASE NATIVE
// =====================================================

const getEnv = (key) => {
    if (typeof window !== "undefined") {
        if (window.__ENV && window.__ENV[key]) return window.__ENV[key];
        if (window[key]) return window[key];
        try {
            const localVal = window.localStorage ? window.localStorage.getItem(key) : null;
            if (localVal) return localVal;
        } catch (e) {}
    }
    return undefined;
};

// Official Supabase Project API Gateway URL (wsldciqtznqjnmltgxpm)
export const SUPABASE_URL = getEnv("VITE_SUPABASE_URL") || "https://wsldciqtznqjnmltgxpm.supabase.co";
export const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY") || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndzbGRjaXF0em5xam5tbHRneHBtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MDAwMDAwMDAsImV4cCI6MjAwMDAwMDAwMH0.placeholder_public_anon_key";
export const API = SUPABASE_URL + "/rest/v1";
export const USE_SUPABASE_NATIVE = true;
export const APP_URL = getEnv("VITE_APP_URL") || (typeof window !== "undefined" ? window.location.origin : "https://camporastudent.vercel.app");
export const APP_NAME = "Campora";

const CONFIG = {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    API,
    USE_SUPABASE_NATIVE,
    APP_URL,
    APP_NAME,
    REQUEST_TIMEOUT: 15000,
    UPLOAD_TIMEOUT: 60000,
    DEFAULT_PAGE_SIZE: 12,
    ENABLE_ANALYTICS: true,
    ENABLE_NOTIFICATIONS: true,
    ENABLE_REALTIME_CHAT: false,
    TOKEN_KEY: "camporaToken"
};

if (typeof window !== "undefined") {
    window.__CONFIG = CONFIG;
    window.__API = API;
}

export default CONFIG;