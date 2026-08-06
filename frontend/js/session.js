// ===========================================
// CAMPORA SESSION MANAGEMENT
// ===========================================

const TOKEN_KEY = "camporaToken";
const USER_KEY = "camporaUser";
const ROLE_KEY = "camporaRole";
const REMEMBER_KEY = "camporaRemember";

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

export function logout() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(ROLE_KEY);
    localStorage.removeItem(REMEMBER_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(USER_KEY);
    sessionStorage.removeItem(ROLE_KEY);
}

// ===========================================
// ROLE-BASED REDIRECT
// ===========================================

export function redirectBasedOnRole(role) {
    switch (role) {
        case "owner":
            window.location.href = "/pages/owner//pages/student/dashboard.html";
            break;
        case "admin":
            window.location.href = "/pages/admin//pages/student/dashboard.html";
            break;
        default:
            window.location.href = "/pages/student/dashboard.html";
    }
}

// ===========================================
// PROTECT PAGE (call on dashboard pages)
// ===========================================

export function protectPage() {
    const token = getToken();
    if (!token) {
        window.location.href = "login.html";
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
        window.location.href = "login.html";
        return null;
    }

    const user = getUser();
    if (!user || !allowedRoles.includes(user.role)) {
        window.location.href = "login.html";
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

