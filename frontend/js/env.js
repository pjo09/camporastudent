// =====================================================
// CAMPORA RUNTIME ENVIRONMENT LOADER
// Reads environment configuration supplied by deployment environment
// =====================================================

(function () {
    if (typeof window === "undefined") return;

    window.__ENV = window.__ENV || {};

    // Read window-level environment overrides injected during deployment
    if (window.VITE_SUPABASE_URL) window.__ENV.VITE_SUPABASE_URL = window.VITE_SUPABASE_URL;
    if (window.VITE_SUPABASE_ANON_KEY) window.__ENV.VITE_SUPABASE_ANON_KEY = window.VITE_SUPABASE_ANON_KEY;
    if (window.VITE_USE_SUPABASE_NATIVE !== undefined) window.__ENV.VITE_USE_SUPABASE_NATIVE = window.VITE_USE_SUPABASE_NATIVE;
    if (window.VITE_APP_URL) window.__ENV.VITE_APP_URL = window.VITE_APP_URL;
})();
