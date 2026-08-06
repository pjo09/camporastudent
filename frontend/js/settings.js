// =====================================================
// CAMPORA SETTINGS PAGE
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

const $ = (id) => document.getElementById(id);

const DOM = {
  emailNotif: $("emailNotif"),
  smsNotif: $("smsNotif"),
  pushNotif: $("pushNotif"),
  languageSelect: $("languageSelect"),
  currencySelect: $("currencySelect"),
  darkModeToggle: $("darkModeToggle"),
  profileVisibility: $("profileVisibility"),
  contactVisibility: $("contactVisibility"),
  saveBtn: $("saveSettingsBtn"),
  deleteBtn: $("deleteAccountBtn"),
};

const state = {
  user: null,
  token: null,
};

state.user = protectPageByRole(["student"]);
state.token = getToken();
if (!state.user || !state.token) {}

// Load saved preferences from localStorage
loadPreferences();

DOM.saveBtn?.addEventListener("click", saveSettings);
DOM.deleteBtn?.addEventListener("click", deleteAccount);

function loadPreferences() {
  try {
    const prefs = JSON.parse(localStorage.getItem("camporaSettings") || "{}");
    if (DOM.emailNotif) DOM.emailNotif.checked = prefs.emailNotif !== false;
    if (DOM.smsNotif) DOM.smsNotif.checked = prefs.smsNotif !== false;
    if (DOM.pushNotif) DOM.pushNotif.checked = prefs.pushNotif !== false;
    if (DOM.profileVisibility) DOM.profileVisibility.checked = prefs.profileVisibility !== false;
    if (DOM.contactVisibility) DOM.contactVisibility.checked = prefs.contactVisibility !== false;
    if (DOM.languageSelect) DOM.languageSelect.value = prefs.language || "en";
    if (DOM.currencySelect) DOM.currencySelect.value = prefs.currency || "INR";
  } catch (err) {
    console.error("Load prefs error:", err);
  }
}

function saveSettings() {
  const settings = {
    emailNotif: DOM.emailNotif?.checked ?? true,
    smsNotif: DOM.smsNotif?.checked ?? true,
    pushNotif: DOM.pushNotif?.checked ?? true,
    profileVisibility: DOM.profileVisibility?.checked ?? true,
    contactVisibility: DOM.contactVisibility?.checked ?? true,
    language: DOM.languageSelect?.value || "en",
    currency: DOM.currencySelect?.value || "INR",
    darkMode: DOM.darkModeToggle?.checked ?? false,
  };

  localStorage.setItem("camporaSettings", JSON.stringify(settings));
  showToast("Settings saved!", "success");

  // Also sync with backend notification preferences
  syncNotificationSettings(settings);
}

async function syncNotificationSettings(settings) {
  try {
    await fetch(`${API}/student/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({
        notificationSettings: {
          email: settings.emailNotif,
          sms: settings.smsNotif,
          push: settings.pushNotif,
        },
      }),
    });
  } catch (err) {
    console.error("Sync settings error:", err);
  }
}

function deleteAccount() {
  if (!confirm("Are you sure you want to delete your account? This action cannot be undone!")) return;
  if (!confirm("All your data will be permanently lost. Continue?")) return;

  const btn = DOM.deleteBtn;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
  }

  showToast("Deleting account...", "info");

  // Call backend to actually delete the account
  fetch(`${API}/student/profile`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${state.token}` },
  })
    .then(async (res) => {
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.message || "Failed to delete account");
      }
      // Clear local session
      sessionLogout();
      showToast("Account deleted. Goodbye!", "success");
      setTimeout(() => (window.location.href = "index.html"), 1500);
    })
    .catch((err) => {
      console.error("Delete account error:", err);
      showToast(err.message || "Failed to delete account", "error");
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Delete Account";
      }
    });
}

function showToast(msg, type = "info") {
  const tc = document.getElementById("toastContainer");
  if (!tc) return;
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add("toast-leaving"); setTimeout(() => t.remove(), 300); }, 3000);
}

console.log("✅ Settings Page Loaded");

