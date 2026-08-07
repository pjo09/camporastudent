// ==========================================
// CAMPORA REGISTER - OTP + Google + Password
// ==========================================

import { login, redirectBasedOnRole } from "./session.js";
import CONFIG, { API } from "./config.js";

const API_BASE = API;

// Form Elements
const form = document.getElementById("registerForm");
const role = document.getElementById("role");
const sendOtpBtn = document.getElementById("sendOtpBtn");
const otpSection = document.getElementById("otpSection");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");

// ==========================================
// PRESELECT ROLE FROM URL
// ==========================================

const params = new URLSearchParams(window.location.search);
const roleFromURL = params.get("role");

if (roleFromURL === "owner") {
    role.value = "owner";
} else {
    role.value = "student";
}

// ==========================================
// HELPERS
// ==========================================

function showSuccess(message) {
    successMessage.style.display = "block";
    errorMessage.style.display = "none";
    successMessage.innerText = message;
}

function showError(message) {
    errorMessage.style.display = "block";
    successMessage.style.display = "none";
    errorMessage.innerText = message;
}

// ==========================================
// PASSWORD SHOW / HIDE TOGGLE
// ==========================================

function setupPasswordToggle(inputId, toggleId) {
    const input = document.getElementById(inputId);
    const toggle = document.getElementById(toggleId);
    if (!input || !toggle) return;

    toggle.addEventListener("click", () => {
        const isHidden = input.type === "password";
        input.type = isHidden ? "text" : "password";
        const icon = toggle.querySelector("i");
        if (icon) icon.className = isHidden ? "fa-solid fa-eye-slash" : "fa-solid fa-eye";
        toggle.setAttribute("aria-pressed", String(isHidden));
    });
}

setupPasswordToggle("password", "togglePassword");
setupPasswordToggle("confirmPassword", "toggleConfirmPassword");

// ==========================================
// BUTTON LOADING STATE
// ==========================================

function setButtonLoading(btn, isLoading, label) {
    if (!btn) return;
    const labelEl = btn.querySelector(".btn-label");
    const spinner = btn.querySelector(".btn-spinner");
    btn.disabled = isLoading;
    if (labelEl) labelEl.textContent = label;
    if (spinner) spinner.style.display = isLoading ? "block" : "none";
}

// ==========================================
// VALIDATION
// ==========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// Min 8 chars, at least 1 uppercase, 1 lowercase, 1 digit, 1 special
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;

function validatePassword(password) {
    if (!password) return "Please create a password.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
    if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
    if (!/\d/.test(password)) return "Password must include a number.";
    if (!/[^A-Za-z0-9\s]/.test(password)) return "Password must include a special character.";
    return null;
}

// ==========================================
// SEND OTP
// ==========================================

sendOtpBtn.addEventListener("click", async () => {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (!name) {
        showError("Please enter your full name.");
        return;
    }
    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    if (!EMAIL_REGEX.test(email)) {
        showError("Please enter a valid email address.");
        return;
    }
    const pwdError = validatePassword(password);
    if (pwdError) {
        showError(pwdError);
        return;
    }
    if (password !== confirmPassword) {
        showError("Passwords do not match. Please try again.");
        return;
    }

    setButtonLoading(sendOtpBtn, true, "Sending OTP...");

    try {
        const response = await fetch(`${API}/otp/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, email })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to send OTP.");
        }

        otpSection.style.display = "block";
        showSuccess("OTP sent successfully. Please check your email.");
        startOtpTimer(300);

    } catch (err) {
        showError(err.message || "Unable to send OTP.");
    } finally {
        setButtonLoading(sendOtpBtn, false, "Send OTP");
    }
});

// ==========================================
// OTP TIMER
// ==========================================

let otpInterval = null;

function startOtpTimer(seconds) {
    clearInterval(otpInterval);
    const timer = document.getElementById("otpTimer");
    let remaining = seconds;

    otpInterval = setInterval(() => {
        const min = String(Math.floor(remaining / 60)).padStart(2, "0");
        const sec = String(remaining % 60).padStart(2, "0");
        timer.innerText = `${min}:${sec}`;
        remaining--;

        if (remaining < 0) {
            clearInterval(otpInterval);
            timer.innerText = "Expired";
        }
    }, 1000);
}

// ==========================================
// VERIFY OTP & CREATE ACCOUNT
// ==========================================

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = document.getElementById("password").value;
    const confirmPassword = document.getElementById("confirmPassword").value;

    if (password !== confirmPassword) {
        showError("Passwords do not match. Please try again.");
        return;
    }

    const payload = {
        type: "register",
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        role: role.value,
        password,
        code: document.getElementById("otp").value.trim()
    };

    if (!payload.name) {
        showError("Please enter your full name.");
        return;
    }
    if (!payload.code || payload.code.length !== 6) {
        showError("Please enter the 6-digit OTP.");
        return;
    }

    const createBtn = document.getElementById("createAccountBtn");
    setButtonLoading(createBtn, true, "Verifying...");

    try {
        const response = await fetch(`${API}/otp/verify`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Verification failed.");
        }

        // Save session using shared module (auto-login)
        if (data.token && data.user) {
            login(data.token, data.user, false);
        }

        showSuccess("Account created successfully!");

        setTimeout(() => redirectBasedOnRole(data.user ? data.user.role : "student"), 1200);

    } catch (err) {
        showError(err.message || "Verification failed.");
    } finally {
        setButtonLoading(createBtn, false, "Verify OTP & Create Account");
    }
});

// ==========================================
// GOOGLE SIGN IN
// ==========================================

window.handleGoogleRegister = async function (response) {
    try {
        const res = await fetch(`${API}/auth/google`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                credential: response.credential,
                role: role.value
            })
        });

        const data = await res.json();

        if (!data.success) {
            throw new Error(data.message || "Google registration failed.");
        }

        login(data.token, data.user, false);

        showSuccess("Welcome, " + data.user.name + "!");
        setTimeout(() => redirectBasedOnRole(data.user.role), 500);

    } catch (err) {
        console.error("Google Register Error:", err);
        showError(err.message || "Google registration failed.");
    }
};

// ==========================================
// INIT GOOGLE SIGN-IN (register page)
// ==========================================

(function initGoogleRegister() {
    function setup() {
        if (typeof google === "undefined" || typeof google.accounts === "undefined") {
            setTimeout(setup, 500);
            return;
        }

        const googleBtn = document.getElementById("googleButton");
        if (!googleBtn) return;

        // Check if already initialized (login.js may have done it)
        try {
            google.accounts.id.initialize({
                client_id: CONFIG.GOOGLE_CLIENT_ID || "45569590642-4mehsdjfru09l14mmslif775edv7jego.apps.googleusercontent.com",
                callback: window.handleGoogleRegister
            });
        } catch (e) {
            // Already initialized - that's fine
        }

        google.accounts.id.renderButton(googleBtn, {
            theme: "filled_blue",
            size: "large",
            shape: "pill",
            width: 420
        });
    }

    if (document.readyState === "complete") {
        setup();
    } else {
        window.addEventListener("load", setup);
    }
})();
