// =====================================================
// CAMPORA FRONTEND CONFIGURATION
// =====================================================

const CONFIG = {
    // Development
    API_BASE: "http://localhost:5000/api",

    // Production
    // API_BASE: "https://api.campora.in/api",

    REQUEST_TIMEOUT: 15000,
    UPLOAD_TIMEOUT: 60000,

    DEFAULT_PAGE_SIZE: 12,

    ENABLE_ANALYTICS: true,
    ENABLE_NOTIFICATIONS: true,
    ENABLE_REALTIME_CHAT: false,
    ENABLE_PWA: false,

    TOKEN_KEY: "camporaToken"
};

if (typeof window !== "undefined") {
    window.__CONFIG = CONFIG;
    window.__API = CONFIG.API_BASE;
}

const API = CONFIG.API_BASE;

export default CONFIG;
export { API };