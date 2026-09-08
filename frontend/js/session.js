import { supabase } from "./supabaseClient.js";

const TOKEN_KEY = "camporaToken";
const USER_KEY = "camporaUser";
const ROLE_KEY = "camporaRole";
const REMEMBER_KEY = "camporaRemember";

// ===========================================
// DYNAMIC LANDING URL FOR NESTED PAGES / ENVIRONMENT
// ===========================================
export function getLandingUrl() {
    if (typeof window === "undefined") return "/index.html";
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/pages/student/") ||
        path.includes("/pages/owner/") ||
        path.includes("/pages/admin/") ||
        path.includes("/pages/property/")) {
        return "../../index.html";
    }
    return "index.html";
}

// ===========================================
// DYNAMIC LOGIN URL FOR NESTED PAGES
// ===========================================
export function getLoginUrl() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/pages/student/") || 
        path.includes("/pages/owner/") || 
        path.includes("/pages/admin/") || 
        path.includes("/pages/property/")) {
        return "../../login.html";
    }
    return "login.html";
}

// ===========================================
// DYNAMIC PROPERTIES URL FOR NESTED PAGES
// ===========================================
export function getPropertiesUrl() {
    const path = window.location.pathname.toLowerCase();
    if (path.includes("/pages/student/") || 
        path.includes("/pages/owner/") || 
        path.includes("/pages/admin/") || 
        path.includes("/pages/property/")) {
        return "../../properties.html";
    }
    return "properties.html";
}

// ===========================================
// STORAGE HELPERS
// ===========================================

function getStorage() {
    return localStorage.getItem(REMEMBER_KEY) === "true"
        ? localStorage
        : sessionStorage;
}

function migrateToSession() {
    // Migrate from localStorage to sessionStorage if remember-me is off
    const token = localStorage.getItem(TOKEN_KEY);
    const user = localStorage.getItem(USER_KEY);
    const role = localStorage.getItem(ROLE_KEY);
    const remember = localStorage.getItem(REMEMBER_KEY);

    if (token && remember !== "true") {
        sessionStorage.setItem(TOKEN_KEY, token);
        sessionStorage.setItem(USER_KEY, user || "");
        sessionStorage.setItem(ROLE_KEY, role || "");
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ROLE_KEY);
    }
}

// Run migration on load
migrateToSession();

// ===========================================
// RESTORE SUPABASE AUTH SESSION (ASYNC SOURCE OF TRUTH)
// ===========================================
export async function getRestoredSupabaseSession(maxWaitMs = 2500) {
    try {
        const { data: initialData } = await supabase.auth.getSession();
        if (initialData?.session?.user) {
            return initialData.session;
        }
    } catch (e) {}

    return new Promise((resolve) => {
        let resolved = false;
        let sub = null;

        const timer = setTimeout(async () => {
            if (!resolved) {
                resolved = true;
                if (sub) sub.unsubscribe();
                try {
                    const { data: retryData } = await supabase.auth.getSession();
                    resolve(retryData?.session || null);
                } catch (e) {
                    resolve(null);
                }
            }
        }, maxWaitMs);

        try {
            const { data } = supabase.auth.onAuthStateChange((event, session) => {
                if (!resolved && session?.user) {
                    resolved = true;
                    clearTimeout(timer);
                    if (data?.subscription) data.subscription.unsubscribe();
                    resolve(session);
                }
            });
            sub = data?.subscription;
        } catch (e) {}
    });
}

// Sync compatibility keys with native Supabase Auth events
try {
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
            if (session?.access_token) {
                const storage = localStorage.getItem(REMEMBER_KEY) === "true" ? localStorage : sessionStorage;
                storage.setItem(TOKEN_KEY, session.access_token);
                if (session.user) {
                    const existingUser = getUser() || {};
                    const updatedUser = {
                        id: session.user.id,
                        email: session.user.email,
                        name: existingUser.name || session.user.user_metadata?.name || session.user.email?.split("@")[0] || "User",
                        role: existingUser.role || session.user.user_metadata?.role || "student",
                        accountStatus: existingUser.accountStatus || "ACTIVE",
                        ...existingUser
                    };
                    storage.setItem(USER_KEY, JSON.stringify(updatedUser));
                    storage.setItem(ROLE_KEY, updatedUser.role);
                }
            }
        }
    });
} catch (e) {}

// ===========================================
// READ SESSION
// ===========================================

export function getToken() {
    return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
}

export function getUser() {
    const raw = localStorage.getItem(USER_KEY) || sessionStorage.getItem(USER_KEY);
    try {
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

export function isLoggedIn() {
    return !!getToken();
}

// ===========================================
// WRITE SESSION
// ===========================================

export function login(token, user, remember = false) {
    const storage = remember ? localStorage : sessionStorage;

    storage.setItem(TOKEN_KEY, token);
    storage.setItem(USER_KEY, JSON.stringify(user));
    storage.setItem(ROLE_KEY, user.role);

    if (remember) {
        localStorage.setItem(REMEMBER_KEY, "true");
        // Ensure sessionStorage doesn't have stale data
        sessionStorage.removeItem(TOKEN_KEY);
        sessionStorage.removeItem(USER_KEY);
        sessionStorage.removeItem(ROLE_KEY);
    } else {
        localStorage.setItem(REMEMBER_KEY, "false");
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(ROLE_KEY);
    }
}

// ===========================================
// CLEAR SESSION
// ===========================================

export async function logout() {
    try {
        await supabase.auth.signOut();
    } catch (e) {}

    try {
        if (typeof localStorage !== "undefined") {
            // Remove known keys first, then clear all storage
            localStorage.removeItem(TOKEN_KEY);
            localStorage.removeItem(USER_KEY);
            localStorage.removeItem(ROLE_KEY);
            localStorage.removeItem(REMEMBER_KEY);
            localStorage.removeItem("campora_supabase_auth");
            localStorage.removeItem("campora_pending_role");
            
            // Remove any Supabase internal storage keys matching sb-*
            for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.startsWith("sb-") || key.includes("supabase") || key.includes("campora"))) {
                    localStorage.removeItem(key);
                }
            }
            localStorage.clear();
        }

        if (typeof sessionStorage !== "undefined") {
            sessionStorage.clear();
        }
    } catch (e) {}

    // Always land on the Campora main landing page.
    window.location.replace(getLandingUrl());
}

// ===========================================
// REDIRECT TO MAIN LANDING PAGE
// Use after session has been cleared. Uses
// window.location.replace so the protected
// page is removed from history — the browser
// back button can no longer reopen a dashboard
// using a stale authenticated state.
// ===========================================

export function redirectToLanding() {
    window.location.replace(getLandingUrl());
}

// ===========================================
// ROLE-BASED REDIRECT
// ===========================================

export function redirectBasedOnRole(role) {
    switch (role) {
        case "owner":
            window.location.href = "/pages/owner/dashboard.html";
            break;
        case "admin":
            window.location.href = "/pages/admin/dashboard.html";
            break;
        default:
            window.location.href = "/pages/student/dashboard.html";
    }
}

export function isValidRedirect(url) {
    if (!url) return false;

    let decoded;

    try {
        decoded = decodeURIComponent(url);
    } catch {
        decoded = url;
    }

    if (/^(javascript|data|vbscript):/i.test(decoded)) {
        return false;
    }

    if (decoded.startsWith("//")) {
        return false;
    }

    if (decoded.startsWith("/")) {
        return true;
    }

    try {
        return decoded.startsWith(window.location.origin + "/");
    } catch {
        return false;
    }
}

// ===========================================
// PROTECT PAGE (call on dashboard pages)
// ===========================================

export function protectPage() {
    const token = getToken();
    if (!token) {
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `${getLoginUrl()}?redirectTo=${encodeURIComponent(currentUrl)}`;
        return null;
    }
    return getUser();
}

// ===========================================
// PROTECT PAGE BY ROLE (call on role-specific pages)
// ===========================================

export function protectPageByRole(allowedRoles) {
    const token = getToken();
    if (!token) {
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `${getLoginUrl()}?redirectTo=${encodeURIComponent(currentUrl)}`;
        return null;
    }

    const user = getUser();
    if (!user || !allowedRoles.includes(user.role)) {
        const currentUrl = window.location.pathname + window.location.search + window.location.hash;
        window.location.href = `${getLoginUrl()}?redirectTo=${encodeURIComponent(currentUrl)}`;
        return null;
    }

    return user;
}

// ===========================================
// UPDATE NAVBAR (for index.html)
// ===========================================

export function updateNavbar() {
    const user = getUser();
    const token = getToken();

    const loginBtn = document.getElementById("navLogin");
    const registerBtn = document.getElementById("navRegister");
    const dashboardBtn = document.getElementById("navDashboard");
    const logoutBtn = document.getElementById("navLogout");
    const userName = document.getElementById("navUser");

    if (!user || !token) {
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (registerBtn) registerBtn.style.display = "inline-flex";
        if (dashboardBtn) dashboardBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (userName) userName.style.display = "none";
        return;
    }

    if (loginBtn) loginBtn.style.display = "none";
    if (registerBtn) registerBtn.style.display = "none";
    if (dashboardBtn) dashboardBtn.style.display = "inline-flex";
    if (logoutBtn) logoutBtn.style.display = "inline-flex";
    if (userName) {
        userName.style.display = "inline-flex";
        userName.textContent = "👋 Hi, " + user.name;
    }
}

