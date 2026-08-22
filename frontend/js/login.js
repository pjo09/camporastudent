// ===============================================
// CAMPORA AUTHENTICATION - LOGIN PAGE
// ===============================================

import { login, logout as sessionLogout, redirectBasedOnRole, isValidRedirect } from "./session.js";
import CONFIG, { API } from "./config.js";
import { supabaseAPI } from "./supabase-api.js";

const API_BASE = API;

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

setupPasswordToggle("loginPassword", "toggleLoginPassword");

// ===============================================
// BUTTON LOADING STATE
// ===============================================

function setButtonLoading(btn, isLoading, label) {
    if (!btn) return;
    const labelEl = btn.querySelector(".btn-label");
    const spinner = btn.querySelector(".btn-spinner");
    btn.disabled = isLoading;
    if (labelEl) labelEl.textContent = isLoading ? label : (btn.dataset.originalLabel || label);
    if (spinner) spinner.style.display = isLoading ? "block" : "none";
}

// ===============================================
// AUTO LOGIN CHECK — if already logged in, redirect
// ===============================================

(function checkSession() {
    const token = localStorage.getItem("camporaToken") || sessionStorage.getItem("camporaToken");
    const raw = localStorage.getItem("camporaUser") || sessionStorage.getItem("camporaUser");
    if (token && raw) {
        try {
            const user = JSON.parse(raw);
            if (user && user.role) {
                redirectBasedOnRole(user.role);
                return;
            }
        } catch (e) {
            // Invalid session, continue to login page
        }
    }
})();

// ===============================================
// LOGOUT (global for onclick)
// ===============================================

window.logout = function () {
    sessionLogout();
};

// ===============================================
// PASSWORD LOGIN
// ===============================================

const loginForm = $("loginForm");
const rememberMeCheckbox = document.getElementById("rememberMe");

if (loginForm) {
    loginForm.addEventListener("submit", loginUser);
}

// Simple email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

async function loginUser(e) {
    e.preventDefault();

    const btn = $("loginBtn");
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    const remember = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

    // Validate
    if (!email) {
        showError("Please enter your email address.");
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

    // Loading state
    setButtonLoading(btn, true, "Signing In...");

    try {
        const response = await fetch(`${API}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Login failed.");
        }

        // Save session with remember me preference
        login(data.token, data.user, remember);

        showSuccess("Welcome back, " + data.user.name + "!");

        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get("redirectTo");
        setTimeout(() => {
            if (redirectTo && isValidRedirect(redirectTo)) {
                window.location.href = redirectTo;
            } else {
                redirectBasedOnRole(data.user.role);
            }
        }, 500);

    } catch (err) {
        console.error("Login Error:", err);
        showError(err.message);
    } finally {
        setButtonLoading(btn, false, "Login");
    }
}

// ===============================================
// GOOGLE LOGIN
// ===============================================

window.handleGoogleLogin = async function (response) {
    try {
        const res = await fetch(`${API}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ credential: response.credential })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
            throw new Error(data.message || "Google login failed.");
        }

        const remember = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
        login(data.token, data.user, remember);

        showSuccess("Welcome, " + data.user.name + "!");

        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get("redirectTo");
        setTimeout(() => {
            if (redirectTo && isValidRedirect(redirectTo)) {
                window.location.href = redirectTo;
            } else {
                redirectBasedOnRole(data.user.role);
            }
        }, 500);

    } catch (err) {
        console.error("Google Login Error:", err);
        showError(err.message || "Google login failed.");
    }
};

// ===============================================
// INIT GOOGLE SIGN-IN
// ===============================================

(function initGoogle() {
    function setup() {
        const btn = document.getElementById("loginGoogleBtn") || document.getElementById("googleButton");
        if (btn && !btn.dataset.bound) {
            btn.dataset.bound = "true";
            btn.addEventListener("click", async () => {
                try {
                    await supabaseAPI.signInWithGoogle("student");
                } catch (err) {
                    showError(err.message || "Google Sign-In failed.");
                }
            });
        }
    }

    if (document.readyState === "complete") {
        setup();
    } else {
        window.addEventListener("load", setup);
    }
})();
