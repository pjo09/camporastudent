// =====================================================
// CAMPORA STUDENT V3 - SETTINGS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, showToast } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  $("passwordForm")?.addEventListener("submit", changePassword);
  $("deleteAccountBtn")?.addEventListener("click", deleteAccount);
});

async function changePassword(e) {
  e.preventDefault();
  const btn = $("changePwdBtn");
  if (!btn) return;
  const current = $("currentPassword")?.value;
  const next = $("newPassword")?.value;
  const confirm = $("confirmPassword")?.value;

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

  btn.disabled = true;
  try {
    await apiFetch("/student/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword: current, newPassword: next }),
    });
    showToast("Password changed successfully", "success");
    e.target.reset();
  } catch (err) {
    showToast(err.message || "Unable to change password", "error");
  } finally {
    btn.disabled = false;
  }
}

async function deleteAccount() {
  if (!confirm("Are you sure you want to permanently delete your account? This cannot be undone.")) return;
  const btn = $("deleteAccountBtn");
  if (!btn) return;
  btn.disabled = true;
  try {
    await apiFetch("/student/profile", { method: "DELETE" });
    localStorage.removeItem("camporaToken");
    localStorage.removeItem("camporaUser");
    localStorage.removeItem("camporauser");
    window.location.href = "login.html";
  } catch (err) {
    showToast(err.message || "Unable to delete account", "error");
    btn.disabled = false;
  }
}
