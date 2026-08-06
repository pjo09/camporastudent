// ==========================================
// CAMPORA REGISTER - OTP + Google
// ==========================================

import { login, redirectBasedOnRole } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

// Form Elements
const form = document.getElementById("registerForm");
const role = document.getElementById("role");
const ownerFields = document.getElementById("ownerFields");
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
// SHOW CORRECT FIELDS BASED ON ROLE
// ==========================================

function updateRoleUI() {
    if (role.value === "owner") {
        ownerFields.style.display = "block";
    } else {
        ownerFields.style.display = "none";
    }
}

updateRoleUI();
role.addEventListener("change", updateRoleUI);

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
// SEND OTP
// ==========================================

sendOtpBtn.addEventListener("click", async () => {
    const name = document.getElementById("name").value.trim();
    const email = document.getElementById("email").value.trim();

    if (!name) {
        showError("Please enter your full name.");
        return;
    }
    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    if (!email.includes("@")) {
        showError("Please enter a valid email address.");
        return;
    }

    sendOtpBtn.disabled = true;
    sendOtpBtn.innerText = "Sending OTP...";

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
        sendOtpBtn.disabled = false;
        sendOtpBtn.innerText = "Send OTP";
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

    const payload = {
        type: "register",
        name: document.getElementById("name").value.trim(),
        email: document.getElementById("email").value.trim(),
        role: role.value,
        businessName: document.getElementById("businessName")?.value.trim() || "",
        city: document.getElementById("city")?.value.trim() || "",
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
    createBtn.disabled = true;
    createBtn.innerText = "Verifying...";

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

        // Save session using shared module
        login(data.token, data.user, false);

        showSuccess("Account created successfully!");

        setTimeout(() => redirectBasedOnRole(data.user.role), 1200);

    } catch (err) {
        showError(err.message || "Verification failed.");
    } finally {
        createBtn.disabled = false;
        createBtn.innerText = "Verify OTP & Create Account";
    }
});

// ==========================================
// GOOGLE SIGN IN
// ==========================================

window.handleGoogleRegister = async function (response) {
    try {
        const res = await fetch(`${API}/google`, {
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
                client_id: "45569590642-4mehsdjfru09l14mmslif775edv7jego.apps.googleusercontent.com",
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

