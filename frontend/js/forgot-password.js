// ===============================================
// CAMPORA FORGOT / RESET PASSWORD
// Two-step flow: email -> OTP -> new password
// ===============================================

import { API } from "./config.js";
import { getLoginUrl } from "./session.js";

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
// LOADING SKELETON
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
// BUTTON LOADING STATE
// ===============================================

function setButtonLoading(btn, isLoading, label) {
    if (!btn) return;
    const labelEl = btn.querySelector(".btn-label");
    const spinner = btn.querySelector(".btn-spinner");
    btn.disabled = isLoading;
    if (labelEl) labelEl.textContent = label;
    if (spinner) spinner.style.display = isLoading ? "block" : "none";
}

// ===============================================
// PASSWORD TOGGLES
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

setupPasswordToggle("newPassword", "toggleNewPassword");
setupPasswordToggle("confirmNewPassword", "toggleConfirmNewPassword");

// ===============================================
// STEP SWITCHING
// ===============================================

function showStep(step) {
    document.querySelectorAll(".reset-step").forEach((el) => {
        el.style.display = el.dataset.step === String(step) ? "block" : "none";
    });
}

// ===============================================
// VALIDATION
// ===============================================

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{8,128}$/;

function validatePassword(password) {
    if (!password) return "Please enter a new password.";
    if (password.length < 8) return "Password must be at least 8 characters.";
    if (!/[A-Z]/.test(password)) return "Password must include an uppercase letter.";
    if (!/[a-z]/.test(password)) return "Password must include a lowercase letter.";
    if (!/\d/.test(password)) return "Password must include a number.";
    if (!/[^A-Za-z0-9\s]/.test(password)) return "Password must include a special character.";
    return null;
}

// ===============================================
// STATE
// ===============================================

let resetEmail = "";
let otpInterval = null;
let resendCountdown = null;

// ===============================================
// OTP TIMER
// ===============================================

function startOtpTimer(seconds) {
    clearInterval(otpInterval);
    const timer = $("fpOtpTimer");
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

// ===============================================
// STEP 1: SEND RESET CODE
// ===============================================

const forgotForm = $("forgotForm");
const sendResetBtn = $("sendResetBtn");

forgotForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = $("fpEmail").value.trim();
    if (!email) {
        showError("Please enter your email address.");
        return;
    }
    if (!EMAIL_REGEX.test(email)) {
        showError("Please enter a valid email address.");
        return;
    }

    setButtonLoading(sendResetBtn, true, "Sending...");

    try {
        const response = await fetch(`${API}/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to send reset code.");
        }

        resetEmail = email;
        $("sentTo").textContent = email;
        showStep(2);
        showSuccess("If an account exists, a reset code has been sent to your email.");
        startOtpTimer(300);
        startResendCountdown(30);

    } catch (err) {
        showError(err.message);
    } finally {
        setButtonLoading(sendResetBtn, false, "Send Reset Code");
    }
});

// ===============================================
// RESEND COUNTDOWN
// ===============================================

function startResendCountdown(seconds) {
    clearInterval(resendCountdown);
    const resendBtn = $("resendBtn");
    let remaining = seconds;
    resendBtn.disabled = true;
    resendBtn.textContent = `Resend code (${remaining}s)`;

    resendCountdown = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(resendCountdown);
            resendBtn.disabled = false;
            resendBtn.textContent = "Resend code";
        } else {
            resendBtn.textContent = `Resend code (${remaining}s)`;
        }
    }, 1000);
}

// Resend handler — prevent duplicate concurrent requests with a flag
let isResending = false;
$("resendBtn").addEventListener("click", async () => {
    if (!resetEmail || isResending) return;
    isResending = true;
    const btn = $("resendBtn");
    setButtonLoading(btn, true, "Sending...");
    try {
        const response = await fetch(`${API}/auth/forgot-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmail })
        });
        const data = await response.json();
        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to resend code.");
        }
        showSuccess("A new code has been sent to your email.");
        // Reset button state: the countdown will disable it, so we leave
        // it in loading state until startResendCountdown takes over.
        setButtonLoading(btn, false, "Resend code");
        startOtpTimer(300);
        startResendCountdown(30);
    } catch (err) {
        showError(err.message);
        // Re-enable on error so the user can retry
        setButtonLoading(btn, false, "Resend code");
        btn.disabled = false;
    } finally {
        isResending = false;
    }
});

// ===============================================
// STEP 2: VERIFY CODE
// ===============================================

$("verifyResetBtn").addEventListener("click", async () => {
    const code = $("fpOtp").value.trim();
    if (!code || code.length !== 6) {
        showError("Please enter the 6-digit code.");
        return;
    }

    const btn = $("verifyResetBtn");
    setButtonLoading(btn, true, "Verifying...");

    try {
        // Verify the OTP against the backend before advancing to step 3.
        const response = await fetch(`${API}/auth/verify-reset-otp`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmail, code })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to verify code.");
        }

        showStep(3);
        showSuccess("Code verified. Please set your new password.");
    } catch (err) {
        showError(err.message);
    } finally {
        setButtonLoading(btn, false, "Verify Code");
    }
});

// ===============================================
// STEP 3: RESET PASSWORD
// ===============================================

const resetForm = $("resetForm");
const resetSubmitBtn = $("resetSubmitBtn");

resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const password = $("newPassword").value;
    const confirmPassword = $("confirmNewPassword").value;
    const code = $("fpOtp").value.trim();

    const pwdError = validatePassword(password);
    if (pwdError) {
        showError(pwdError);
        return;
    }
    if (password !== confirmPassword) {
        showError("Passwords do not match. Please try again.");
        return;
    }

    setButtonLoading(resetSubmitBtn, true, "Resetting...");

    try {
        const response = await fetch(`${API}/auth/reset-password`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: resetEmail, code, password })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.message || "Unable to reset password.");
        }

        clearInterval(otpInterval);
        clearInterval(resendCountdown);

        showSuccess("Password reset successful! Redirecting to login...");
        setTimeout(() => {
            window.location.href = getLoginUrl();
        }, 1200);

    } catch (err) {
        showError(err.message);
    } finally {
        setButtonLoading(resetSubmitBtn, false, "Reset Password");
    }
});
