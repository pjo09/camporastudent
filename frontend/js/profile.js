// =====================================================
// CAMPORA PROFILE PAGE
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

const $ = (id) => document.getElementById(id);

const DOM = {
  loading: $("profileLoading"),
  error: $("profileError"),
  errorMsg: $("profileErrorMessage"),
  content: $("profileContent"),
  retryBtn: $("retryProfileBtn"),

  avatar: $("profileAvatar"),
  avatarUploadBtn: $("avatarUploadBtn"),
  avatarInput: $("avatarInput"),
  name: $("profileName"),
  role: $("profileRole"),
  email: $("profileEmail"),

  savedCount: $("profileSaved"),
  bookingsCount: $("profileBookings"),
  reviewsCount: $("profileReviews"),
  viewsCount: $("profileViews"),

  personalForm: $("personalForm"),
  nameInput: $("nameInput"),
  emailInput: $("emailInput"),
  phoneInput: $("phoneInput"),
  bioInput: $("bioInput"),

  collegeForm: $("collegeForm"),
  collegeInput: $("collegeInput"),
  courseInput: $("courseInput"),
  yearInput: $("yearInput"),

  emergencyForm: $("emergencyForm"),
  emergencyName: $("emergencyName"),
  emergencyPhone: $("emergencyPhone"),

  passwordForm: $("passwordForm"),
  currentPassword: $("currentPassword"),
  newPassword: $("newPassword"),

  logoutBtn: $("profileLogoutBtn"),
};

const state = {
  user: null,
  token: null,
  profile: null,
};

state.user = protectPageByRole(["student"]);
state.token = getToken();
if (!state.user || !state.token) {}

setupEventListeners();
loadProfile();

function setupEventListeners() {
  DOM.retryBtn?.addEventListener("click", loadProfile);
  DOM.logoutBtn?.addEventListener("click", handleLogout);
  DOM.avatarUploadBtn?.addEventListener("click", () => DOM.avatarInput?.click());
  DOM.avatarInput?.addEventListener("change", uploadAvatar);
  DOM.personalForm?.addEventListener("submit", savePersonal);
  DOM.collegeForm?.addEventListener("submit", saveCollege);
  DOM.emergencyForm?.addEventListener("submit", saveEmergency);
  DOM.passwordForm?.addEventListener("submit", changePassword);
}

async function loadProfile() {
  showLoading();
  hideError();

  try {
    const res = await fetch(`${API}/student/profile`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    state.profile = data.user;
    hideLoading();
    renderProfile(state.profile);

    // Also load stats
    loadStats();
  } catch (err) {
    console.error("Profile load error:", err);
    hideLoading();
    showError(err.message || "Failed to load profile");
  }
}

async function loadStats() {
  try {
    const res = await fetch(`${API}/student/dashboard`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (data.success) {
      const stats = data.statistics || {};
      if (DOM.savedCount) DOM.savedCount.textContent = stats.savedProperties || 0;
      if (DOM.bookingsCount) DOM.bookingsCount.textContent = stats.totalBookings || 0;
      if (DOM.viewsCount) DOM.viewsCount.textContent = stats.viewedProperties || 0;
      if (DOM.reviewsCount) DOM.reviewsCount.textContent = stats.contacts || 0;
    }
  } catch (err) {
    console.error("Stats load error:", err);
  }
}

function renderProfile(u) {
  const name = u.name || "Student";
  const email = u.email || "";
  const avatar = u.profileImage || u.avatar || "./assets/logos/logo.png";

  DOM.avatar.src = avatar;
  DOM.name.textContent = name;
  DOM.role.textContent = "Student";
  DOM.email.textContent = email;

  // Personal form
  DOM.nameInput.value = name;
  DOM.emailInput.value = email;
  DOM.phoneInput.value = u.phone || "";
  DOM.bioInput.value = u.bio || "";

  // College form
  DOM.collegeInput.value = u.college || "";
  DOM.courseInput.value = u.course || "";
  DOM.yearInput.value = u.year || "";

  // Emergency
  const em = u.emergencyContact || {};
  DOM.emergencyName.value = em.name || "";
  DOM.emergencyPhone.value = em.phone || "";
}

async function uploadAvatar(e) {
  const file = e.target.files[0];
  if (!file) return;

  const formData = new FormData();
  formData.append("avatar", file);

  try {
    const res = await fetch(`${API}/upload/avatar`, {
      method: "POST",
      headers: { Authorization: `Bearer ${state.token}` },
      body: formData,
    });
    const data = await res.json();
    if (data.success) {
      DOM.avatar.src = data.url || URL.createObjectURL(file);
      showToast("Avatar updated!", "success");
    }
  } catch (err) {
    console.error("Avatar upload error:", err);
    showToast("Failed to upload avatar", "error");
  }
}

async function savePersonal(e) {
  e.preventDefault();
  const body = {
    name: DOM.nameInput.value.trim(),
    phone: DOM.phoneInput.value.trim(),
    bio: DOM.bioInput.value.trim(),
  };
  if (!body.name) { showToast("Name is required", "error"); return; }

  try {
    const res = await fetch(`${API}/student/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Profile updated!", "success");
      DOM.name.textContent = body.name;
    }
  } catch (err) {
    showToast("Failed to update profile", "error");
  }
}

async function saveCollege(e) {
  e.preventDefault();
  const body = {
    college: DOM.collegeInput.value.trim(),
    course: DOM.courseInput.value.trim(),
    year: DOM.yearInput.value,
  };

  try {
    const res = await fetch(`${API}/student/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) showToast("University details updated!", "success");
  } catch (err) {
    showToast("Failed to update", "error");
  }
}

async function saveEmergency(e) {
  e.preventDefault();
  try {
    const res = await fetch(`${API}/student/profile`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({
        emergencyContact: {
          name: DOM.emergencyName.value.trim(),
          phone: DOM.emergencyPhone.value.trim(),
        },
      }),
    });
    const data = await res.json();
    if (data.success) showToast("Emergency contact saved!", "success");
  } catch (err) {
    showToast("Failed to save", "error");
  }
}

async function changePassword(e) {
  e.preventDefault();
  const current = DOM.currentPassword.value;
  const newPw = DOM.newPassword.value;

  if (!current || !newPw) { showToast("Both fields are required", "error"); return; }
  if (newPw.length < 6) { showToast("Password must be at least 6 characters", "error"); return; }

  try {
    const res = await fetch(`${API}/student/change-password`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ currentPassword: current, newPassword: newPw }),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Password changed successfully!", "success");
      DOM.passwordForm.reset();
    } else {
      showToast(data.message || "Failed to change password", "error");
    }
  } catch (err) {
    showToast("Failed to change password", "error");
  }
}

function handleLogout() {
  sessionLogout();
  showToast("Logged out", "info", 1500);
  setTimeout(() => (window.location.href = "login.html"), 500);
}

function showToast(msg, type = "info", dur = 3000) {
  const tc = document.getElementById("toastContainer");
  if (!tc) return;
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add("toast-leaving"); setTimeout(() => t.remove(), 300); }, dur);
}

function showLoading() { if (DOM.loading) DOM.loading.style.display = "block"; if (DOM.content) DOM.content.style.display = "none"; }
function hideLoading() { if (DOM.loading) DOM.loading.style.display = "none"; if (DOM.content) DOM.content.style.display = "block"; }
function showError(msg) { if (DOM.error) { DOM.error.style.display = "block"; if (DOM.errorMsg) DOM.errorMsg.textContent = msg || "Please try again."; } }
function hideError() { if (DOM.error) DOM.error.style.display = "none"; }

console.log("✅ Profile Page Loaded");

