// =====================================================
// CAMPORA STUDENT V3 - SHARED UTILITIES
// Central API helper, toast, session, sidebar, topbar
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

// =====================================================
// AUTH GATE
// =====================================================

export function gateStudent() {
  const user = protectPageByRole(["student"]);
  const token = getToken();
  if (!user || !token) {
    window.location.href = "login.html";
    return null;
  }
  return user;
}

export const currentUser = gateStudent();
export const token = getToken();

// =====================================================
// DOM HELPER
// =====================================================

export function $(id) {
  return document.getElementById(id);
}

// =====================================================
// API HELPER
// =====================================================

export async function apiFetch(endpoint, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// =====================================================
// TOAST
// =====================================================

export function showToast(message, type = "info", duration = 3500) {
  const tc = $("toastContainer");
  if (!tc) return;
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info",
  };
  const t = document.createElement("div");
  t.className = `v3-toast v3-toast-${type}`;
  t.setAttribute("role", "alert");
  t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${message}`;
  tc.appendChild(t);
  setTimeout(() => {
    t.classList.add("v3-toast-leaving");
    setTimeout(() => t.remove(), 300);
  }, duration);
}

// =====================================================
// TIME AGO
// =====================================================

export function timeAgo(input) {
  const now = new Date();
  const date = new Date(input);
  const diff = (now - date) / 1000;
  if (Number.isNaN(date.getTime())) return "";
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

// =====================================================
// IMAGE URL
// =====================================================

export function imageUrl(path) {
  if (!path) return "./images/logo.png";
  if (path.startsWith("http") || path.startsWith("data:")) return path;
  return `${API_BASE.replace("/api", "")}/${path.replace(/^\/+/, "")}`;
}

// =====================================================
// CURRENCY
// =====================================================

export function inr(n) {
  return "\u20B9" + Number(n || 0).toLocaleString("en-IN");
}

// =====================================================
// SIDEBAR / TOPBAR INIT
// =====================================================

export function initShell() {
  const user = currentUser;
  if (user) {
    const name = user.name || "Student";
    const first = (name || "S").charAt(0).toUpperCase();
    const initials = $("studentInitials");
    const navbarName = $("navbarName");
    const navbarRole = $("navbarRole");
    const heroName = $("heroName");
    if (initials) initials.textContent = first;
    if (navbarName) navbarName.textContent = name;
    if (navbarRole) navbarRole.textContent = "Student";
    if (heroName) heroName.textContent = name.split(" ")[0];
  }

  // Sidebar toggle
  const menuBtn = $("menuBtn");
  const sidebar = $("sidebar");
  const sidebarBackdrop = $("sidebarBackdrop");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      menuBtn.setAttribute("aria-expanded", sidebar.classList.contains("active"));
      if (sidebarBackdrop) sidebarBackdrop.hidden = !sidebar.classList.contains("active");
    });
    if (sidebarBackdrop) {
      sidebarBackdrop.addEventListener("click", () => {
        sidebar.classList.remove("active");
        menuBtn.setAttribute("aria-expanded", "false");
        sidebarBackdrop.hidden = true;
      });
    }
  }

  // Logout
  const logoutBtn = $("logoutBtn");
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      sessionLogout();
      showToast("Logged out", "info", 1500);
      setTimeout(() => (window.location.href = "login.html"), 500);
    });
  }

  // Profile dropdown
  const profileBtn = $("profileBtn");
  const profileDropdown = $("profileDropdown");
  if (profileBtn && profileDropdown) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      profileDropdown.classList.toggle("active");
    });
    document.addEventListener("click", (e) => {
      if (!profileBtn.contains(e.target) && !profileDropdown.contains(e.target)) {
        profileDropdown.classList.remove("active");
      }
    });
  }

  // Notification bell -> notifications page
const notificationBell = $("notificationBell");
  if (notificationBell) {
    notificationBell.addEventListener("click", () => {
      window.location.href = "notifications.html";
    });
  }
}

// =====================================================
// UNREAD COUNT
// =====================================================

export async function loadUnreadCount() {
  const badge = $("unreadNotifications");
  if (!badge) return;
  try {
    const data = await apiFetch("/student/notifications");
    const count = data.unreadCount || 0;
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  } catch (err) {
    // silent
  }
}

// =====================================================
// ESCAPE
// =====================================================

export function esc(str) {
  const map = {
    "&": "&" + "amp;",
    "<": "&" + "lt;",
    ">": "&" + "gt;",
    '"': "&" + "quot;",
    "'": "&" + "#39;",
  };
  return String(str || "").replace(/[&<>"']/g, (c) => map[c]);
}

window.showToast = showToast;
