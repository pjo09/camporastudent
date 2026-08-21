// =====================================================
// CAMPORA FRONTEND CONFIGURATION — 100% SUPABASE NATIVE
// =====================================================

const CONFIG = {
    SUPABASE_URL: (typeof window !== "undefined" && window.__ENV && window.__ENV.VITE_SUPABASE_URL) || "https://aws-0-ap-south-1.pooler.supabase.com",
    SUPABASE_ANON_KEY: (typeof window !== "undefined" && window.__ENV && window.__ENV.VITE_SUPABASE_ANON_KEY) || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNhbXBvcmEiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDAwMDAwMCwiZXhwIjoyMDAwMDAwMDAwfQ.placeholder_public_anon_key",

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
}

export default CONFIG;