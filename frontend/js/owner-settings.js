// =====================================================
// CAMPORA OWNER SETTINGS V3
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  profileForm: $("profileForm"),
  setName: $("setName"),
  setPhone: $("setPhone"),
  setBusinessName: $("setBusinessName"),
  setCity: $("setCity"),
  setBio: $("setBio"),
  passwordForm: $("passwordForm"),
  currentPassword: $("currentPassword"),
  newPassword: $("newPassword"),
  confirmPassword: $("confirmPassword"),
  deleteAccountBtn: $("deleteAccountBtn"),
};

// =====================================================
// INIT
// =====================================================

initShell("Settings");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadProfile();
});

function setupListeners() {
  DOM.profileForm?.addEventListener("submit", handleProfileUpdate);
  DOM.passwordForm?.addEventListener("submit", handlePasswordChange);
  DOM.deleteAccountBtn?.addEventListener("click", handleDeleteAccount);
}

// =====================================================
// LOAD PROFILE
// =====================================================

async function loadProfile() {
  try {
    const data = await apiFetch("/owner/profile");
    const owner = data.owner || {};
    if (DOM.setName) DOM.setName.value = owner.name || "";
    if (DOM.setPhone) DOM.setPhone.value = owner.phone || "";
    if (DOM.setBusinessName) DOM.setBusinessName.value = owner.businessName || "";
    if (DOM.setCity) DOM.setCity.value = owner.city || "";
    if (DOM.setBio) DOM.setBio.value = owner.bio || "";
  } catch (err) {
    console.error("Profile load error:", err);
  }
}

// =====================================================
// PROFILE UPDATE
// =====================================================

async function handleProfileUpdate(e) {
  e.preventDefault();
  const btn = DOM.profileForm.querySelector("button[type='submit']");
  btn.disabled = true;

  try {
    await apiFetch("/owner/profile", {
      method: "PUT",
      body: JSON.stringify({
        name: DOM.setName.value,
        phone: DOM.setPhone.value,
        businessName: DOM.setBusinessName.value,
        city: DOM.setCity.value,
        bio: DOM.setBio.value,
      }),
    });
    showToast("Profile updated successfully", "success");
  } catch (err) {
    showToast("Failed to update profile: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

// =====================================================
// PASSWORD CHANGE
// =====================================================

async function handlePasswordChange(e) {
  e.preventDefault();

  const current = DOM.currentPassword?.value;
  const next = DOM.newPassword?.value;
  const confirm = DOM.confirmPassword?.value;

  if (!current || !next || !confirm) {
    showToast("Please fill in all password fields", "error");
    return;
  }
  if (next !== confirm) {
    showToast("New passwords do not match", "error");
    return;
  }
  if (next.length < 6) {
    showToast("New password must be at least 6 characters", "error");
    return;
  }

  const btn = DOM.passwordForm.querySelector("button[type='submit']");
  btn.disabled = true;

  try {
    await apiFetch("/owner/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    showToast("Password changed successfully", "success");
    DOM.passwordForm.reset();
  } catch (err) {
    showToast("Failed to change password: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

// =====================================================
// DELETE ACCOUNT
// =====================================================

async function handleDeleteAccount() {
  if (!confirm("Are you sure you want to delete your account? This removes all your properties and data.")) return;
  if (!confirm("This action cannot be undone. Continue?")) return;

  DOM.deleteAccountBtn.disabled = true;
  DOM.deleteAccountBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';

  try {
    // Owner route has no account-delete endpoint; attempt via a best-effort
    // We block deletion server-side unless present. For now, inform user.
    showToast("Account deletion is currently unavailable. Please contact CAMPORA support.", "info");
  } catch (err) {
    showToast("Failed to delete account: " + err.message, "error");
  } finally {
    DOM.deleteAccountBtn.disabled = false;
    DOM.deleteAccountBtn.innerHTML = '<i class="fa-solid fa-trash"></i> Delete Account';
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Settings V3 initialised");
