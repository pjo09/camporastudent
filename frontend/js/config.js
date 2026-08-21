// =====================================================
// CAMPORA FRONTEND CONFIGURATION — 100% SUPABASE NATIVE
// =====================================================

const getEnv = (key) => {
    if (typeof window !== "undefined") {
        if (window.__ENV && window.__ENV[key]) return window.__ENV[key];
        if (window[key]) return window[key];
    }
    return undefined;
};

// Official Supabase Project API Gateway URL (wsldciqtznqjnmltgxpm)
export const SUPABASE_URL = getEnv("VITE_SUPABASE_URL") || "https://wsldciqtznqjnmltgxpm.supabase.co";
export const SUPABASE_ANON_KEY = getEnv("VITE_SUPABASE_ANON_KEY") || "";
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