// =====================================================
// CAMPORA STUDENT V3 - SHARED UTILITIES
// Central API helper, toast, session, sidebar, topbar
// =====================================================

import { getToken, getUser, getRestoredSupabaseSession, protectPageByRole, logout as sessionLogout, getLoginUrl } from "./session.js";
import { API } from "./config.js";
import { getImageUrl } from "./image-utils.js";
import { supabaseAPI } from "./supabase-api.js";

import { supabase } from "./supabaseClient.js";

const API_BASE = API;

// =====================================================
// AUTH GATE & LIVE DB VERIFICATION
// =====================================================

export async function verifyLiveStudentAuth() {
  try {
    const session = await getRestoredSupabaseSession(2500);
    if (!session || !session.user) {
      const localUser = getUser();
      const localToken = getToken();
      if (localUser && localToken && (localUser.role === "student" || !localUser.role)) {
        if (localUser.accountStatus === "BANNED" || localUser.accountStatus === "DELETED" || localUser.accountStatus === "REJECTED") {
          sessionLogout();
          return null;
        }
        return localUser;
      }
      return null;
    }

    let profile = null;
    try {
      const { data: pById, error: errById } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", session.user.id)
        .maybeSingle();

      if (pById) {
        profile = pById;
      } else if (session.user.email) {
        const { data: pByEmail } = await supabase
          .from("profiles")
          .select("*")
          .eq("email", session.user.email)
          .maybeSingle();
        if (pByEmail) profile = pByEmail;
      }

      if (!profile) {
        profile = await supabaseAPI.ensureUserProfile(session.user, "student").catch(() => null);
      }
    } catch (profErr) {
      console.warn("⚠️ [Student Utils] Profile lookup warning:", profErr?.message || profErr);
    }

    // Fallback to local cached user if profile fetch failed transiently
    if (!profile) {
      const localUser = getUser();
      if (localUser && (localUser.role === "student" || !localUser.role)) return localUser;
      return null;
    }

    if (profile.account_status === "BANNED" || profile.account_status === "DELETED" || profile.status === "inactive" || profile.account_status === "REJECTED") {
      sessionLogout();
      return null;
    }

    if (profile.role === "owner") {
      if (profile.account_status === "PENDING") {
        sessionLogout();
        window.location.href = getLoginUrl() + "?pending=true";
      } else {
        window.location.href = "/pages/owner/dashboard.html";
      }
      return null;
    }

    if (profile.role === "admin") {
      window.location.href = "/pages/admin/dashboard.html";
      return null;
    }

    return profile;
  } catch (e) {
    console.warn("⚠️ [Student Utils] Authentication notice:", e?.message || e);
    const localUser = getUser();
    if (localUser && (localUser.role === "student" || !localUser.role)) return localUser;
    return null;
  }
}

export function gateStudent() {
  const path = (window.location.pathname || "").toLowerCase();
  const isPublicPage = path.includes("properties") ||
                       path.includes("property-details") ||
                       path.includes("nearby") ||
                       path.includes("index") ||
                       path.includes("forgot-password") ||
                       path.includes("login") ||
                       path.includes("register") ||
                       path === "/" ||
                       path === "";

  const user = getUser();
  const token = getToken();

  if (isPublicPage) {
    if (user && token && (user.role === "student" || !user.role)) {
      verifyLiveStudentAuth();
    }
    return user || null;
  }

  const roleUser = protectPageByRole(["student"]);
  if (!roleUser && !token) {
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = getLoginUrl() + "?redirectTo=" + encodeURIComponent(currentUrl);
    return null;
  }
  verifyLiveStudentAuth();
  return roleUser || user;
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
  const method = (opts.method || "GET").toUpperCase();

  // Supabase Native Interceptor for Student & Public Routes
  if (endpoint === "/student/dashboard-v3" || endpoint === "/student/dashboard") {
    return await supabaseAPI.getStudentDashboardStats();
  }
  if (endpoint.startsWith("/properties/search")) {
    const queryStr = endpoint.includes("?") ? endpoint.split("?")[1] : "";
    const params = Object.fromEntries(new URLSearchParams(queryStr).entries());
    return await supabaseAPI.searchProperties(params);
  }
  if (endpoint.startsWith("/properties/") && !endpoint.includes("/search") && !endpoint.includes("/save/")) {
    const propId = endpoint.split("?")[0].split("/")[2];
    const property = await supabaseAPI.getProperty(propId);
    if (property) {
      property.propertyName = property.propertyName || property.property_name;
    }
    return { property, currentResidentsCount: 0, verifiedStaysCount: 0 };
  }
  if (endpoint.startsWith("/reviews/") && method === "GET") {
    const propId = endpoint.split("?")[0].split("/")[2];
    const reviews = await supabaseAPI.getPropertyReviews(propId);
    return { success: true, reviews };
  }
  if (endpoint === "/student/finance/summary") {
    return await supabaseAPI.getStudentFinanceSummary();
  }
  if (endpoint === "/student/finance/invoices") {
    return await supabaseAPI.getStudentInvoices();
  }
  if (endpoint === "/student/messages/conversations") {
    return await supabaseAPI.getStudentConversations();
  }
  if (endpoint.startsWith("/student/messages/conversation/") && endpoint.endsWith("/messages")) {
    const parts = endpoint.split("/");
    const convId = parts[4];
    return await supabaseAPI.getStudentMessages(convId);
  }
  if (endpoint.startsWith("/student/messages/conversation/") && endpoint.endsWith("/send")) {
    const parts = endpoint.split("/");
    const convId = parts[4];
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.sendStudentMessage(convId, payload.message || payload.content || "");
  }
  if (endpoint === "/residents/requests" && method === "POST") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.createResidentRequest(payload);
  }
  if (endpoint === "/student/maintenance" && method === "GET") {
    return await supabaseAPI.getStudentMaintenances();
  }
  if (endpoint === "/student/maintenance" && method === "POST") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.createStudentMaintenance(payload);
  }
  if (endpoint === "/student/documents") {
    return await supabaseAPI.getStudentDocuments();
  }
  if (endpoint === "/student/analytics") {
    return await supabaseAPI.getStudentAnalytics();
  }
  if (endpoint === "/student/announcements") {
    return await supabaseAPI.getOwnerAnnouncements();
  }
  if (endpoint === "/student/notifications" && method === "GET") {
    return await supabaseAPI.getStudentNotifications();
  }
  if (endpoint.startsWith("/student/notifications/") && endpoint.endsWith("/read") && method === "PUT") {
    const id = endpoint.split("/")[3];
    return await supabaseAPI.markNotificationRead(id);
  }
  if (endpoint === "/student/notifications/read-all" && method === "PUT") {
    return await supabaseAPI.markAllNotificationsRead();
  }
  if ((endpoint === "/student/profile" || endpoint === "/pages/student/profile") && method === "DELETE") {
    return await supabaseAPI.deleteAccount();
  }
  if (endpoint === "/student/profile" && method === "GET") {
    return await supabaseAPI.getStudentProfile();
  }
  if (endpoint === "/student/profile" && method === "PUT") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.updateStudentProfile(payload);
  }
  if (endpoint === "/student/change-password" && method === "PUT") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.changePassword(payload.newPassword);
  }
  if (endpoint === "/student/bookings" && method === "GET") {
    const bookings = await supabaseAPI.getMyBookings();
    return { success: true, bookings };
  }
  if (endpoint.startsWith("/properties/save/") && endpoint.endsWith("/check") && method === "GET") {
    const propId = endpoint.split("/")[3];
    return await supabaseAPI.isSavedProperty(propId);
  }
  if (endpoint.startsWith("/properties/save/") && (method === "POST" || method === "DELETE")) {
    const propId = endpoint.split("/")[3];
    return await supabaseAPI.toggleFavorite(propId);
  }
  if (endpoint.startsWith("/student/saved/") && (method === "POST" || method === "DELETE")) {
    const propId = endpoint.split("/")[3];
    return await supabaseAPI.toggleFavorite(propId);
  }
  if (endpoint === "/student/saved" && method === "GET") {
    return await supabaseAPI.getSavedProperties();
  }

  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  const currentToken = getToken();
  if (currentToken) headers.Authorization = `Bearer ${currentToken}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });

  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (e) {
      const error = new Error(`API request failed: ${method} ${endpoint} returned invalid JSON (HTTP ${res.status})`);
      error.status = res.status;
      throw error;
    }
  } else {
    await res.text();
    const error = new Error(`API request failed: ${method} ${endpoint} returned HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }

  if (!res.ok || (data && data.success === false)) {
    const error = new Error((data && data.message) || `API request failed: ${method} ${endpoint} returned HTTP ${res.status}`);
    error.status = res.status;
    throw error;
  }
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
  return getImageUrl(path, "/assets/images/property-placeholder.jpg");
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
    logoutBtn.addEventListener("click", (e) => {
      e.preventDefault();
      sessionLogout();
    });
  }

  // Profile dropdown logout link (fallback bind so it never navigates to login.html)
  const dropdownLogout = $("dropdownLogout");
  if (dropdownLogout) {
    dropdownLogout.addEventListener("click", (e) => {
      e.preventDefault();
      sessionLogout();
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
