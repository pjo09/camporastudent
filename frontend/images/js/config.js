// =====================================================
// CAMPORA FRONTEND CONFIGURATION
// =====================================================

const isProduction =
    window.location.hostname !== "localhost" &&
    window.location.hostname !== "127.0.0.1";

const CONFIG = {
    API_BASE: isProduction
        ? "https://camporastudent.onrender.com/api"
        : "http://localhost:5000/api",

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