// ==========================================
// CAMPORA REGISTER - Google + Password
// ==========================================

import { login, redirectBasedOnRole } from "./session.js";
import CONFIG, { API } from "./config.js";

const API_BASE = API;

// Form Elements
const form = document.getElementById("registerForm");
const role = document.getElementById("role");
const successMessage = document.getElementById("successMessage");
const errorMessage = document.getElementById("errorMessage");

// ==========================================
// LOADING SKELETON — hides once page is ready
// ==========================================

(function initSkeleton() {
    const hide = () => {
        const skeleton = document.getElementById("authSkeleton");
        const wrap = document.getElementById("authFormWrap");
        if (skeleton) skeleton.style.display = "none";
        if (wrap) wrap.style.display = "block";
    };
    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", hide);
    } else {
        hide();
    }
})();

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
// REGISTER & AUTO LOGIN
// ==========================================

form.addEventListener("submit", async (e) => {
    e.preventDefault();

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

    const payload = {
        name,
        email,
        role: role.value,
        password
    };

    const createBtn = document.getElementById("createAccountBtn");
    setButtonLoading(createBtn, true, "Creating Account...");

    try {
        const response = await fetch(`${API}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Registration failed.");
        }

        // Owner accounts awaiting approval do not get a token yet.
        if (!data.token || !data.user) {
            showSuccess(data.message || "Account created! Your account is waiting for admin approval.");
            setTimeout(() => {
                window.location.href = "login.html";
            }, 1800);
            return;
        }

        // Save session using shared module (auto-login)
        login(data.token, data.user, false);

        showSuccess("Account created successfully! Redirecting...");

        setTimeout(() => redirectBasedOnRole(data.user.role), 1200);

    } catch (err) {
        showError(err.message || "Registration failed.");
    } finally {
        setButtonLoading(createBtn, false, "Create Account");
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
