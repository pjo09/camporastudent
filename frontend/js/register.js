// ==========================================
// CAMPORA REGISTER - Password-based (no OTP)
// ==========================================

import { login, redirectBasedOnRole, getLoginUrl, isValidRedirect } from "./session.js";
import CONFIG, { API } from "./config.js";
import { supabaseAPI } from "./supabase-api.js";

const API_BASE = API;

const $ = (id) => document.getElementById(id);

// Form Elements
const form = $("registerForm");
const role = $("role");
const successMessage = $("successMessage");
const errorMessage = $("errorMessage");
const createBtn = $("createAccountBtn");

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
    if (successMessage) {
        successMessage.style.display = "block";
        successMessage.innerText = message;
    }
    if (errorMessage) errorMessage.style.display = "none";
}

function showError(message) {
    if (errorMessage) {
        errorMessage.style.display = "block";
        errorMessage.innerText = message;
    }
    if (successMessage) successMessage.style.display = "none";
}

// ==========================================
// PASSWORD SHOW / HIDE TOGGLE
// ==========================================

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

setupPasswordToggle("password", "togglePassword");
setupPasswordToggle("confirmPassword", "toggleConfirmPassword");

// ==========================================
// VALIDATION
// ==========================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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
// SUBMIT - CREATE ACCOUNT (no OTP)
// ==========================================

form.addEventListener("submit", async (e) => {
    e.preventDefault();

    const name = $("name").value.trim();
    const email = $("email").value.trim();
    const password = $("password").value;
    const confirmPassword = $("confirmPassword").value;
    const selectedRole = role.value;

    // --- Validate name ---
    if (!name) {
        showError("Please enter your full name.");
        return;
    }
    if (name.length < 2) {
        showError("Name must be at least 2 characters.");
        return;
    }

    // --- Validate email ---
    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    if (!EMAIL_REGEX.test(email)) {
        showError("Please enter a valid email address.");
        return;
    }

    // --- Validate password (frontend, backend is authoritative) ---
    const passwordError = validatePassword(password);
    if (passwordError) {
        showError(passwordError);
        return;
    }

    // --- Confirm password matches ---
    if (password !== confirmPassword) {
        showError("Passwords do not match. Please try again.");
        return;
    }

    // Loading state
    createBtn.disabled = true;
    const labelEl = createBtn.querySelector(".btn-label");
    const spinner = createBtn.querySelector(".btn-spinner");
    if (labelEl) labelEl.textContent = "Creating Account...";
    if (spinner) spinner.style.display = "block";

    try {
        const authData = await supabaseAPI.signUp(email, password, {
            name,
            role: selectedRole
        });

        const isOwnerPending = selectedRole === "owner";

        if (!isOwnerPending && authData.session && authData.user) {
            const userObj = {
                id: authData.user.id,
                email: authData.user.email,
                name: name,
                role: selectedRole,
                accountStatus: "ACTIVE"
            };
            login(authData.session.access_token, userObj, false);
        }

        if (isOwnerPending) {
            showSuccess("Registration successful! Your owner account is pending approval by an admin.");
        } else {
            showSuccess("Account created successfully!");
        }

        // Redirect based on role
        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get("redirectTo");
        setTimeout(() => {
            if (isOwnerPending) {
                window.location.href = getLoginUrl() + "?pending=true";
            } else if (redirectTo && isValidRedirect(redirectTo)) {
                window.location.href = redirectTo;
            } else {
                redirectBasedOnRole(selectedRole);
            }
        }, 1200);

    } catch (err) {
        console.error("Register Error:", err);
        showError(err.message || "Registration failed. Please try again.");
    } finally {
        createBtn.disabled = false;
        if (labelEl) labelEl.textContent = "Create Account";
        if (spinner) spinner.style.display = "none";
    }
});

// ==========================================
// GOOGLE SIGN IN (register flow)
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

        const urlParams = new URLSearchParams(window.location.search);
        const redirectTo = urlParams.get("redirectTo");
        setTimeout(() => {
            if (data.user.role === "owner" && data.user.accountStatus === "PENDING") {
                window.location.href = getLoginUrl();
            } else if (redirectTo && isValidRedirect(redirectTo)) {
                window.location.href = redirectTo;
            } else {
                redirectBasedOnRole(data.user.role);
            }
        }, 800);

    } catch (err) {
        console.error("Google Register Error:", err);
        showError(err.message || "Google registration failed.");
    }
};

// ==========================================
// INIT GOOGLE SIGN-IN
// ==========================================

(function initGoogleRegister() {
    function setup() {
        const customBtn = document.getElementById("customGoogleBtn") || document.getElementById("googleButton");

        if (customBtn && !customBtn.dataset.bound) {
            customBtn.dataset.bound = "true";
            customBtn.addEventListener("click", async () => {
                try {
                    const selectedRole = role ? role.value : "student";
                    await supabaseAPI.signInWithGoogle(selectedRole);
                } catch (err) {
                    showError(err.message || "Google registration failed.");
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

