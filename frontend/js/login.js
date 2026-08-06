// ===============================================
// CAMPORA AUTHENTICATION - LOGIN PAGE
// ===============================================

import { login, logout as sessionLogout, redirectBasedOnRole } from "./session.js";
import { API } from "./config.js";

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

async function loginUser(e) {
    e.preventDefault();

    const btn = loginForm.querySelector("button[type='submit']");
    const email = $("loginEmail").value.trim();
    const password = $("loginPassword").value;
    const remember = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

    // Validate
    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    if (!password) {
        showError("Please enter your password.");
        return;
    }

    // Loading state
    btn.disabled = true;
    btn.innerText = "Signing In...";

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
        btn.disabled = false;
        btn.innerText = "Login";
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

// SEND OTP
async function sendOTP() {
    const email = $("otpEmail").value.trim();

    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    if (!email.includes("@")) {
        showError("Please enter a valid email address.");
        return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.innerText = "Sending...";

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

    } catch (err) {
        console.error("Send OTP Error:", err);
        showError(err.message);
    } finally {
        sendOtpBtn.disabled = false;
        sendOtpBtn.innerText = "Send OTP";
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

    verifyOtpBtnEl.disabled = true;
    verifyOtpBtnEl.innerText = "Verifying...";

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
        verifyOtpBtnEl.disabled = false;
        verifyOtpBtnEl.innerText = "Verify OTP";
    }
}

// ===============================================
// GOOGLE LOGIN
// ===============================================

window.handleGoogleLogin = async function (response) {
    try {
        const res = await fetch(`${API}/google`, {
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
            client_id: "45569590642-4mehsdjfru09l14mmslif775edv7jego.apps.googleusercontent.com",
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

