// =====================================================
// CAMPORA RUNTIME ENVIRONMENT LOADER
// Supports Vercel production build-time variables, window overrides,
// and localStorage runtime injection for key rotation & testing.
// =====================================================

(function () {
    if (typeof window === "undefined") return;

    window.__ENV = window.__ENV || {};

    // Read window-level overrides if set by Vercel server-side injection
    if (window.VITE_SUPABASE_URL) window.__ENV.VITE_SUPABASE_URL = window.VITE_SUPABASE_URL;
    if (window.VITE_SUPABASE_ANON_KEY) window.__ENV.VITE_SUPABASE_ANON_KEY = window.VITE_SUPABASE_ANON_KEY;

    // Read localStorage overrides if configured by developer/operator
    try {
        const localUrl = window.localStorage.getItem("VITE_SUPABASE_URL");
        const localKey = window.localStorage.getItem("VITE_SUPABASE_ANON_KEY");
        if (localUrl) window.__ENV.VITE_SUPABASE_URL = localUrl;
        if (localKey) window.__ENV.VITE_SUPABASE_ANON_KEY = localKey;
    } catch (e) {
        // localStorage disabled or restricted
    }
})();
