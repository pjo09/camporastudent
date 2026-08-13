// =====================================================
// CAMPORA OWNER SHELL — Shared layout & utilities
// All owner V3 pages import this module.
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

// =====================================================
// AUTH GUARD
// =====================================================

const user = protectPageByRole(["owner"]);
const token = getToken();
if (!user || !token) {
  window.location.href = "login.html";
}

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

export async function apiFetch(endpoint, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// =====================================================
// IMAGE URL FORMATTER
// =====================================================

export function formatImage(path) {
  if (!path) return "https://placehold.co/700x450?text=Campora";
  if (/^(https?:|data:|blob:)/i.test(path)) return path;
  const base = APP_BASE_URL.replace(/\/$/, "") + "/";
  if (path.startsWith("/")) return base.replace(/\/$/, "") + path;
  if (path.startsWith("uploads/")) return base + path;
  return base + "uploads/" + path;
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
  <div>
    <a href="/pages/owner/dashboard.html" class="v3-sidebar-logo">
      <img src="/assets/logos/logo.png" class="v3-logo-img" alt="Campora">
      <div class="v3-logo-text"><h2>Campora</h2><p>Owner Dashboard</p></div>
    </a>
    <nav class="v3-nav" aria-label="Owner navigation">${items}</nav>
  </div>
  <div>
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

  // Render owner info
  renderOwnerInfo();

  // Setup event listeners
  setupShellListeners();

  // Load notification count
  loadNotificationCount();

  // Poll notifications
  setInterval(loadNotificationCount, 60000);
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

export { user, token, API_BASE, APP_BASE_URL, $ };

console.log("✅ Campora Owner Shell initialised");

