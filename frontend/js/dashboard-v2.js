// ================================================
// CAMPORA STUDENT DASHBOARD V2
// Full production-quality rewrite
// ================================================

import {
  getToken,
  getUser,
  protectPageByRole,
  logout as sessionLogout,
} from "./session.js";
import { API } from "./config.js";
import { getImageUrl } from "./image-utils.js";

const API_BASE = API;

// ================================================
// DOM CACHE
// ================================================

const $ = (id) => document.getElementById(id);

const DOM = {
  // Sidebar
  sidebar: $("sidebar"),
  menuBtn: $("menuBtn"),
  sidebarBackdrop: $("sidebarBackdrop"),
  logoutBtn: $("logoutBtn"),

  // Topbar
  searchInput: $("searchInput"),
  notificationBtn: $("notificationBtn"),
  notificationDot: $("notificationDot"),
  profileBtn: $("profileBtn"),
  avatar: $("avatar"),
  username: $("username"),

  // Hero
  heroUsername: $("heroUsername"),

  // Stats
  savedCount: $("savedCount"),
  bookingCount: $("bookingCount"),
  viewedCount: $("viewedCount"),
  contactCount: $("contactCount"),
  unreadBadge: $("unreadBadge"),

  // Properties
  filterBar: document.querySelector(".filter-bar"),
  filterBtns: document.querySelectorAll(".filter-btn"),
  sortSelect: $("sortSelect"),
  propertyGrid: $("propertyGrid"),
  propertySkeleton: $("propertySkeleton"),
  propertyError: $("propertyError"),
  propertyPagination: $("propertyPagination"),
  prevPage: $("prevPage"),
  nextPage: $("nextPage"),
  pageInfo: $("pageInfo"),

  // Bookings
  bookingGrid: $("bookingGrid"),
  bookingSkeleton: $("bookingSkeleton"),
  bookingError: $("bookingError"),

  // Notifications
  notificationList: $("notificationList"),
  notificationSkeleton: $("notificationSkeleton"),
  notificationError: $("notificationError"),
  notificationPanel: $("notificationPanel"),
  notificationPanelList: $("notificationPanelList"),
  markAllRead: $("markAllRead"),
  markAllNotifications: $("markAllNotifications"),

  // Profile Dropdown
  profileDropdown: $("profileDropdown"),
  dropdownAvatar: $("dropdownAvatar"),
  dropdownName: $("dropdownName"),
  dropdownEmail: $("dropdownEmail"),
  dropdownLogout: $("dropdownLogout"),

  // Toast
  toastContainer: $("toastContainer"),
};

// ================================================
// STATE
// ================================================

const state = {
  user: null,
  token: null,
  currentPage: 1,
  currentFilter: "all",
  currentSort: "latest",
  totalPages: 1,
  searchTimeout: null,
};

// ================================================
// AUTH CHECK
// ================================================

state.user = protectPageByRole(["student"]);
state.token = getToken();

if (!state.user || !state.token) {
  // protectPageByRole already redirects
}

// ================================================
// TOAST NOTIFICATIONS
// ================================================

function showToast(message, type = "info", duration = 4000) {
  if (!DOM.toastContainer) return;

  const icons = {
    success: "fa-solid fa-circle-check",
    error: "fa-solid fa-circle-exclamation",
    info: "fa-solid fa-circle-info",
  };

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");
  toast.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${message}`;

  DOM.toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add("toast-leaving");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ================================================
// SKELETON LOADING HELPERS
// ================================================

function showSkeleton(skeletonEl) {
  if (skeletonEl) skeletonEl.hidden = false;
}

function hideSkeleton(skeletonEl, contentEl) {
  if (skeletonEl) skeletonEl.hidden = true;
}

function showContent(contentEl) {
  if (contentEl) contentEl.hidden = false;
}

function hideContent(contentEl) {
  if (contentEl) contentEl.hidden = true;
}

function showError(errorEl) {
  if (errorEl) errorEl.hidden = false;
}

function hideError(errorEl) {
  if (errorEl) errorEl.hidden = true;
}

function showPagination(paginationEl) {
  if (paginationEl) paginationEl.hidden = false;
}

function hidePagination(paginationEl) {
  if (paginationEl) paginationEl.hidden = true;
}

// ================================================
// API HELPER
// ================================================

async function apiFetch(endpoint, opts = {}) {
  const headers = { "Content-Type": "application/json", ...(opts.headers || {}) };
  if (state.token) headers.Authorization = `Bearer ${state.token}`;
  const res = await fetch(`${API_BASE}${endpoint}`, { ...opts, headers });
  const data = await res.json();
  if (!res.ok || !data.success)
    throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// ================================================
// RETRY FUNCTIONS (exposed globally for HTML onclick)
// ================================================

window.retryLoadProperties = function () {
  hideError(DOM.propertyError);
  loadProperties();
};

window.retryLoadBookings = function () {
  hideError(DOM.bookingError);
  loadBookings();
};

window.retryLoadNotifications = function () {
  hideError(DOM.notificationError);
  loadNotifications();
};

// ================================================
// INIT
// ================================================

(async function init() {
  renderUserInfo();
  setupEventListeners();
  await Promise.all([loadDashboard(), loadProperties(), loadBookings(), loadNotifications()]);
})();

// ================================================
// RENDER USER INFO
// ================================================

function renderUserInfo() {
  const user = state.user;
  if (!user) return;

  const name = user.name || "Student";
  const email = user.email || "";
  const avatarSrc =
    user.avatar || user.profileImage || "./images/logo.png";

  // Topbar
  if (DOM.username) DOM.username.textContent = name;
  if (DOM.avatar) DOM.avatar.src = avatarSrc;

  // Hero
  if (DOM.heroUsername) DOM.heroUsername.textContent = name.split(" ")[0];

  // Profile dropdown
  if (DOM.dropdownName) DOM.dropdownName.textContent = name;
  if (DOM.dropdownEmail) DOM.dropdownEmail.textContent = email;
  if (DOM.dropdownAvatar) DOM.dropdownAvatar.src = avatarSrc;
}

// ================================================
// EVENT LISTENERS
// ================================================

function setupEventListeners() {
  // --- Search ---
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener("input", handleSearch);
  }

  // --- Filter buttons ---
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => handleFilter(btn.dataset.filter));
  });

  // --- Sort select ---
  if (DOM.sortSelect) {
    DOM.sortSelect.addEventListener("change", (e) => {
      state.currentSort = e.target.value;
      state.currentPage = 1;
      loadProperties();
    });
  }

  // --- Pagination ---
  if (DOM.prevPage) {
    DOM.prevPage.addEventListener("click", () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        loadProperties();
      }
    });
  }
  if (DOM.nextPage) {
    DOM.nextPage.addEventListener("click", () => {
      if (state.currentPage < state.totalPages) {
        state.currentPage++;
        loadProperties();
      }
    });
  }

  // --- Profile dropdown toggle ---
  if (DOM.profileBtn && DOM.profileDropdown) {
    DOM.profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = DOM.profileBtn.getAttribute("aria-expanded") === "true";
      DOM.profileBtn.setAttribute("aria-expanded", !expanded);
      DOM.profileDropdown.classList.toggle("active");
      closeNotificationPanel();
    });
  }

  // --- Profile dropdown logout ---
  if (DOM.dropdownLogout) {
    DOM.dropdownLogout.addEventListener("click", (e) => {
      e.preventDefault();
      handleLogout();
    });
  }

  // --- Click outside to close dropdowns ---
  document.addEventListener("click", (e) => {
    if (DOM.profileDropdown && DOM.profileDropdown.classList.contains("active")) {
      if (!DOM.profileBtn.contains(e.target) && !DOM.profileDropdown.contains(e.target)) {
        DOM.profileDropdown.classList.remove("active");
        DOM.profileBtn.setAttribute("aria-expanded", "false");
      }
    }
    if (DOM.notificationPanel && DOM.notificationPanel.classList.contains("active")) {
      if (!DOM.notificationBtn.contains(e.target) && !DOM.notificationPanel.contains(e.target)) {
        closeNotificationPanel();
      }
    }
  });

  // --- Escape key ---
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      if (DOM.profileDropdown?.classList.contains("active")) {
        DOM.profileDropdown.classList.remove("active");
        DOM.profileBtn.setAttribute("aria-expanded", "false");
      }
      if (DOM.notificationPanel?.classList.contains("active")) {
        closeNotificationPanel();
      }
    }
  });

  // --- Notification bell toggle ---
  if (DOM.notificationBtn && DOM.notificationPanel) {
    DOM.notificationBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      const expanded = DOM.notificationBtn.getAttribute("aria-expanded") === "true";
      DOM.notificationBtn.setAttribute("aria-expanded", !expanded);
      DOM.notificationPanel.classList.toggle("active");
      closeProfileDropdown();
    });
  }

  // --- Mark all read ---
  if (DOM.markAllRead) {
    DOM.markAllRead.addEventListener("click", markAllNotificationsRead);
  }
  if (DOM.markAllNotifications) {
    DOM.markAllNotifications.addEventListener("click", markAllNotificationsRead);
  }

  // --- Sidebar menu toggle (mobile) ---
  if (DOM.menuBtn && DOM.sidebar) {
    DOM.menuBtn.addEventListener("click", () => {
      DOM.sidebar.classList.toggle("active");
      DOM.menuBtn.setAttribute(
        "aria-expanded",
        DOM.sidebar.classList.contains("active") ? "true" : "false"
      );
      if (DOM.sidebarBackdrop) {
        DOM.sidebarBackdrop.hidden = !DOM.sidebar.classList.contains("active");
      }
    });

    if (DOM.sidebarBackdrop) {
      DOM.sidebarBackdrop.addEventListener("click", () => {
        DOM.sidebar.classList.remove("active");
        DOM.menuBtn.setAttribute("aria-expanded", "false");
        DOM.sidebarBackdrop.hidden = true;
      });
    }
  }

  // --- Logout button ---
  if (DOM.logoutBtn) {
    DOM.logoutBtn.addEventListener("click", handleLogout);
  }
}

// ================================================
// SEARCH
// ================================================

function handleSearch() {
  clearTimeout(state.searchTimeout);
  state.searchTimeout = setTimeout(() => {
    state.currentPage = 1;
    loadProperties();
  }, 400);
}

// ================================================
// FILTER
// ================================================

function handleFilter(filter) {
  state.currentFilter = filter;
  state.currentPage = 1;

  DOM.filterBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.filter === filter);
  });

  loadProperties();
}

// ================================================
// CLOSE HELPERS
// ================================================

function closeProfileDropdown() {
  if (DOM.profileDropdown) {
    DOM.profileDropdown.classList.remove("active");
    DOM.profileBtn?.setAttribute("aria-expanded", "false");
  }
}

function closeNotificationPanel() {
  if (DOM.notificationPanel) {
    DOM.notificationPanel.classList.remove("active");
    DOM.notificationBtn?.setAttribute("aria-expanded", "false");
  }
}

// ================================================
// LOGOUT
// ================================================

function handleLogout() {
  sessionLogout();
  showToast("Logged out successfully", "info", 2000);
  setTimeout(() => {
    window.location.href = "login.html";
  }, 500);
}

// ================================================
// LOAD DASHBOARD STATS
// ================================================

async function loadDashboard() {
  try {
    const res = await apiFetch("/dashboard");
    const stats = res.stats || {};

    if (DOM.savedCount) DOM.savedCount.textContent = stats.saved ?? 0;
    if (DOM.bookingCount) DOM.bookingCount.textContent = stats.bookings ?? 0;
    if (DOM.viewedCount) DOM.viewedCount.textContent = stats.viewed ?? 0;
    if (DOM.contactCount) DOM.contactCount.textContent = stats.contacts ?? 0;

    // Unread badge in sidebar
    const unreadCount = stats.unreadNotifications || 0;
    if (DOM.unreadBadge) {
      DOM.unreadBadge.textContent = unreadCount;
      DOM.unreadBadge.style.display = unreadCount > 0 ? "inline-flex" : "none";
    }

    // Notification dot indicator
    if (DOM.notificationDot) {
      DOM.notificationDot.classList.toggle("hidden", unreadCount === 0);
    }

    // "Mark all read" button visibility
    if (DOM.markAllNotifications) {
      DOM.markAllNotifications.hidden = unreadCount === 0;
    }
  } catch (err) {
    console.error("Dashboard stats error:", err);
    // Silently fail — stats stay at 0
  }
}

// ================================================
// LOAD PROPERTIES
// ================================================

async function loadProperties() {
  // Show skeleton, hide content & error
  showSkeleton(DOM.propertySkeleton);
  hideContent(DOM.propertyGrid);
  hideError(DOM.propertyError);
  hidePagination(DOM.propertyPagination);

  try {
    const query = new URLSearchParams();
    if (state.currentFilter !== "all") query.set("propertyType", state.currentFilter);
    if (state.currentSort) query.set("sort", state.currentSort);
    query.set("page", state.currentPage);
    query.set("limit", "6");

    // Add search term
    const searchTerm = DOM.searchInput?.value.trim();
    if (searchTerm) {
      // Use college search if it matches a college name
      query.set("college", searchTerm);
    }

    const res = await apiFetch(`/properties/search?${query.toString()}`);

    hideSkeleton(DOM.propertySkeleton, DOM.propertyGrid);
    showContent(DOM.propertyGrid);

    const properties = res.properties || [];
    state.totalPages = res.totalPages || 1;

    if (properties.length === 0) {
      DOM.propertyGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fa-solid fa-house"></i>
          <h3>No Properties Found</h3>
          <p>${searchTerm ? 'No results for "' + searchTerm + '". Try a different search.' : "Properties will appear here once added."}</p>
        </div>
      `;
      hidePagination(DOM.propertyPagination);
      return;
    }

    renderProperties(properties);

    // Pagination
    if (state.totalPages > 1) {
      showPagination(DOM.propertyPagination);
      if (DOM.pageInfo) {
        DOM.pageInfo.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
      }
      if (DOM.prevPage) DOM.prevPage.disabled = state.currentPage <= 1;
      if (DOM.nextPage) DOM.nextPage.disabled = state.currentPage >= state.totalPages;
    } else {
      hidePagination(DOM.propertyPagination);
    }
  } catch (err) {
    console.error("Properties error:", err);
    hideSkeleton(DOM.propertySkeleton, DOM.propertyGrid);
    hideContent(DOM.propertyGrid);
    showError(DOM.propertyError);
    showToast("Failed to load properties: " + err.message, "error");
  }
}

// ================================================
// RENDER PROPERTIES
// ================================================

function renderProperties(properties) {
  if (!DOM.propertyGrid) return;
  DOM.propertyGrid.innerHTML = "";

  properties.forEach((p) => {
    const imgSrc = getImageUrl(p.images && p.images.length ? p.images[0] : "");

    const name = p.propertyName || p.title || "Campora Property";
    const loc = p.city
      ? `${p.city}${p.state ? ", " + p.state : ""}`
      : "Location not specified";
    const rent = p.rent || p.price || 0;
    const rating = p.averageRating || 0;
    const badge = p.verified ? "Verified" : p.featured ? "Featured" : "";

    const card = document.createElement("div");
    card.className = "property-card";
    card.setAttribute("role", "article");
    card.innerHTML = `
      <div class="property-image">
        <img src="${imgSrc}" alt="${name}" loading="lazy" decoding="async" onerror="this.src='./images/property-placeholder.jpg'">
        ${badge ? `<div class="property-badge ${p.verified ? "verified" : "featured"}">${badge}</div>` : ""}
        <button class="property-save" data-id="${p._id}" aria-label="${p.isSaved ? "Remove from saved" : "Save property"}" onclick="window.toggleSave('${p._id}', this)">
          <i class="fa-${p.isSaved ? "solid" : "regular"} fa-heart"></i>
        </button>
      </div>
      <div class="property-body">
        <h3 class="property-title">${name}</h3>
        <p class="property-location"><i class="fa-solid fa-location-dot"></i> ${loc}</p>
        <div class="property-price">₹${rent.toLocaleString()}<span>/month</span></div>
        <div class="property-features">
          ${p.sharing ? `<span class="feature-chip">${p.sharing}</span>` : ""}
          ${p.gender ? `<span class="feature-chip">${p.gender}</span>` : ""}
          ${p.propertyType ? `<span class="feature-chip">${p.propertyType}</span>` : ""}
        </div>
        <div class="property-footer">
          <div class="property-rating">
            ${rating > 0 ? `<i class="fa-solid fa-star"></i> ${rating.toFixed(1)}` : '<span style="color:#94a3b8">New</span>'}
          </div>
          <button class="book-btn" onclick="window.viewProperty('${p._id}')" aria-label="View ${name}">View</button>
        </div>
      </div>
    `;

    DOM.propertyGrid.appendChild(card);
  });
}

// ================================================
// SAVE / UNSAVE PROPERTY (global)
// ================================================

window.toggleSave = async function (propertyId, btn) {
  try {
    const icon = btn.querySelector("i");
    const isSaved = icon.classList.contains("fa-solid");

    if (isSaved) {
      await apiFetch(`/student/saved/${propertyId}`, { method: "DELETE" });
      icon.className = "fa-regular fa-heart";
      showToast("Removed from saved", "info");
    } else {
      await apiFetch(`/student/saved/${propertyId}`, { method: "POST" });
      icon.className = "fa-solid fa-heart";
      showToast("Property saved!", "success");
    }

    // Refresh stats
    loadDashboard();
  } catch (err) {
    console.error("Save error:", err);
    showToast("Failed to save property: " + err.message, "error");
  }
};

// ================================================
// VIEW PROPERTY (global)
// ================================================

window.viewProperty = function (id) {
  // Track view
  apiFetch(`/student/recent/${id}`, { method: "POST" }).catch(() => {});
  window.location.href = `property-details.html?id=${id}`;
};

// ================================================
// LOAD BOOKINGS
// ================================================

async function loadBookings() {
  showSkeleton(DOM.bookingSkeleton);
  hideContent(DOM.bookingGrid);
  hideError(DOM.bookingError);

  try {
    const res = await apiFetch("/student/bookings");

    hideSkeleton(DOM.bookingSkeleton, DOM.bookingGrid);
    showContent(DOM.bookingGrid);

    const bookings = res.bookings || [];

    if (bookings.length === 0) {
      DOM.bookingGrid.innerHTML = `
        <div class="empty-state" style="grid-column:1/-1">
          <i class="fa-solid fa-calendar-check"></i>
          <h3>No Bookings Yet</h3>
          <p>Your booked properties will appear here.</p>
        </div>
      `;
      return;
    }

    renderBookings(bookings);
  } catch (err) {
    console.error("Bookings error:", err);
    hideSkeleton(DOM.bookingSkeleton, DOM.bookingGrid);
    hideContent(DOM.bookingGrid);
    showError(DOM.bookingError);
  }
}

// ================================================
// RENDER BOOKINGS
// ================================================

function renderBookings(bookings) {
  if (!DOM.bookingGrid) return;
  DOM.bookingGrid.innerHTML = "";

  bookings.forEach((b) => {
    const prop = b.propertyId || {};
    const name = prop.propertyName || b.propertyName || "Property";
    const loc = prop.city || "";
    const status = b.bookingStatus || b.status || "pending";
    const statusClass =
      status === "confirmed" || status === "checked-in"
        ? "confirmed"
        : status === "cancelled" || status === "checked-out"
        ? "cancelled"
        : "pending";

    const card = document.createElement("div");
    card.className = "booking-card";
    card.innerHTML = `
      <div class="booking-left">
        <div>
          <h3 class="booking-title">${name}</h3>
          ${loc ? `<p class="booking-location"><i class="fa-solid fa-location-dot"></i> ${loc}</p>` : ""}
          <p style="color:#94a3b8;font-size:13px;margin-top:4px">
            ${b.checkIn ? '<i class="fa-regular fa-calendar"></i> ' + new Date(b.checkIn).toLocaleDateString() : ""}
          </p>
        </div>
      </div>
      <div class="booking-status ${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
    `;

    DOM.bookingGrid.appendChild(card);
  });
}

// ================================================
// LOAD NOTIFICATIONS
// ================================================

async function loadNotifications() {
  showSkeleton(DOM.notificationSkeleton);
  hideContent(DOM.notificationList);
  hideError(DOM.notificationError);

  try {
    const res = await apiFetch("/student/notifications");

    hideSkeleton(DOM.notificationSkeleton, DOM.notificationList);
    showContent(DOM.notificationList);

    const notifications = res.notifications || [];
    const unreadCount = res.unreadCount || 0;

    // Update badge
    if (DOM.unreadBadge) {
      DOM.unreadBadge.textContent = unreadCount;
      DOM.unreadBadge.style.display = unreadCount > 0 ? "inline-flex" : "none";
    }
    if (DOM.notificationDot) {
      DOM.notificationDot.classList.toggle("hidden", unreadCount === 0);
    }
    if (DOM.markAllNotifications) {
      DOM.markAllNotifications.hidden = unreadCount === 0;
    }

    if (notifications.length === 0) {
      DOM.notificationList.innerHTML = `
        <div class="empty-state">
          <i class="fa-solid fa-bell"></i>
          <h3>No Notifications</h3>
          <p>You're all caught up!</p>
        </div>
      `;
      DOM.notificationPanelList.innerHTML = `
        <div class="notification-panel-empty">
          <i class="fa-solid fa-bell"></i>
          <p>No notifications yet</p>
        </div>
      `;
      return;
    }

    renderNotifications(notifications);
    renderNotificationPanel(notifications);
  } catch (err) {
    console.error("Notifications error:", err);
    hideSkeleton(DOM.notificationSkeleton, DOM.notificationList);
    hideContent(DOM.notificationList);
    showError(DOM.notificationError);
  }
}

// ================================================
// RENDER NOTIFICATIONS (in-page list)
// ================================================

function renderNotifications(notifications) {
  if (!DOM.notificationList) return;
  DOM.notificationList.innerHTML = "";

  notifications.slice(0, 10).forEach((n) => {
    const time = n.createdAt ? timeAgo(n.createdAt) : "";
    const isUnread = !n.isRead;

    const row = document.createElement("div");
    row.className = `notification-row ${isUnread ? "unread" : ""}`;
    row.innerHTML = `
      <div class="notification-dot ${isUnread ? "active" : ""}"></div>
      <div style="flex:1">
        <div class="notification-title">${n.title || "Campora"}</div>
        <div class="notification-message">${n.message || ""}</div>
        <div class="notification-time">${time}</div>
      </div>
    `;

    DOM.notificationList.appendChild(row);
  });
}

// ================================================
// RENDER NOTIFICATION PANEL (dropdown)
// ================================================

function renderNotificationPanel(notifications) {
  if (!DOM.notificationPanelList) return;
  DOM.notificationPanelList.innerHTML = "";

  if (notifications.length === 0) {
    DOM.notificationPanelList.innerHTML = `
      <div class="notification-panel-empty">
        <i class="fa-solid fa-bell"></i>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }

  notifications.slice(0, 15).forEach((n) => {
    const time = n.createdAt ? timeAgo(n.createdAt) : "";
    const isUnread = !n.isRead;

    const item = document.createElement("div");
    item.className = `notification-panel-item ${isUnread ? "unread" : ""}`;
    item.onclick = () => markNotificationRead(n._id, item);
    item.innerHTML = `
      <div class="notification-panel-item-icon">
        <i class="fa-solid fa-bell"></i>
      </div>
      <div class="notification-panel-item-content">
        <div class="notification-panel-item-title">${n.title || "Campora"}</div>
        <div class="notification-panel-item-message">${n.message || ""}</div>
        <div class="notification-panel-item-time">${time}</div>
      </div>
    `;

    DOM.notificationPanelList.appendChild(item);
  });
}

// ================================================
// MARK NOTIFICATION READ
// ================================================

async function markNotificationRead(id, el) {
  try {
    await apiFetch(`/student/notifications/${id}/read`, { method: "PUT" });
    el.classList.remove("unread");
    el.style.borderLeft = "none";

    // Reload to update counts
    loadNotifications();
    loadDashboard();
  } catch (err) {
    console.error("Mark read error:", err);
  }
}

// ================================================
// MARK ALL NOTIFICATIONS READ
// ================================================

async function markAllNotificationsRead() {
  try {
    await apiFetch("/student/notifications/read-all", { method: "PUT" });
    showToast("All notifications marked as read", "success");
    loadNotifications();
    loadDashboard();
  } catch (err) {
    console.error("Mark all read error:", err);
    showToast("Failed to mark all as read", "error");
  }
}

// ================================================
// TIME AGO HELPER
// ================================================

function timeAgo(dateInput) {
  const now = new Date();
  const date = new Date(dateInput);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// ================================================
// TAB KEYBOARD NAVIGATION FOR SIDEBAR
// ================================================

document.querySelectorAll(".nav-item, .bottom-nav-item").forEach((item) => {
  item.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      item.click();
    }
  });
});

// ================================================
// EXPOSE TOAST FOR GLOBAL USE
// ================================================

window.showToast = showToast;

// ================================================
// UPDATE TODO STATUS
// ================================================

console.log("✅ Campora Student Dashboard V2 initialised (production mode)");

