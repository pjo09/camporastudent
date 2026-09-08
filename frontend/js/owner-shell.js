// =====================================================
// CAMPORA OWNER SHELL — Shared layout & utilities
// All owner V3 pages import this module.
// =====================================================

import { getToken, getUser, getRestoredSupabaseSession, logout as sessionLogout, getLoginUrl } from "./session.js";
import { API } from "./config.js";
import { getImageUrl } from "./image-utils.js";
import { supabase } from "./supabaseClient.js";
import { getTheme, setTheme, toggleTheme, applyTheme, initTheme } from "./theme.js";

// =====================================================
// AUTH GUARD & LIVE DB VERIFICATION
// =====================================================

async function retryGetProfile(user, retries = 3) {
  const { supabaseAPI } = await import("./supabase-api.js");
  let lastErr = null;
  for (let i = 0; i < retries; i++) {
    try {
      const profile = await supabaseAPI.ensureUserProfile(user, "owner");
      if (profile) return profile;
    } catch (err) {
      lastErr = err;
      const status = err?.status || err?.statusCode || err?.code;
      if (status === 401 || status === 403) throw err; // Don't retry auth rejections
      if (i < retries - 1) {
        await new Promise((res) => setTimeout(res, 500 * (i + 1)));
      }
    }
  }
  throw lastErr;
}

export async function verifyLiveOwnerAuth() {
  try {
    const session = await getRestoredSupabaseSession(2500);

    if (!session || !session.user) {
      const localUser = getUser();
      const localToken = getToken();
      if (localUser && localToken && localUser.role === "owner") {
        if (localUser.accountStatus === "BANNED" || localUser.accountStatus === "DELETED" || localUser.accountStatus === "REJECTED") {
          sessionLogout();
          return null;
        }
        return localUser;
      }
      // Confirmed unauthenticated: redirect to login
      const currentUrl = window.location.pathname + window.location.search;
      window.location.href = `${getLoginUrl()}?redirectTo=${encodeURIComponent(currentUrl)}`;
      return null;
    }

    let profile = null;
    try {
      profile = await retryGetProfile(session.user, 3);
    } catch (profError) {
      console.warn("⚠️ [Owner Shell] Profile lookup warning:", profError?.message || profError);
      // Fallback to local session user if transient error, do NOT logout!
      const localUser = getUser();
      if (localUser && (localUser.role === "owner" || !localUser.role)) {
        return localUser;
      }
    }

    if (!profile) {
      const localUser = getUser();
      if (localUser && localUser.role === "owner") return localUser;
      return null;
    }

    if (profile.role !== "owner") {
      if (profile.role === "student") {
        window.location.href = "/pages/student/dashboard.html";
      } else if (profile.role === "admin") {
        window.location.href = "/pages/admin/dashboard.html";
      } else {
        window.location.href = getLoginUrl();
      }
      return null;
    }

    if (profile.account_status === "BANNED" || profile.account_status === "DELETED" || profile.account_status === "REJECTED") {
      sessionLogout();
      return null;
    }

    return profile;
  } catch (e) {
    console.warn("⚠️ [Owner Shell] Authentication guard notice:", e?.message || e);
    const localUser = getUser();
    if (localUser && localUser.role === "owner") return localUser;
    return null;
  }
}

verifyLiveOwnerAuth();

// =====================================================
// CONFIGS
// =====================================================

const API_BASE = API;
const APP_BASE_URL = API_BASE.replace(/\/api$/, "");

// =====================================================
// DOM HELPERS
// =====================================================

const $ = (id) => document.getElementById(id);

// =====================================================
// TOAST SYSTEM
// =====================================================

let toastContainer = null;

function ensureToastContainer() {
  if (!toastContainer) {
    toastContainer = $("toastContainer");
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.id = "toastContainer";
      toastContainer.className = "v3-toast-container";
      toastContainer.setAttribute("aria-live", "polite");
      toastContainer.setAttribute("aria-atomic", "true");
      document.body.appendChild(toastContainer);
    }
  }
  return toastContainer;
}

export function showToast(message, type = "info", duration = 3500) {
  const tc = ensureToastContainer();
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info", warning: "fa-triangle-exclamation" };
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
// API FETCH HELPER
// =====================================================

import { supabaseAPI } from "./supabase-api.js";

export async function apiFetch(endpoint, opts = {}) {
  const method = (opts.method || "GET").toUpperCase();

  const cleanPath = endpoint.split("?")[0].replace(/\/+$/, "") || "/";

  // Supabase Native Interceptor for Owner Routes
  if (cleanPath === "/owner/profile" && method === "GET") {
    return await supabaseAPI.getOwnerProfile();
  }
  if (cleanPath === "/owner/profile" && method === "PUT") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.updateOwnerProfile(payload);
  }
  if (cleanPath === "/owner/profile" && method === "DELETE") {
    return await supabaseAPI.deleteAccount();
  }
  if (cleanPath === "/owner/change-password" && method === "PUT") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.changePassword(payload.newPassword);
  }
  if ((cleanPath === "/notifications/unread" || cleanPath === "/owner/notifications/unread") && method === "GET") {
    return await supabaseAPI.getUnreadNotificationCount();
  }
  if ((cleanPath === "/owner/dashboard" || cleanPath === "/owner/dashboard-v3") && method === "GET") {
    return await supabaseAPI.getOwnerDashboardStats();
  }
  if ((cleanPath === "/owner/properties" || cleanPath === "/properties") && method === "GET") {
    return await supabaseAPI.getOwnerProperties();
  }
  if ((cleanPath === "/owner/properties" || cleanPath === "/properties/create" || cleanPath === "/properties") && method === "POST") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.createOwnerProperty(payload);
  }
  if (cleanPath.startsWith("/owner/properties/") || cleanPath.startsWith("/properties/")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const propId = parts.length >= 3 ? parts[2] : parts[parts.length - 1];
    const subAction = parts[parts.length - 1];

    if (subAction === "publish" || subAction === "unpublish") {
      return await supabaseAPI.toggleOwnerPropertyPublish(propId);
    }
    if (subAction === "duplicate" && method === "POST") {
      return await supabaseAPI.duplicateOwnerProperty(propId);
    }
    if (subAction === "resident-invite" && method === "POST") {
      return await supabaseAPI.createResidentInvite(propId);
    }
    if (method === "GET") {
      return await supabaseAPI.getPropertyById(propId);
    }
    if (method === "PUT" || method === "PATCH") {
      const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
      return await supabaseAPI.updateOwnerProperty(propId, payload);
    }
    if (method === "DELETE") {
      return await supabaseAPI.deleteOwnerProperty(propId);
    }
  }
  if (cleanPath === "/owner/bookings" && method === "GET") {
    return await supabaseAPI.getOwnerBookings();
  }
  if ((cleanPath === "/owner/residents" || cleanPath === "/owner/students") && method === "GET") {
    return await supabaseAPI.getOwnerResidents();
  }
  if ((cleanPath === "/owner/resident-requests" || cleanPath.startsWith("/owner/resident-requests")) && method === "GET") {
    return await supabaseAPI.getOwnerResidentRequests();
  }
  if (cleanPath.startsWith("/owner/resident-requests/") && cleanPath.endsWith("/approve") && method === "POST") {
    const requestId = cleanPath.split("/")[3];
    return await supabaseAPI.approveResidentRequest(requestId);
  }
  if (cleanPath.startsWith("/owner/resident-requests/") && cleanPath.endsWith("/reject") && method === "POST") {
    const requestId = cleanPath.split("/")[3];
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.rejectResidentRequest(requestId, payload.reason || "");
  }
  if (cleanPath === "/owner/notifications" && method === "GET") {
    return await supabaseAPI.getOwnerNotifications();
  }
  if (cleanPath === "/owner/announcements" && method === "GET") {
    return await supabaseAPI.getOwnerAnnouncements();
  }
  if (cleanPath === "/owner/maintenance" && method === "GET") {
    return await supabaseAPI.getOwnerMaintenances();
  }
  if ((cleanPath.startsWith("/owner/maintenance/stats") || cleanPath.startsWith("/owner/maintenance/summary")) && method === "GET") {
    return await supabaseAPI.getOwnerMaintenanceStats();
  }
  if ((cleanPath === "/owner/booking-statistics" || cleanPath.startsWith("/owner/bookings/stats") || cleanPath.startsWith("/owner/booking-stats")) && method === "GET") {
    return await supabaseAPI.getOwnerBookingStats();
  }
  if ((cleanPath.startsWith("/owner/messages/unread") || cleanPath === "/owner/messages/unread-count") && method === "GET") {
    return await supabaseAPI.getOwnerUnreadMessagesCount();
  }
  if ((cleanPath === "/owner/messages/broadcast" || cleanPath.startsWith("/owner/messages/broadcast")) && method === "POST") {
    const payload = opts.body ? (typeof opts.body === "string" ? JSON.parse(opts.body) : opts.body) : {};
    return await supabaseAPI.sendOwnerBroadcast(payload);
  }
  if ((endpoint === "/owner/analytics" || endpoint === "/owner/top-properties" || endpoint === "/owner/earnings" || endpoint === "/owner/finance/summary") && method === "GET") {
    return await supabaseAPI.getOwnerAnalytics();
  }

  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;

  let res;
  try {
    res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });
  } catch (netErr) {
    if (method === "GET") {
      // Retry once on HTTP/2 ping failure or transient network reset for safe GET requests only
      console.warn(`[apiFetch] Safe GET network drop detected (${netErr.message}). Retrying request...`);
      await new Promise((r) => setTimeout(r, 300));
      res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });
    } else {
      throw netErr;
    }
  }

  const contentType = res.headers.get("content-type") || "";
  let data;
  if (contentType.includes("application/json")) {
    try {
      data = await res.json();
    } catch (e) {
      throw new Error(`API request failed: ${method} ${endpoint} returned invalid JSON (HTTP ${res.status})`);
    }
  } else {
    await res.text();
    throw new Error(`API request failed: ${method} ${endpoint} returned HTTP ${res.status}`);
  }

  if (!res.ok || (data && data.success === false)) {
    throw new Error((data && data.message) || `API request failed: ${method} ${endpoint} returned HTTP ${res.status}`);
  }
  return data;
}

// =====================================================
// IMAGE URL FORMATTER
// =====================================================

export function formatImage(path) {
  return getImageUrl(path, "/assets/images/property-placeholder.jpg");
}

// =====================================================
// DATE FORMATTERS
// =====================================================

export function formatDate(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(dateStr) {
  if (!dateStr) return "";
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diff = Math.floor((now - then) / 1000);
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  return formatDate(dateStr);
}

// =====================================================
// CURRENCY FORMAT
// =====================================================

export function formatCurrency(amount) {
  if (amount == null || isNaN(amount)) return "₹0";
  return "₹" + Number(amount).toLocaleString("en-IN");
}

// =====================================================
// SIDEBAR HTML
// =====================================================

function sidebarHTML(currentPage) {
  const navItems = [
    { href: "/pages/owner/dashboard.html", icon: "fa-house", label: "Dashboard", id: "dashboard" },
    { href: "/pages/owner/properties.html", icon: "fa-building", label: "My Properties", id: "properties" },
    { href: "/pages/owner/add-property.html", icon: "fa-plus", label: "Add Property", id: "add-property" },
    { href: "/pages/owner/bookings.html", icon: "fa-calendar-check", label: "Bookings", id: "bookings" },
    { href: "/pages/owner/residents.html", icon: "fa-user-graduate", label: "Residents", id: "residents" },
    { href: "/pages/owner/messages.html", icon: "fa-comments", label: "Messages", id: "messages" },
    { href: "/pages/owner/announcements.html", icon: "fa-bullhorn", label: "Announcements", id: "announcements" },
    { href: "/pages/owner/maintenance.html", icon: "fa-screwdriver-wrench", label: "Maintenance", id: "maintenance" },
    { href: "/pages/owner/payments.html", icon: "fa-indian-rupee-sign", label: "Payments", id: "payments" },
    { href: "/pages/owner/analytics.html", icon: "fa-chart-line", label: "Analytics", id: "analytics" },
    { href: "/pages/owner/reviews.html", icon: "fa-star", label: "Reviews", id: "reviews" },
    { href: "/pages/owner/notifications.html", icon: "fa-bell", label: "Notifications", id: "notifications" },
    { href: "/pages/owner/settings.html", icon: "fa-gear", label: "Settings", id: "settings" },
  ];

  const items = navItems.map((item) => {
    const active = item.href === currentPage || (currentPage === "/pages/owner/add-property.html" && item.href === "/pages/owner/add-property.html") ? "active" : "";
    return `<a class="v3-nav-item ${active}" href="${item.href}" data-nav="${item.id}">
      <i class="fa-solid ${item.icon}"></i><span>${item.label}</span>
    </a>`;
  }).join("");

  return `
<aside class="v3-sidebar" id="sidebar">
  <div class="v3-sidebar-top">
    <a href="/pages/owner/dashboard.html" class="v3-sidebar-logo">
      <img src="/assets/logos/logo.png" class="v3-logo-img" alt="Campora">
      <div class="v3-logo-text"><h2>Campora</h2><p>Owner Dashboard</p></div>
    </a>
    <nav class="v3-nav" aria-label="Owner navigation">${items}</nav>
  </div>
  <div class="v3-sidebar-bottom">
    <div class="v3-theme-switcher-box">
      <span class="v3-theme-label"><i class="fa-solid fa-circle-half-stroke"></i> Appearance</span>
      <button id="themeToggleBtn" type="button" class="v3-theme-toggle-btn" aria-label="Toggle light and dark mode" tabindex="0">
        <span class="v3-theme-opt opt-light"><i class="fa-solid fa-sun"></i> Light</span>
        <span class="v3-theme-opt opt-dark"><i class="fa-solid fa-moon"></i> Dark</span>
      </button>
    </div>
    <button id="logoutBtn" class="v3-logout" type="button"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
  </div>
</aside>`;
}

// =====================================================
// TOPBAR HTML
// =====================================================

function topbarHTML(pageTitle) {
  return `
<header class="v3-topbar" role="banner">
  <div class="v3-top-left">
    <button id="menuBtn" class="v3-menu-btn" type="button" aria-label="Open menu" aria-expanded="false">
      <i class="fa-solid fa-bars"></i>
    </button>
    <h1>${pageTitle}</h1>
  </div>
  <div class="v3-top-right">
    <button class="v3-icon-btn" id="notificationBell" type="button" aria-label="Notifications">
      <i class="fa-solid fa-bell"></i>
      <span class="v3-badge" id="unreadNotifications" style="display:none">0</span>
    </button>
    <div class="v3-profile" id="ownerProfileBtn" role="button" tabindex="0" aria-label="Profile menu">
      <div class="v3-avatar" id="ownerAvatar">O</div>
      <div>
        <h4 id="ownerName">Loading...</h4>
        <p>PG Owner</p>
      </div>
    </div>
  </div>
</header>`;
}

// =====================================================
// PROFILE DROPDOWN HTML
// =====================================================

function profileDropdownHTML() {
  return `
<div class="v3-profile-dropdown" id="profileDropdown" style="display:none">
  <a href="/pages/owner/settings.html" class="v3-dropdown-item"><i class="fa-solid fa-user"></i> Profile Settings</a>
  <a href="/pages/owner/dashboard.html" class="v3-dropdown-item"><i class="fa-solid fa-house"></i> Dashboard</a>
  <a href="/pages/owner/settings.html" class="v3-dropdown-item"><i class="fa-solid fa-gear"></i> Settings</a>
  <hr style="border-color:rgba(255,255,255,.08);margin:8px 0">
  <button id="profileLogoutBtn" class="v3-dropdown-item" style="color:#ef4444;width:100%;text-align:left;border:none;background:none;font-family:inherit;cursor:pointer"><i class="fa-solid fa-right-from-bracket"></i> Logout</button>
</div>`;
}

// =====================================================
// NOTIFICATION PANEL
// =====================================================

export async function loadNotificationCount() {
  const badge = $("unreadNotifications");
  if (!badge) return;
  try {
    const data = await apiFetch("/notifications/unread");
    const count = data.count || 0;
    if (count > 0) {
      badge.textContent = count > 99 ? "99+" : count;
      badge.style.display = "";
    } else {
      badge.style.display = "none";
    }
  } catch { /* silent */ }
}

// =====================================================
// INIT SHELL — Call from every owner page
// =====================================================

export function initShell(pageTitle = "Dashboard") {
  // Prevent double-init
  if (document.querySelector(".v3-sidebar")) return;

  const currentPage = window.location.pathname.split("/").pop() || "/pages/owner/dashboard.html";

  // Apply theme early
  initTheme();

  // Inject sidebar
  const sidebarEl = document.createElement("div");
  sidebarEl.innerHTML = sidebarHTML(currentPage);
  document.body.insertBefore(sidebarEl.firstElementChild, document.body.firstChild);

  // Inject wrapper if not present
  const wrapper = document.querySelector(".v3-wrapper");
  if (!wrapper) {
    const mainContent = $("mainContent") || document.querySelector("main") || document.querySelector(".v3-content");
    const wrapperDiv = document.createElement("div");
    wrapperDiv.className = "v3-wrapper";
    if (mainContent) {
      mainContent.parentNode.insertBefore(wrapperDiv, mainContent);
      wrapperDiv.appendChild(mainContent);
    } else {
      document.body.appendChild(wrapperDiv);
    }
  }

  // Inject topbar
  const topbarEl = document.createElement("div");
  topbarEl.innerHTML = topbarHTML(pageTitle);
  const wrapperEl = document.querySelector(".v3-wrapper");
  wrapperEl.insertBefore(topbarEl.firstElementChild, wrapperEl.firstChild);

  // Inject profile dropdown
  const pdEl = document.createElement("div");
  pdEl.innerHTML = profileDropdownHTML();
  document.body.appendChild(pdEl.firstElementChild);

  // Re-init theme bindings after DOM elements injected
  initTheme();

  // Render owner info
  renderOwnerInfo();

  if (user && (user.accountStatus === "PENDING" || user.account_status === "PENDING")) {
    renderPendingBanner();
  }

  // Setup event listeners
  setupShellListeners();

  // Load notification count
  loadNotificationCount();

  // Poll notifications
  setInterval(loadNotificationCount, 60000);
}

function renderPendingBanner() {
  if (document.querySelector(".v3-pending-banner")) return;
  const mainContent = $("mainContent") || document.querySelector("main") || document.querySelector(".v3-content");
  if (!mainContent) return;

  const banner = document.createElement("div");
  banner.className = "v3-pending-banner";
  banner.style.cssText = "background:rgba(234,179,8,0.12);border:1px solid rgba(234,179,8,0.3);color:var(--v3-text,#f8fafc);padding:14px 20px;border-radius:12px;margin:0 0 20px 0;display:flex;align-items:center;gap:12px";
  banner.innerHTML = `
    <i class="fa-solid fa-clock-rotate-left" style="color:#eab308;font-size:20px"></i>
    <div>
      <strong style="font-size:14px;color:#eab308">Account Verification Pending</strong>
      <p style="font-size:13px;margin:2px 0 0 0;color:var(--v3-muted,#94a3b8)">Your PG Owner account is pending administrative verification. You can draft, add properties, and submit them for moderation.</p>
    </div>
  `;
  mainContent.insertBefore(banner, mainContent.firstChild);
}

// =====================================================
// RENDER OWNER INFO
// =====================================================

function renderOwnerInfo() {
  if (!user) return;
  const nameEl = $("ownerName");
  const avatarEl = $("ownerAvatar");
  if (nameEl) nameEl.textContent = user.name || "Owner";
  if (avatarEl) avatarEl.textContent = (user.name || "O").charAt(0).toUpperCase();
}

// =====================================================
// SETUP EVENT LISTENERS
// =====================================================

let shellListenersSetup = false;

function setupShellListeners() {
  if (shellListenersSetup) return;
  shellListenersSetup = true;

  // Logout buttons
  const logoutBtn = $("logoutBtn");
  const profileLogoutBtn = $("profileLogoutBtn");

  const handleLogout = () => {
    sessionLogout();
  };

  logoutBtn?.addEventListener("click", handleLogout);
  profileLogoutBtn?.addEventListener("click", handleLogout);

  // Sidebar toggle
  const menuBtn = $("menuBtn");
  const sidebar = $("sidebar");
  if (menuBtn && sidebar) {
    menuBtn.addEventListener("click", () => {
      sidebar.classList.toggle("active");
      menuBtn.setAttribute("aria-expanded", sidebar.classList.contains("active"));
    });
  }

  // Close sidebar on click outside
  document.addEventListener("click", (e) => {
    if (sidebar && sidebar.classList.contains("active")) {
      if (!sidebar.contains(e.target) && e.target !== menuBtn && !menuBtn?.contains(e.target)) {
        sidebar.classList.remove("active");
        menuBtn?.setAttribute("aria-expanded", "false");
      }
    }
  });

  // Profile dropdown toggle
  const profileBtn = $("ownerProfileBtn");
  const dropdown = $("profileDropdown");
  if (profileBtn && dropdown) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const isVisible = dropdown.style.display !== "none";
      dropdown.style.display = isVisible ? "none" : "block";
      dropdown.style.position = "absolute";
      dropdown.style.top = "70px";
      dropdown.style.right = "32px";
      dropdown.style.zIndex = "9999";
    });

    document.addEventListener("click", (e) => {
      if (!dropdown.contains(e.target) && e.target !== profileBtn && !profileBtn.contains(e.target)) {
        dropdown.style.display = "none";
      }
    });
  }

  // Notification bell
  const notifBell = $("notificationBell");
  if (notifBell) {
    notifBell.addEventListener("click", () => {
      window.location.href = "/pages/owner/notifications.html";
    });
  }
}

// =====================================================
// EXPOSE for page-level use
// =====================================================

export { user, token, API_BASE, APP_BASE_URL, $, getTheme, setTheme, toggleTheme, applyTheme, initTheme };

console.log("✅ Campora Owner Shell initialised");
