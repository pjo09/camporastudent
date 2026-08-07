// ===============================================
// CAMPORA AUTHENTICATION - LOGIN PAGE
// ===============================================

import { login, logout as sessionLogout, redirectBasedOnRole } from "./session.js";
import CONFIG, { API } from "./config.js";

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
    window.location.href = "login.html";
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

        // Redirect after brief delay for success message
        setTimeout(() => redirectBasedOnRole(data.user.role), 500);

    } catch (err) {
        console.error("Login Error:", err);
        showError(err.message);
    } finally {
        setButtonLoading(btn, false, "Login");
    }
}

// ===============================================
// OTP LOGIN
// ===============================================

const sendOtpBtn = $("sendOtpBtn");
const verifyOtpBtnEl = $("verifyBtn");
const otpSection = $("otpSection");

if (sendOtpBtn) {
    sendOtpBtn.addEventListener("click", sendOTP);
}

if (verifyOtpBtnEl) {
    verifyOtpBtnEl.addEventListener("click", verifyOTP);
}

// OTP countdown timer
let otpInterval = null;

function startOtpTimer(seconds) {
    clearInterval(otpInterval);
    const timer = $("otpTimer");
    let remaining = seconds;

    otpInterval = setInterval(() => {
        const min = String(Math.floor(remaining / 60)).padStart(2, "0");
        const sec = String(remaining % 60).padStart(2, "0");
        if (timer) timer.innerText = `${min}:${sec}`;
        remaining--;

        if (remaining < 0) {
            clearInterval(otpInterval);
            if (timer) timer.innerText = "Expired";
        }
    }, 1000);
}

// SEND OTP
async function sendOTP() {
    const email = $("otpEmail").value.trim();

    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    if (!EMAIL_REGEX.test(email)) {
        showError("Please enter a valid email address.");
        return;
    }

    setButtonLoading(sendOtpBtn, true, "Sending...");

    try {
        const response = await fetch(`${API}/otp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: "User", email })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to send OTP.");
        }

        // Show OTP input section
        if (otpSection) otpSection.style.display = "block";
        showSuccess("OTP sent to " + email);
        startOtpTimer(300);

    } catch (err) {
        console.error("Send OTP Error:", err);
        showError(err.message);
    } finally {
        setButtonLoading(sendOtpBtn, false, "Send OTP");
    }
}

// VERIFY OTP
async function verifyOTP() {
    const email = $("otpEmail").value.trim();
    const code = $("otpInput").value.trim();
    const remember = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

    if (!code || code.length !== 6) {
        showError("Please enter the 6-digit OTP.");
        return;
    }

    setButtonLoading(verifyOtpBtnEl, true, "Verifying...");

    try {
        const response = await fetch(`${API}/otp/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ type: "login", email, code })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Verification failed.");
        }

        // Save session with remember me
        login(data.token, data.user, remember);

        showSuccess("Login successful!");

        setTimeout(() => redirectBasedOnRole(data.user.role), 500);

    } catch (err) {
        console.error("Verify OTP Error:", err);
        showError(err.message);
    } finally {
        setButtonLoading(verifyOtpBtnEl, false, "Verify OTP");
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

        setTimeout(() => redirectBasedOnRole(data.user.role), 500);

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
        if (typeof google === "undefined" || typeof google.accounts === "undefined") {
            // Retry after GSI script loads
            setTimeout(setup, 500);
            return;
        }

        google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID || "45569590642-4mehsdjfru09l14mmslif775edv7jego.apps.googleusercontent.com",
            callback: window.handleGoogleLogin
        });

        const googleBtn = document.getElementById("googleButton");
        if (googleBtn) {
            google.accounts.id.renderButton(googleBtn, {
                theme: "outline",
                size: "large",
                shape: "pill",
                width: 320
            });
        }
    }

    if (document.readyState === "complete") {
        setup();
    } else {
        window.addEventListener("load", setup);
    }
})();
