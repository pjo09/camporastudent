// ===============================================
// CAMPORA FORGOT / RESET PASSWORD — SUPABASE NATIVE
// Standard Supabase recovery flow
// ===============================================

import { supabase } from "./supabaseClient.js";
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
// STEP 1: SEND RESET LINK / CODE VIA SUPABASE AUTH
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
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: `${window.location.origin}/forgot-password.html`
        });

        if (error) throw error;

        resetEmail = email;
        const sentToEl = $("sentTo");
        if (sentToEl) sentToEl.textContent = email;
        showStep(2);
        showSuccess("A password reset link / OTP code has been sent to your email.");
        startOtpTimer(300);
        startResendCountdown(30);

    } catch (err) {
        showError(err.message || "Failed to send reset email.");
    } finally {
        setButtonLoading(sendResetBtn, false, "Send Reset Link");
    }
});

// ===============================================
// RESEND COUNTDOWN
// ===============================================

function startResendCountdown(seconds) {
    clearInterval(resendCountdown);
    const resendBtn = $("resendBtn");
    if (!resendBtn) return;
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

let isResending = false;
const resendBtn = $("resendBtn");
if (resendBtn) {
    resendBtn.addEventListener("click", async () => {
        if (!resetEmail || isResending) return;
        isResending = true;
        setButtonLoading(resendBtn, true, "Sending...");
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
                redirectTo: `${window.location.origin}/forgot-password.html`
            });
            if (error) throw error;
            showSuccess("A new reset code has been sent to your email.");
            setButtonLoading(resendBtn, false, "Resend code");
            startOtpTimer(300);
            startResendCountdown(30);
        } catch (err) {
            showError(err.message || "Failed to resend email.");
            setButtonLoading(resendBtn, false, "Resend code");
            resendBtn.disabled = false;
        } finally {
            isResending = false;
        }
    });
}

// ===============================================
// STEP 2: VERIFY OTP / TOKEN (IF 6-DIGIT CODE ENTERED)
// ===============================================

const verifyBtn = $("verifyResetBtn");
if (verifyBtn) {
    verifyBtn.addEventListener("click", async () => {
        const code = $("fpOtp").value.trim();
        if (!code) {
            showError("Please enter the verification code.");
            return;
        }

        setButtonLoading(verifyBtn, true, "Verifying...");

        try {
            const { data, error } = await supabase.auth.verifyOtp({
                email: resetEmail,
                token: code,
                type: "recovery"
            });

            if (error) throw error;

            showStep(3);
            showSuccess("Code verified successfully. Please set your new password.");
        } catch (err) {
            showError(err.message || "Failed to verify code.");
        } finally {
            setButtonLoading(verifyBtn, false, "Verify Code");
        }
    });
}

// Check if landing back from Supabase password recovery link in email
supabase.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
        showStep(3);
        showSuccess("Recovery authenticated. Please set your new password below.");
    }
});

// ===============================================
// STEP 3: RESET PASSWORD VIA SUPABASE AUTH
// ===============================================

const resetForm = $("resetForm");
const resetSubmitBtn = $("resetSubmitBtn");

if (resetForm) {
    resetForm.addEventListener("submit", async (e) => {
        e.preventDefault();

        const password = $("newPassword").value;
        const confirmPassword = $("confirmNewPassword").value;

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
            const { error } = await supabase.auth.updateUser({ password });
            if (error) throw error;

            clearInterval(otpInterval);
            clearInterval(resendCountdown);

            showSuccess("Password reset successful! Redirecting to login...");
            setTimeout(() => {
                window.location.href = getLoginUrl();
            }, 1200);

        } catch (err) {
            showError(err.message || "Failed to update password.");
        } finally {
            setButtonLoading(resetSubmitBtn, false, "Reset Password");
        }
    });
}
