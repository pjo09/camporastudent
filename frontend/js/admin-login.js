// ===============================================
// CAMPORA ADMIN AUTHENTICATION - ADMIN LOGIN PAGE
// ===============================================

import { login, redirectBasedOnRole } from "./session.js";
import { API } from "./config.js";

// -------------------------
// Helpers
// -------------------------

const $ = (id) => document.getElementById(id);

function showError(message) {
    const errorBox = $("errorMessage");
    const successBox = $("successMessage");
    if (successBox) successBox.style.display = "none";
    if (errorBox) {
        errorBox.innerText = message;
        errorBox.style.display = "block";
    }
}

function showSuccess(message) {
    const errorBox = $("errorMessage");
    const successBox = $("successMessage");
    if (errorBox) errorBox.style.display = "none";
    if (successBox) {
        successBox.innerText = message;
        successBox.style.display = "block";
    }
}

// ===============================================
// LOADING SKELETON — hides once page is ready
// ===============================================

(function initSkeleton() {
    const hide = () => {
        const skeleton = $("authSkeleton");
        const wrap = $("authFormWrap");
        if (skeleton) skeleton.style.display = "none";
        if (wrap) wrap.style.display = "block";
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hide);
    } else {
        hide();
    }
})();

// ===============================================
// PASSWORD SHOW / HIDE TOGGLE
// ===============================================

function setupPasswordToggle(inputId, toggleId) {
    const input = $(inputId);
    const toggle = $(toggleId);
    if (!input || !toggle) return;

    toggle.addEventListener("click", () => {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        const icon = toggle.querySelector("i");
        if (icon) icon.className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
        toggle.setAttribute("aria-pressed", String(isHidden));
    });
}

setupPasswordToggle("adminPassword", "toggleAdminPassword");

// ===============================================
// BUTTON LOADING STATE
// ===============================================

function setButtonLoading(btn, isLoading, label) {
    if (!btn) return;
    const labelEl = btn.querySelector(".btn-label");
    const spinner = btn.querySelector(".btn-spinner");
    btn.disabled = isLoading;
    if (labelEl) labelEl.textContent = isLoading ? label : "Sign In";
    if (spinner) spinner.style.display = isLoading ? "block" : "none";
}

// ===============================================
// AUTO REDIRECT — if already an admin, go to dashboard
// ===============================================

(function checkSession() {
    const token = localStorage.getItem("camporaToken") || sessionStorage.getItem("camporaToken");
    const raw = localStorage.getItem("camporaUser") || sessionStorage.getItem("camporaUser");
    if (token && raw) {
        try {
            const user = JSON.parse(raw);
            if (user && user.role === "admin") {
                redirectBasedOnRole("admin");
                return;
            }
        } catch (e) {
            // Invalid session, continue
        }
    }
})();

// ===============================================
// ADMIN LOGIN SUBMIT
// ===============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const adminForm = $("adminLoginForm");

if (adminForm) {
    adminForm.addEventListener("submit", adminLogin);
}

async function adminLogin(e) {
    e.preventDefault();

    const btn = $("adminLoginBtn");
    const email = $("adminEmail").value.trim();
    const password = $("adminPassword").value;

    // Frontend validation (defense in depth — backend is authoritative)
    if (!email) {
        showError("Please enter your admin email.");
        return;
    }
    if (!EMAIL_REGEX.test(email)) {
        showError("Please enter a valid email address.");
        return;
    }
    if (!password) {
        showError("Please enter your password.");
        return;
    }

    setButtonLoading(btn, true, "Authenticating...");

    try {
        const response = await fetch(`${API}/auth/admin/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        let data = {};
        const contentType = response.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
            data = await response.json();
        } else {
            throw new Error(`Admin login failed: HTTP ${response.status}`);
        }

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Admin login failed.");
        }

        // Save admin session (persist across browser restarts)
        login(data.token, data.user, true);

        showSuccess("Admin authentication successful!");

        setTimeout(() => redirectBasedOnRole("admin"), 500);

    } catch (err) {
        console.error("Admin Login Error:", err);
        showError(err.message);
    } finally {
        setButtonLoading(btn, false, "Sign In");
    }
}
