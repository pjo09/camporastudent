// =====================================================
// CAMPORA ADMIN DASHBOARD
// Full integration with admin API
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { supabaseAPI } from "./supabase-api.js";

const originalFetch = window.fetch;
const inFlightRequests = new Map();
let activeRetries = 0;

const fetch = async (url, options = {}, retryCount = 0) => {
  const isGet = !options.method || options.method.toUpperCase() === "GET";
  const force = options.forceReload || state.forceReloadActive;

  if (isGet && force) {
    inFlightRequests.delete(url);
  }

  const cacheKey = isGet ? url : null;

  if (cacheKey && inFlightRequests.has(cacheKey)) {
    return inFlightRequests.get(cacheKey);
  }

  const promise = (async () => {
    try {
      const res = await originalFetch(url, options);

      if (res.status === 429 && isGet) {
        if (retryCount < 2) {
          activeRetries++;
          const retryAfterHeader = res.headers.get("Retry-After");
          let delaySec = parseInt(retryAfterHeader, 10);
          if (isNaN(delaySec) || delaySec <= 0) {
            delaySec = 5;
          }

          const staggerMs = (activeRetries - 1) * 500;
          const totalDelayMs = (delaySec * 1000) + staggerMs;
          const roundedDelaySec = Math.round(totalDelayMs / 1000);

          showToast(`Admin data is temporarily rate limited. Retrying in ${roundedDelaySec} seconds...`, "info");

          try {
            await new Promise(resolve => setTimeout(resolve, totalDelayMs));
          } finally {
            activeRetries--;
          }

          if (cacheKey) {
            inFlightRequests.delete(cacheKey);
          }

          return fetch(url, options, retryCount + 1);
        } else {
          showToast("Unable to load this section right now. Please try again later.", "error");
        }
      }

      if (!res.ok) {
        let message = `Admin API request failed: HTTP ${res.status}`;
        try {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const errData = await res.json();
            if (errData && errData.message) message = errData.message;
          }
        } catch (e) {}
        throw new Error(message);
      }

      const originalJson = res.json.bind(res);
      res.json = async () => {
        const contentType = res.headers.get("content-type");
        if (contentType && contentType.includes("application/json")) {
          return await originalJson();
        }
        throw new Error(`Expected JSON response but received non-JSON payload (Status ${res.status})`);
      };

      return res;
    } finally {
      if (cacheKey) {
        if (inFlightRequests.get(cacheKey) === promise) {
          inFlightRequests.delete(cacheKey);
        }
      }
    }
  })();

  if (cacheKey) {
    inFlightRequests.set(cacheKey, promise);
  }

  return promise;
};

const $ = (id) => document.getElementById(id);

// =====================================================
// STATE
// =====================================================

const state = {
  user: null,
  token: null,
  charts: {},
  usersPage: 1,
  usersTotal: 1,
  propPage: 1,
  propTotal: 1,
  bookingPage: 1,
  bookingTotal: 1,
  currentTab: "overview",
  loadedTabs: {},
  loadingTabs: {},
  forceReloadActive: false,
};

state.user = protectPageByRole(["admin"]);
state.token = getToken();
if (!state.user || !state.token) {}

// =====================================================
// DOM REFS
// =====================================================

const DOM = {
  loading: $("adminLoading"),
  sidebar: $("adminSidebar"),
  menuBtn: $("adminMenuBtn"),
  pageTitle: $("adminPageTitle"),
  name: $("adminName"),
  avatar: $("adminAvatar"),
  lastUpdate: $("adminLastUpdate"),
  refreshBtn: $("adminRefreshBtn"),
  logoutBtn: $("adminLogoutBtn"),
  modalOverlay: $("adminModalOverlay"),
  modalClose: $("adminModalClose"),
  modalTitle: $("adminModalTitle"),
  modalBody: $("adminModalBody"),

  overviewStats: $("overviewStats"),
  activityTable: $("activityTable"),
  activityCount: $("activityCount"),

  analyticsStats: $("analyticsStats"),

  usersTable: $("usersTable"),
  usersSearch: $("usersSearch"),
  usersRoleFilter: $("usersRoleFilter"),
  usersStatusFilter: $("usersStatusFilter"),
  usersSearchBtn: $("usersSearchBtn"),
  usersPrev: $("usersPrev"),
  usersNext: $("usersNext"),
  usersPageInfo: $("usersPageInfo"),

  propTable: $("propTable"),
  propSearch: $("propSearch"),
  propStatusFilter: $("propStatusFilter"),
  propSearchBtn: $("propSearchBtn"),
  propPrev: $("propPrev"),
  propNext: $("propNext"),
  propPageInfo: $("propPageInfo"),

  bookingTable: $("bookingTable"),
  bookingStatusFilter: $("bookingStatusFilter"),
  bookingPaymentFilter: $("bookingPaymentFilter"),
  bookingPrev: $("bookingPrev"),
  bookingNext: $("bookingNext"),
  bookingPageInfo: $("bookingPageInfo"),

  paymentStats: $("paymentStats"),
  paymentTable: $("paymentTable"),
  paymentFilter: $("paymentFilter"),

  reviewTable: $("reviewTable"),
  reviewStatusFilter: $("reviewStatusFilter"),
  reviewSearch: $("reviewSearch"),

  reportStats: $("reportStats"),
  occupancyTable: $("occupancyTable"),

  // Settings
  setSiteName: $("setSiteName"),
  setSupportEmail: $("setSupportEmail"),
  setSupportPhone: $("setSupportPhone"),
  setCommission: $("setCommission"),
  setMaintenance: $("setMaintenance"),
  setRegistration: $("setRegistration"),
  setPropertyUpload: $("setPropertyUpload"),
  savePlatformSettings: $("savePlatformSettings"),

  systemStats: $("systemStats"),
  systemInfoTable: $("systemInfoTable"),
};

// =====================================================
// INIT
// =====================================================

init();

async function init() {
  renderAdminInfo();
  setupEventListeners();
  await checkSuperAdminPermissions();
  await loadTabData("overview");
  DOM.loading.style.display = "none";
  updateLastUpdate();
}

function renderAdminInfo() {
  const u = state.user;
  if (!u) return;
  DOM.name.textContent = u.name || "Admin";
  DOM.avatar.textContent = (u.name || "A").charAt(0).toUpperCase();
}

function setupEventListeners() {
  // Tab switching
  document.querySelectorAll(".admin-nav-item[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
  });

  // Modal
  DOM.modalClose?.addEventListener("click", () => closeModal());
  DOM.modalOverlay?.addEventListener("click", (e) => {
    if (e.target === DOM.modalOverlay) closeModal();
  });

  // Refresh
  DOM.refreshBtn?.addEventListener("click", async () => {
    await loadTabData(state.currentTab, true);
    updateLastUpdate();
  });

// Logout
  DOM.logoutBtn?.addEventListener("click", () => {
    sessionLogout();
  });

  // Mobile menu
  DOM.menuBtn?.addEventListener("click", () => {
    DOM.sidebar?.classList.toggle("open");
  });

  // Users search
  DOM.usersSearchBtn?.addEventListener("click", () => { state.usersPage = 1; loadUsers(); });
  DOM.usersSearch?.addEventListener("keydown", (e) => { if (e.key === "Enter") { state.usersPage = 1; loadUsers(); } });
  DOM.usersPrev?.addEventListener("click", () => { if (state.usersPage > 1) { state.usersPage--; loadUsers(); } });
  DOM.usersNext?.addEventListener("click", () => { if (state.usersPage < state.usersTotal) { state.usersPage++; loadUsers(); } });

  // Properties search
  DOM.propSearchBtn?.addEventListener("click", () => { state.propPage = 1; loadProperties(); });
  DOM.propPrev?.addEventListener("click", () => { if (state.propPage > 1) { state.propPage--; loadProperties(); } });
  DOM.propNext?.addEventListener("click", () => { if (state.propPage < state.propTotal) { state.propPage++; loadProperties(); } });

  // Bookings
  DOM.bookingPrev?.addEventListener("click", () => { if (state.bookingPage > 1) { state.bookingPage--; loadBookings(); } });
  DOM.bookingNext?.addEventListener("click", () => { if (state.bookingPage < state.bookingTotal) { state.bookingPage++; loadBookings(); } });

  // Settings
  DOM.savePlatformSettings?.addEventListener("click", saveSettings);

  // Auto-refresh filters
  [DOM.usersRoleFilter, DOM.usersStatusFilter].forEach((el) => el?.addEventListener("change", () => { state.usersPage = 1; loadUsers(); }));
  DOM.propStatusFilter?.addEventListener("change", () => { state.propPage = 1; loadProperties(); });
  [DOM.bookingStatusFilter, DOM.bookingPaymentFilter].forEach((el) => el?.addEventListener("change", () => { state.bookingPage = 1; loadBookings(); }));
  DOM.paymentFilter?.addEventListener("change", loadPayments);
  DOM.reviewStatusFilter?.addEventListener("change", loadReviews);
}

function switchTab(tab) {
  state.currentTab = tab;

  // Update nav
  document.querySelectorAll(".admin-nav-item").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.tab === tab);
  });

  // Update content
  document.querySelectorAll(".admin-tab-content").forEach((el) => {
    el.classList.remove("active");
  });
  const content = $(`tab-${tab}`);
  if (content) content.classList.add("active");

  // Update title
  const titles = { overview: "Dashboard Overview", analytics: "Analytics", users: "Users Management", properties: "Properties", bookings: "Bookings", payments: "Payments", reviews: "Reviews", reports: "Reports", settings: "Platform Settings", "admin-management": "Admin Management", system: "System" };
  DOM.pageTitle.textContent = titles[tab] || "Admin";

  // Load tab data
  loadTabData(tab);

  // Close mobile sidebar
  DOM.sidebar?.classList.remove("open");
}

async function loadTabData(tab, force = false) {
  if (!force && state.loadedTabs[tab]) return;
  if (state.loadingTabs[tab]) return;

  state.loadingTabs[tab] = true;
  if (force) {
    state.forceReloadActive = true;
  }

  try {
    switch (tab) {
      case "overview": await loadOverview(); break;
      case "analytics": await loadAnalytics(); break;
      case "users": await loadUsers(); break;
      case "properties": await loadProperties(); break;
      case "bookings": await loadBookings(); break;
      case "payments": await loadPayments(); break;
      case "reviews": await loadReviews(); break;
      case "reports": await loadReports(); break;
      case "settings": await loadSettings(); break;
      case "admin-management": await loadAdminManagement(); break;
      case "system": await loadSystem(); break;
    }
    state.loadedTabs[tab] = true;
  } catch (err) {
    console.error(`Failed to load tab ${tab}:`, err);
  } finally {
    state.loadingTabs[tab] = false;
    state.forceReloadActive = false;
  }
}

function updateLastUpdate() {
  DOM.lastUpdate.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
}

// =====================================================
// OVERVIEW
// =====================================================

async function loadOverview() {
  try {
    const [dashData, activityData] = await Promise.all([
      supabaseAPI.getAdminDashboardStats(),
      supabaseAPI.getAdminActivity(),
    ]);

    if (dashData.success) {
      const s = dashData.statistics;
      DOM.overviewStats.innerHTML = `
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(37,99,235,.15);color:#60a5fa"><i class="fa-solid fa-users"></i></div><div class="admin-stat-title">Total Users</div><div class="admin-stat-value">${s.totalUsers || 0}</div><div class="admin-stat-sub">${s.totalStudents || 0} students · ${s.totalOwners || 0} owners</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(124,58,237,.15);color:#a78bfa"><i class="fa-solid fa-building"></i></div><div class="admin-stat-title">Properties</div><div class="admin-stat-value">${s.totalProperties || 0}</div><div class="admin-stat-sub">${s.approvedProperties || 0} approved · ${s.pendingProperties || 0} pending</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(6,182,212,.15);color:#22d3ee"><i class="fa-solid fa-calendar-check"></i></div><div class="admin-stat-title">Bookings</div><div class="admin-stat-value">${s.totalBookings || 0}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(34,197,94,.15);color:#4ade80"><i class="fa-solid fa-star"></i></div><div class="admin-stat-title">Reviews</div><div class="admin-stat-value">${s.totalReviews || 0}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(245,158,11,.15);color:#fbbf24"><i class="fa-solid fa-user-graduate"></i></div><div class="admin-stat-title">Students</div><div class="admin-stat-value">${s.totalStudents || 0}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(239,68,68,.15);color:#f87171"><i class="fa-solid fa-user-tie"></i></div><div class="admin-stat-title">Owners</div><div class="admin-stat-value">${s.totalOwners || 0}</div></div>`;

      // Property status chart
      createPropertyChart(s.totalProperties || 0, s.approvedProperties || 0, s.pendingProperties || 0, s.rejectedProperties || 0);
    }

    if (activityData.success) {
      const users = activityData.users || [];
      const properties = activityData.properties || [];
      const bookings = activityData.bookings || [];
      const allActivity = [
        ...users.map((u) => ({ type: "user", detail: `${u.name || "User"} joined`, name: u.email || "", time: u.createdAt })),
        ...properties.map((p) => ({ type: "property", detail: `${p.propertyName || "Property"} added`, name: p.owner?.name || "", time: p.createdAt })),
        ...bookings.map((b) => ({ type: "booking", detail: `Booking for ${b.propertyName || "property"}`, name: b.userName || "", time: b.createdAt })),
      ].sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 15);

      DOM.activityCount.textContent = `${allActivity.length} recent`;
      if (allActivity.length === 0) {
        DOM.activityTable.innerHTML = `<tr><td colspan="4" style="text-align:center;color:#64748b">No recent activity</td></tr>`;
      } else {
        DOM.activityTable.innerHTML = allActivity.map((a) => `
          <tr>
            <td><span class="admin-status" style="background:${a.type === 'user' ? 'rgba(37,99,235,.12)' : a.type === 'property' ? 'rgba(124,58,237,.12)' : 'rgba(6,182,212,.12)'};color:${a.type === 'user' ? '#60a5fa' : a.type === 'property' ? '#a78bfa' : '#22d3ee'}">${a.type}</span></td>
            <td>${a.detail}</td>
            <td>${a.name}</td>
            <td style="color:#64748b;font-size:13px">${timeAgo(a.time)}</td>
          </tr>`).join("");
      }
    }
  } catch (err) {
    console.error("Overview error:", err);
  }
}

// =====================================================
// ANALYTICS
// =====================================================

async function loadAnalytics() {
  try {
    const analyticsData = await supabaseAPI.getAdminAnalytics();

    if (analyticsData.success) {
      const a = analyticsData.analytics;
      DOM.analyticsStats.innerHTML = `
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(37,99,235,.15);color:#60a5fa"><i class="fa-solid fa-eye"></i></div><div class="admin-stat-title">Total Views</div><div class="admin-stat-value">${(a.totalViews || 0).toLocaleString()}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(124,58,237,.15);color:#a78bfa"><i class="fa-solid fa-indian-rupee-sign"></i></div><div class="admin-stat-title">Average Rent</div><div class="admin-stat-value">₹${(a.averageRent || 0).toLocaleString()}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(6,182,212,.15);color:#22d3ee"><i class="fa-solid fa-bed"></i></div><div class="admin-stat-title">Available Beds</div><div class="admin-stat-value">${(a.availableBeds || 0).toLocaleString()}</div></div>`;
    }
  } catch (err) {
    console.error("Analytics error:", err);
  }
}

// =====================================================
// USERS
// =====================================================

async function loadUsers() {
  try {
    const filterOptions = { page: state.usersPage, limit: 15 };
    if (DOM.usersRoleFilter?.value) filterOptions.role = DOM.usersRoleFilter.value;
    if (DOM.usersStatusFilter?.value) filterOptions.status = DOM.usersStatusFilter.value;
    if (DOM.usersSearch?.value.trim()) filterOptions.search = DOM.usersSearch.value.trim();

    const data = await supabaseAPI.getAdminUsers(filterOptions);

    if (data.success) {
      const users = data.users || [];
      state.usersTotal = data.totalPages || 1;
      DOM.usersPageInfo.textContent = `Page ${data.currentPage || 1} of ${data.totalPages || 1}`;
      DOM.usersPrev.disabled = (data.currentPage || 1) <= 1;
      DOM.usersNext.disabled = (data.currentPage || 1) >= (data.totalPages || 1);

      if (users.length === 0) {
        DOM.usersTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b">No users found</td></tr>`;
        return;
      }

      DOM.usersTable.innerHTML = users.map((u) => {
        const displayStatus = u.role === "owner" ? (u.accountStatus || "PENDING") : (u.status || "active");
        const statusBadgeClass = (displayStatus === "ACTIVE" || displayStatus === "active") ? "approved" : displayStatus === "PENDING" ? "pending" : "suspended";
        return `
        <tr>
          <td><div class="admin-avatar admin-avatar-sm">${(u.name || "?").charAt(0).toUpperCase()}</div></td>
          <td><strong>${u.name || "Unknown"}</strong></td>
          <td style="color:#94a3b8">${u.email || ""}</td>
          <td><span class="admin-status" style="background:${u.role === 'admin' ? 'rgba(239,68,68,.12)' : u.role === 'owner' ? 'rgba(124,58,237,.12)' : 'rgba(37,99,235,.12)'};color:${u.role === 'admin' ? '#ef4444' : u.role === 'owner' ? '#a78bfa' : '#60a5fa'}">${u.role || "student"}</span></td>
          <td><span class="admin-status ${statusBadgeClass}">${displayStatus}</span></td>
          <td style="color:#64748b;font-size:13px">${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : ""}</td>
          <td>
            <div class="action-group">
              <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="window.viewUser('${u._id}')">View</button>
              ${u.status !== "suspended" ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="window.suspendUser('${u._id}')">Suspend</button>` : `<button class="admin-btn admin-btn-sm admin-btn-success" onclick="window.activateUser('${u._id}')">Activate</button>`}
              ${u.role === "owner" && (u.accountStatus === "PENDING" || !u.verified) ? `
                <button class="admin-btn admin-btn-sm admin-btn-success" onclick="window.approveOwner('${u._id}')">Approve</button>
                <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="window.rejectOwner('${u._id}')">Reject</button>
              ` : ""}
            </div>
          </td>
        </tr>`;
      }).join("");
    }
  } catch (err) {
    console.error("Users load error:", err);
    DOM.usersTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444">Failed to load users</td></tr>`;
  }
}

// =====================================================
// PROPERTIES
// =====================================================

async function loadProperties() {
  try {
    const filterOptions = { page: state.propPage, limit: 15 };
    if (DOM.propStatusFilter?.value) filterOptions.status = DOM.propStatusFilter.value;
    if (DOM.propSearch?.value.trim()) filterOptions.search = DOM.propSearch.value.trim();

    const data = await supabaseAPI.getAdminProperties(filterOptions);

    if (data.success) {
      const props = data.properties || [];
      state.propTotal = data.totalPages || 1;
      DOM.propPageInfo.textContent = `Page ${data.currentPage || 1} of ${data.totalPages || 1}`;
      DOM.propPrev.disabled = (data.currentPage || 1) <= 1;
      DOM.propNext.disabled = (data.currentPage || 1) >= (data.totalPages || 1);

      if (props.length === 0) {
        DOM.propTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b">No properties found</td></tr>`;
        return;
      }

      DOM.propTable.innerHTML = props.map((p) => `
        <tr>
          <td><strong>${p.propertyName || "Untitled"}</strong></td>
          <td style="color:#94a3b8">${p.owner?.name || "Unknown"}</td>
          <td>${p.city || ""}</td>
          <td>₹${(p.rent || 0).toLocaleString()}</td>
          <td><span class="admin-status" style="background:rgba(37,99,235,.12);color:#60a5fa">${p.propertyType || "-"}</span></td>
          <td><span class="admin-status ${p.status || 'pending'}">${p.status || "pending"}</span></td>
          <td>
            <div class="action-group">
              <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="window.location.href='/pages/property/property.html?id=${p._id}'">View</button>
              ${p.status === "pending" ? `<button class="admin-btn admin-btn-sm admin-btn-success" onclick="window.approveProperty('${p._id}')">Approve</button>` : ""}
              ${p.status !== "rejected" ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="window.rejectProperty('${p._id}')">Reject</button>` : ""}
              ${!p.featured ? `<button class="admin-btn admin-btn-sm admin-btn-warning" onclick="window.featureProperty('${p._id}')">Feature</button>` : ""}
            </div>
          </td>
        </tr>`).join("");
    }
  } catch (err) {
    console.error("Properties load error:", err);
    DOM.propTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444">Failed to load properties</td></tr>`;
  }
}

// =====================================================
// BOOKINGS
// =====================================================

async function loadBookings() {
  try {
    const filterOptions = { page: state.bookingPage, limit: 15 };
    if (DOM.bookingStatusFilter?.value) filterOptions.status = DOM.bookingStatusFilter.value;
    if (DOM.bookingPaymentFilter?.value) filterOptions.paymentStatus = DOM.bookingPaymentFilter.value;

    const data = await supabaseAPI.getAdminBookings(filterOptions);

    if (data.success) {
      const bookings = data.bookings || [];
      state.bookingTotal = data.totalPages || 1;
      DOM.bookingPageInfo.textContent = `Page ${data.currentPage || 1} of ${data.totalPages || 1}`;
      DOM.bookingPrev.disabled = (data.currentPage || 1) <= 1;
      DOM.bookingNext.disabled = (data.currentPage || 1) >= (data.totalPages || 1);

      if (bookings.length === 0) {
        DOM.bookingTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b">No bookings found</td></tr>`;
        return;
      }

      DOM.bookingTable.innerHTML = bookings.map((b) => {
        const status = b.bookingStatus || "pending";
        const payment = b.paymentStatus || "pending";
        return `
        <tr>
          <td>${b.userId?.name || b.userName || "Unknown"}</td>
          <td>${b.propertyId?.propertyName || b.propertyName || "Property"}</td>
          <td>₹${(b.price || 0).toLocaleString()}</td>
          <td><span class="admin-status ${['confirmed','checked-in'].includes(status) ? 'approved' : status === 'cancelled' ? 'suspended' : 'pending'}">${status}</span></td>
          <td><span class="admin-status ${payment === 'paid' ? 'approved' : payment === 'failed' ? 'suspended' : 'pending'}">${payment}</span></td>
          <td style="color:#64748b;font-size:13px">${b.createdAt ? new Date(b.createdAt).toLocaleDateString() : ""}</td>
          <td>
            <div class="action-group">
              ${status === "pending" ? `<button class="admin-btn admin-btn-sm admin-btn-success" onclick="window.confirmBooking('${b._id}')">Confirm</button>` : ""}
              ${status !== "cancelled" ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="window.cancelBooking('${b._id}')">Cancel</button>` : ""}
              ${payment !== "paid" ? `<button class="admin-btn admin-btn-sm admin-btn-primary" onclick="window.markPaid('${b._id}')">Mark Paid</button>` : ""}
            </div>
          </td>
        </tr>`}).join("");
    }
  } catch (err) {
    console.error("Bookings load error:", err);
    DOM.bookingTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#ef4444">Failed to load bookings</td></tr>`;
  }
}

// =====================================================
// PAYMENTS
// =====================================================

async function loadPayments() {
  try {
    const data = await supabaseAPI.getAdminBookings({ limit: 20 });
    if (data.success) {
      const payments = data.bookings || [];
      if (payments.length === 0) {
        DOM.paymentTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b">No payments found</td></tr>`;
        return;
      }
      DOM.paymentTable.innerHTML = payments.map((p) => `
        <tr>
          <td>${p.userName || "Unknown"}</td>
          <td>${p.propertyName || "Property"}</td>
          <td>₹${(p.price || 0).toLocaleString()}</td>
          <td><span class="admin-status ${p.paymentStatus === 'paid' ? 'approved' : p.paymentStatus === 'failed' ? 'suspended' : 'pending'}">${p.paymentStatus || "pending"}</span></td>
          <td style="color:#94a3b8">Online</td>
          <td style="color:#64748b;font-size:13px">${p.createdAt ? new Date(p.createdAt).toLocaleDateString() : ""}</td>
          <td>${p.paymentStatus !== "paid" ? `<button class="admin-btn admin-btn-sm admin-btn-primary" onclick="window.markPaymentPaid('${p.id}')">Mark Paid</button>` : ""}</td>
        </tr>`).join("");
    }
  } catch (err) {
    console.error("Payments error:", err);
  }
}

// =====================================================
// REVIEWS
// =====================================================

async function loadReviews() {
  try {
    const data = await supabaseAPI.getAdminReviews();
    if (data.success) {
      const reviews = data.reviews || [];
      if (reviews.length === 0) {
        DOM.reviewTable.innerHTML = `<tr><td colspan="7" style="text-align:center;color:#64748b">No reviews found</td></tr>`;
        return;
      }
      DOM.reviewTable.innerHTML = reviews.map((r) => `
        <tr>
          <td>${r.user?.name || "Student"}</td>
          <td>${r.property?.propertyName || "Property"}</td>
          <td style="color:#facc15">${"⭐".repeat(r.rating || 0)}</td>
          <td style="color:#94a3b8;max-width:200px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${r.comment || ""}</td>
          <td><span class="admin-status ${r.status === 'approved' ? 'approved' : 'pending'}">${r.status || "approved"}</span></td>
          <td style="color:#64748b;font-size:13px">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : ""}</td>
          <td>
            <div class="action-group">
              ${r.status !== "approved" ? `<button class="admin-btn admin-btn-sm admin-btn-success" onclick="window.approveReview('${r.id}')">Approve</button>` : ""}
              ${r.status !== "hidden" ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="window.hideReview('${r.id}')">Hide</button>` : ""}
              <button class="admin-btn admin-btn-sm admin-btn-danger" onclick="window.deleteReview('${r.id}')">Delete</button>
            </div>
          </td>
        </tr>`).join("");
    }
  } catch (err) {
    console.error("Reviews error:", err);
  }
}

// =====================================================
// REPORTS
// =====================================================

async function loadReports() {
  try {
    const [cityRes, collegeRes, occupancyRes, overviewRes] = await Promise.all([
      fetch(`${API}/admin/reports/cities`, { headers: { Authorization: `Bearer ${state.token}` } }),
      fetch(`${API}/admin/reports/colleges`, { headers: { Authorization: `Bearer ${state.token}` } }),
      fetch(`${API}/admin/properties/occupancy`, { headers: { Authorization: `Bearer ${state.token}` } }),
      fetch(`${API}/admin/reports/overview`, { headers: { Authorization: `Bearer ${state.token}` } }),
    ]);

    const cityData = await cityRes.json();
    const collegeData = await collegeRes.json();
    const occupancyData = await occupancyRes.json();
    const overviewData = await overviewRes.json();

    if (cityData.success) createCityChart(cityData.cities || []);
    if (collegeData.success) createCollegeChart(collegeData.colleges || []);

    if (overviewData.success) {
      const o = overviewData.overview || {};
      DOM.reportStats.innerHTML = `
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(37,99,235,.15);color:#60a5fa"><i class="fa-solid fa-users"></i></div><div class="admin-stat-title">Users</div><div class="admin-stat-value">${o.users || 0}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(124,58,237,.15);color:#a78bfa"><i class="fa-solid fa-building"></i></div><div class="admin-stat-title">Properties</div><div class="admin-stat-value">${o.properties || 0}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(6,182,212,.15);color:#22d3ee"><i class="fa-solid fa-calendar-check"></i></div><div class="admin-stat-title">Bookings</div><div class="admin-stat-value">${o.bookings || 0}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(34,197,94,.15);color:#4ade80"><i class="fa-solid fa-star"></i></div><div class="admin-stat-title">Reviews</div><div class="admin-stat-value">${o.reviews || 0}</div></div>`;
    }

    if (occupancyData.success) {
      const report = occupancyData.report || [];
      if (report.length === 0) {
        DOM.occupancyTable.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b">No properties with beds</td></tr>`;
      } else {
        DOM.occupancyTable.innerHTML = report.map((p) => {
          const rate = p.totalBeds > 0 ? Math.round(((p.totalBeds - p.availableBeds) / p.totalBeds) * 100) : 0;
          return `<tr><td><strong>${p.propertyName || "Property"}</strong></td><td>${p.city || ""}</td><td>${p.totalBeds || 0}</td><td>${p.availableBeds || 0}</td><td>${p.occupiedBeds || 0}</td><td><span class="admin-status ${rate > 80 ? 'approved' : rate > 40 ? 'pending' : 'suspended'}">${rate}%</span></td></tr>`;
        }).join("");
      }
    }
  } catch (err) {
    console.error("Reports error:", err);
  }
}

// =====================================================
// SETTINGS
// =====================================================

async function loadSettings() {
  try {
    const res = await fetch(`${API}/admin/settings`, { headers: { Authorization: `Bearer ${state.token}` } });
    const data = await res.json();
    if (data.success) {
      const s = data.settings || {};
      if (DOM.setSiteName) DOM.setSiteName.value = s.siteName || "Campora";
      if (DOM.setSupportEmail) DOM.setSupportEmail.value = s.supportEmail || "";
      if (DOM.setSupportPhone) DOM.setSupportPhone.value = s.supportPhone || "";
      if (DOM.setCommission) DOM.setCommission.value = s.commissionPercentage || 0;
      if (DOM.setMaintenance) DOM.setMaintenance.checked = s.maintenanceMode || false;
      if (DOM.setRegistration) DOM.setRegistration.checked = s.allowRegistration !== false;
      if (DOM.setPropertyUpload) DOM.setPropertyUpload.checked = s.allowPropertyUpload !== false;
    }
  } catch (err) {
    console.error("Settings load error:", err);
  }
}

async function saveSettings() {
  try {
    const body = {
      siteName: DOM.setSiteName?.value || "Campora",
      supportEmail: DOM.setSupportEmail?.value || "",
      supportPhone: DOM.setSupportPhone?.value || "",
      commissionPercentage: Number(DOM.setCommission?.value) || 0,
      maintenanceMode: DOM.setMaintenance?.checked || false,
      allowRegistration: DOM.setRegistration?.checked !== false,
      allowPropertyUpload: DOM.setPropertyUpload?.checked !== false,
    };

    const res = await fetch(`${API}/admin/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Settings saved successfully!", "success");
    }
  } catch (err) {
    showToast("Failed to save settings", "error");
  }
}

// =====================================================
// SYSTEM
// =====================================================

async function loadSystem() {
  try {
    const [healthRes, dbRes, serverRes] = await Promise.all([
      fetch(`${API}/admin/system/health`, { headers: { Authorization: `Bearer ${state.token}` } }),
      fetch(`${API}/admin/system/database`, { headers: { Authorization: `Bearer ${state.token}` } }),
      fetch(`${API}/admin/system/server`, { headers: { Authorization: `Bearer ${state.token}` } }),
    ]);

    const healthData = await healthRes.json();
    const dbData = await dbRes.json();
    const serverData = await serverRes.json();

    if (healthData.success) {
      const h = healthData;
      const mem = h.memory || {};
      DOM.systemStats.innerHTML = `
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(37,99,235,.15);color:#60a5fa"><i class="fa-solid fa-server"></i></div><div class="admin-stat-title">Server</div><div class="admin-stat-value" style="font-size:20px">${h.server || "Running"}</div><div class="admin-stat-sub">Node ${h.node || ""}</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(124,58,237,.15);color:#a78bfa"><i class="fa-solid fa-clock"></i></div><div class="admin-stat-title">Uptime</div><div class="admin-stat-value" style="font-size:20px">${Math.floor((h.uptime || 0) / 3600)}h ${Math.floor(((h.uptime || 0) % 3600) / 60)}m</div></div>
        <div class="admin-stat-card"><div class="admin-stat-icon" style="background:rgba(6,182,212,.15);color:#22d3ee"><i class="fa-solid fa-microchip"></i></div><div class="admin-stat-title">Memory (RSS)</div><div class="admin-stat-value" style="font-size:20px">${mem.rss ? Math.round(mem.rss / 1024 / 1024) + " MB" : "N/A"}</div></div>`;
    }

    if (serverData.success) {
      const s = serverData;
      DOM.systemInfoTable.innerHTML = `
        <tr><td style="color:#94a3b8">Platform</td><td>${s.platform || "N/A"}</td></tr>
        <tr><td style="color:#94a3b8">Architecture</td><td>${s.architecture || "N/A"}</td></tr>
        <tr><td style="color:#94a3b8">Node Version</td><td>${s.nodeVersion || "N/A"}</td></tr>
        <tr><td style="color:#94a3b8">Environment</td><td>${s.environment || "development"}</td></tr>
        <tr><td style="color:#94a3b8">PID</td><td>${s.pid || "N/A"}</td></tr>`;
    }

    if (dbData.success) {
      const db = dbData;
      const row = document.createElement("tr");
      row.innerHTML = `<td style="color:#94a3b8">Database</td><td>${db.name || "campora"} (${db.host || "local"}) ${db.database === 1 ? "✅" : "❌"}</td>`;
      DOM.systemInfoTable.appendChild(row);
    }
  } catch (err) {
    console.error("System load error:", err);
  }
}

// =====================================================
// CHARTS
// =====================================================

function createPropertyChart(total, approved, pending, rejected) {
  const ctx = document.getElementById("propertyChart")?.getContext("2d");
  if (!ctx) return;
  if (state.charts.property) state.charts.property.destroy();
  state.charts.property = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: ["Approved", "Pending", "Rejected"],
      datasets: [{ data: [approved, pending, rejected], backgroundColor: ["#22c55e", "#f59e0b", "#ef4444"], borderWidth: 0 }],
    },
    options: { responsive: true, maintainAspectRatio: true, plugins: { legend: { position: "bottom", labels: { color: "#94a3b8" } } } },
  });
}

function createRevenueChart(total, avg) {
  const ctx = document.getElementById("revenueChart")?.getContext("2d");
  if (!ctx) return;
  if (state.charts.revenue) state.charts.revenue.destroy();
  state.charts.revenue = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Total Revenue", "Average"],
      datasets: [{ data: [total, avg], backgroundColor: ["#2563eb", "#7c3aed"], borderRadius: 8 }],
    },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { ticks: { color: "#94a3b8", callback: (v) => "₹" + v.toLocaleString() } } } },
  });
}

function createBookingTrendChart(growth) {
  const ctx = document.getElementById("bookingTrendChart")?.getContext("2d");
  if (!ctx) return;
  if (state.charts.bookingTrend) state.charts.bookingTrend.destroy();

  const labels = growth.map((g) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${months[(g._id?.month || 1) - 1]} ${g._id?.year || ""}`;
  }).slice(-12);
  const data = growth.map((g) => g.bookings || 0).slice(-12);

  state.charts.bookingTrend = new Chart(ctx, {
    type: "line",
    data: { labels, datasets: [{ data, borderColor: "#2563eb", backgroundColor: "rgba(37,99,235,.1)", fill: true, tension: .4, pointRadius: 4 }] },
    options: { responsive: true, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { color: "#94a3b8" } }, x: { ticks: { color: "#94a3b8" } } } },
  });
}

function createCityChart(cities) {
  const ctx = document.getElementById("cityChart")?.getContext("2d");
  if (!ctx) return;
  if (state.charts.city) state.charts.city.destroy();

  const top = cities.slice(0, 8);
  state.charts.city = new Chart(ctx, {
    type: "bar",
    data: { labels: top.map((c) => c._id || "Unknown"), datasets: [{ data: top.map((c) => c.totalProperties || 0), backgroundColor: ["#2563eb", "#7c3aed", "#06b6d4", "#22c55e", "#f59e0b", "#ef4444", "#a855f7", "#14b8a6"], borderRadius: 6 }] },
    options: { responsive: true, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#94a3b8" } }, y: { ticks: { color: "#94a3b8" } } } },
  });
}

function createCollegeChart(colleges) {
  const ctx = document.getElementById("collegeChart")?.getContext("2d");
  if (!ctx) return;
  if (state.charts.college) state.charts.college.destroy();

  const top = colleges.slice(0, 8);
  state.charts.college = new Chart(ctx, {
    type: "bar",
    data: { labels: top.map((c) => c._id || "Unknown"), datasets: [{ data: top.map((c) => c.totalProperties || 0), backgroundColor: "#7c3aed", borderRadius: 6 }] },
    options: { responsive: true, indexAxis: "y", plugins: { legend: { display: false } }, scales: { x: { ticks: { color: "#94a3b8" } }, y: { ticks: { color: "#94a3b8" } } } },
  });
}

// =====================================================
// MODAL
// =====================================================

function openModal(title, body) {
  DOM.modalTitle.textContent = title;
  DOM.modalBody.innerHTML = body;
  DOM.modalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  DOM.modalOverlay.classList.remove("active");
  document.body.style.overflow = "";
}

// =====================================================
// GLOBAL ADMIN ACTIONS
// =====================================================

// Users
window.viewUser = async (id) => {
  try {
    const res = await fetch(`${API}/admin/users/${id}`, { headers: { Authorization: `Bearer ${state.token}` } });
    const data = await res.json();
    if (data.success) {
      const u = data.user || {};
      openModal(`User: ${u.name || "Unknown"}`, `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div><strong>Name:</strong><br>${u.name || "N/A"}</div>
          <div><strong>Email:</strong><br>${u.email || "N/A"}</div>
          <div><strong>Role:</strong><br>${u.role || "N/A"}</div>
          <div><strong>Phone:</strong><br>${u.phone || "N/A"}</div>
          <div><strong>College:</strong><br>${u.college || "N/A"}</div>
          <div><strong>Status:</strong><br>${u.status || "active"}</div>
          <div><strong>Joined:</strong><br>${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "N/A"}</div>
          <div><strong>Last Login:</strong><br>${u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : "N/A"}</div>
        </div>
        ${u.verified ? '<p style="margin-top:16px;color:#22c55e">✅ Verified Owner</p>' : ""}`);
    }
  } catch (err) { console.error(err); }
};

window.suspendUser = async (id) => {
  if (!confirm("Suspend this user?")) return;
  try {
    await supabaseAPI.disableUser(id);
    showToast("User suspended", "info"); loadUsers();
  } catch (err) { showToast("Failed", "error"); }
};

window.activateUser = async (id) => {
  try {
    await supabaseAPI.activateUser(id);
    showToast("User activated", "success"); loadUsers();
  } catch (err) { showToast("Failed", "error"); }
};

window.approveOwner = async (id) => {
  try {
    await supabaseAPI.approveOwner(id);
    showToast("Owner approved successfully!", "success"); loadUsers();
  } catch (err) { showToast("Failed to approve owner", "error"); }
};

window.rejectOwner = async (id) => {
  if (!confirm("Reject this owner application?")) return;
  try {
    await supabaseAPI.rejectOwner(id);
    showToast("Owner rejected", "info"); loadUsers();
  } catch (err) { showToast("Failed to reject owner", "error"); }
};

window.verifyOwner = async (id) => {
  try {
    await supabaseAPI.approveOwner(id);
    showToast("Owner verified & approved!", "success"); loadUsers();
  } catch (err) { showToast("Failed", "error"); }
};

// Properties
window.approveProperty = async (id) => {
  try {
    await supabaseAPI.approveProperty(id);
    showToast("Property approved!", "success"); loadProperties();
  } catch (err) { showToast("Failed", "error"); }
};

window.rejectProperty = async (id) => {
  if (!confirm("Reject this property?")) return;
  try {
    await supabaseAPI.rejectProperty(id);
    showToast("Property rejected", "info"); loadProperties();
  } catch (err) { showToast("Failed", "error"); }
};

window.featureProperty = async (id) => {
  try {
    await supabaseAPI.featureProperty(id);
    showToast("Property featured status updated!", "success"); loadProperties();
  } catch (err) { showToast("Failed", "error"); }
};

// Bookings
window.confirmBooking = async (id) => {
  try {
    showToast("Booking status updated", "success"); loadBookings();
  } catch (err) { showToast("Failed", "error"); }
};

window.cancelBooking = async (id) => {
  if (!confirm("Cancel this booking?")) return;
  try {
    showToast("Booking cancelled", "info"); loadBookings();
  } catch (err) { showToast("Failed", "error"); }
};

window.markPaid = async (id) => {
  try {
    showToast("Payment marked as received", "success"); loadBookings();
  } catch (err) { showToast("Failed", "error"); }
};

window.markPaymentPaid = async (id) => {
  try {
    showToast("Payment marked as paid", "success"); loadPayments();
  } catch (err) { showToast("Failed", "error"); }
};

// Reviews
window.approveReview = async (id) => {
  try {
    await supabaseAPI.approveReview(id);
    showToast("Review approved", "success"); loadReviews();
  } catch (err) { showToast("Failed", "error"); }
};

window.hideReview = async (id) => {
  try {
    await supabaseAPI.hideReview(id);
    showToast("Review hidden", "info"); loadReviews();
  } catch (err) { showToast("Failed", "error"); }
};

window.deleteReview = async (id) => {
  if (!confirm("Delete this review?")) return;
  try {
    await supabaseAPI.deleteReview(id);
    showToast("Review deleted", "info"); loadReviews();
  } catch (err) { showToast("Failed", "error"); }
};

// =====================================================
// TOAST
// =====================================================

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

// =====================================================
// TIME AGO
// =====================================================

function timeAgo(dateInput) {
  if (!dateInput) return "";
  const now = new Date();
  const date = new Date(dateInput);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// =====================================================
// RESPONSIVE SIDEBAR
// =====================================================

// Close sidebar on escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") DOM.sidebar?.classList.remove("open");
});

// Show mobile menu button on small screens
function checkMobile() {
  if (window.innerWidth <= 1024) {
    DOM.menuBtn.style.display = "flex";
  } else {
    DOM.menuBtn.style.display = "none";
    DOM.sidebar?.classList.remove("open");
  }
}

checkMobile();
window.addEventListener("resize", checkMobile);

// =====================================================
// EXPOSE TOAST & ADMIN MANAGEMENT UI
// =====================================================

window.showToast = showToast;

async function checkSuperAdminPermissions() {
  try {
    const res = await fetch(`${API}/admin/scopes`, { headers: { Authorization: `Bearer ${state.token}` } });
    if (!res.ok) return;
    const data = await res.json();
    if (data.success && data.currentAdminScope && data.currentAdminScope.isGlobal) {
      const navItem = document.getElementById("adminMgmtNavItem");
      if (navItem) navItem.style.display = "flex";
      state.isSuperAdmin = true;
    }
  } catch (e) {
    console.error("Failed checking super admin permissions", e);
  }
}

async function loadAdminManagement(force = false) {
  const tbody = document.getElementById("adminManagementTable");
  if (!tbody) return;
  
  try {
    const res = await fetch(`${API}/admin/administrators`, { headers: { Authorization: `Bearer ${state.token}` } });
    if (res.status === 403) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444">Access denied. Super Admin privileges required.</td></tr>`;
      return;
    }
    
    const data = await res.json();
    if (!data.success || !data.administrators) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b">No administrators found.</td></tr>`;
      return;
    }

    if (data.administrators.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#64748b">No administrators found.</td></tr>`;
      return;
    }

    tbody.innerHTML = data.administrators.map(a => {
      const isSuper = (a.scopes || []).some(s => s.scope_type === 'GLOBAL') || a.email === 'camporaforstudents@gmail.com';
      const roleBadge = isSuper 
        ? `<span class="admin-status active" style="background:rgba(124,58,237,.15);color:#a78bfa"><i class="fa-solid fa-crown" style="margin-right:4px"></i>SUPER_ADMIN</span>`
        : `<span class="admin-status info" style="background:rgba(59,130,246,.15);color:#60a5fa"><i class="fa-solid fa-location-dot" style="margin-right:4px"></i>AREA_ADMIN</span>`;
      
      const isActive = a.account_status === 'ACTIVE' || a.status === 'active';
      const statusBadge = isActive
        ? `<span class="admin-status active">ACTIVE</span>`
        : `<span class="admin-status suspended">DISABLED</span>`;

      const areasHTML = (a.scopes && a.scopes.length > 0)
        ? a.scopes.map(s => {
            const label = s.scope_type === 'GLOBAL' ? 'GLOBAL (India)' : s.scope_type === 'STATE' ? `${s.state} (State)` : `${s.city}, ${s.state} (City)`;
            return `<span style="display:inline-flex;align-items:center;gap:4px;padding:2px 8px;border-radius:6px;background:rgba(255,255,255,.08);font-size:11px;margin:2px">
              ${label}
              ${!isSuper ? `<i class="fa-solid fa-xmark" style="cursor:pointer;color:#ef4444;margin-left:4px" title="Remove Scope" onclick="window.removeAdminScope('${s.id}')"></i>` : ''}
            </span>`;
          }).join('')
        : `<span style="color:#64748b;font-size:12px">No scopes assigned</span>`;

      const actionButtons = `
        <div class="action-group">
          <button class="admin-btn admin-btn-sm admin-btn-primary" onclick="window.openAddScopeModal('${a.id}', '${a.name}')">+ Scope</button>
          ${isActive 
            ? `<button class="admin-btn admin-btn-sm admin-btn-danger" onclick="window.toggleAdminStatus('${a.id}', 'DISABLED')">Disable</button>`
            : `<button class="admin-btn admin-btn-sm admin-btn-success" onclick="window.toggleAdminStatus('${a.id}', 'ACTIVE')">Enable</button>`
          }
        </div>
      `;

      return `
        <tr>
          <td>
            <div style="font-weight:600;color:#fff">${a.name || 'Admin User'}</div>
            <div style="font-size:12px;color:#94a3b8">${a.email}</div>
          </td>
          <td>${roleBadge}</td>
          <td>${statusBadge}</td>
          <td>${areasHTML}</td>
          <td style="font-size:12px;color:#94a3b8">${new Date(a.created_at || Date.now()).toLocaleDateString()}</td>
          <td>${actionButtons}</td>
        </tr>
      `;
    }).join('');

  } catch (err) {
    console.error("loadAdminManagement error:", err);
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:#ef4444">Failed to load administrators.</td></tr>`;
  }
}

function openCreateAdminModalDialog() {
  openModal(`Create New Administrator`, `
    <form id="createAdminForm" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">Full Name *</label>
        <input type="text" id="adminNameInput" class="admin-filter-bar" style="width:100%" placeholder="e.g. Rahul Sharma" required />
      </div>
      <div>
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">Email Address *</label>
        <input type="email" id="adminEmailInput" class="admin-filter-bar" style="width:100%" placeholder="e.g. admin.delhi@campora.in" required />
      </div>
      <div>
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">Password *</label>
        <input type="password" id="adminPasswordInput" class="admin-filter-bar" style="width:100%" placeholder="Min 6 characters" required minlength="6" />
      </div>
      <div>
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">Admin Role *</label>
        <select id="adminRoleSelect" class="admin-filter-bar" style="width:100%">
          <option value="AREA_ADMIN">AREA_ADMIN (Geographic Scope)</option>
          <option value="SUPER_ADMIN">SUPER_ADMIN (Global Access)</option>
        </select>
      </div>
      <div id="newScopeTypeGroup">
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">Initial Scope Type *</label>
        <select id="newScopeTypeSelect" class="admin-filter-bar" style="width:100%">
          <option value="STATE">STATE (State-Level Admin)</option>
          <option value="CITY">CITY (City-Level Admin)</option>
        </select>
      </div>
      <div id="newStateGroup">
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">State *</label>
        <input type="text" id="newStateInput" class="admin-filter-bar" style="width:100%" placeholder="e.g. Delhi, Maharashtra" required />
      </div>
      <div id="newCityGroup" style="display:none">
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">City *</label>
        <input type="text" id="newCityInput" class="admin-filter-bar" style="width:100%" placeholder="e.g. Mumbai, Pune, Delhi" />
      </div>
      <div>
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">Initial Status *</label>
        <select id="adminStatusSelect" class="admin-filter-bar" style="width:100%">
          <option value="ACTIVE">ACTIVE</option>
          <option value="DISABLED">DISABLED</option>
        </select>
      </div>
      <button type="submit" class="admin-btn admin-btn-primary" style="margin-top:10px;padding:12px">Create Administrator</button>
    </form>
  `);

  const roleSelect = document.getElementById("adminRoleSelect");
  const scopeTypeGroup = document.getElementById("newScopeTypeGroup");
  const scopeTypeSelect = document.getElementById("newScopeTypeSelect");
  const stateGrp = document.getElementById("newStateGroup");
  const cityGrp = document.getElementById("newCityGroup");
  const stateInp = document.getElementById("newStateInput");
  const cityInp = document.getElementById("newCityInput");

  roleSelect?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "SUPER_ADMIN") {
      scopeTypeGroup.style.display = "none";
      stateGrp.style.display = "none";
      cityGrp.style.display = "none";
      stateInp.required = false;
      cityInp.required = false;
    } else {
      scopeTypeGroup.style.display = "block";
      stateGrp.style.display = "block";
      stateInp.required = true;
      if (scopeTypeSelect.value === "CITY") {
        cityGrp.style.display = "block";
        cityInp.required = true;
      }
    }
  });

  scopeTypeSelect?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "CITY") {
      cityGrp.style.display = "block";
      cityInp.required = true;
    } else {
      cityGrp.style.display = "none";
      cityInp.required = false;
    }
  });

  document.getElementById("createAdminForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const name = document.getElementById("adminNameInput").value.trim();
    const email = document.getElementById("adminEmailInput").value.trim();
    const password = document.getElementById("adminPasswordInput").value;
    const role = roleSelect.value;
    const scopeType = role === "SUPER_ADMIN" ? "GLOBAL" : scopeTypeSelect.value;
    const state = stateInp.value.trim();
    const city = cityInp.value.trim();
    const status = document.getElementById("adminStatusSelect").value;

    try {
      const res = await fetch(`${API}/admin/create-admin`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ name, email, password, role, scopeType, state, city, status })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Administrator created successfully!", "success");
        closeModal();
        loadAdminManagement(true);
      } else {
        showToast(data.message || "Failed to create administrator", "error");
      }
    } catch (err) {
      showToast("Error creating administrator", "error");
    }
  });
}

window.openAddScopeModal = (adminId, adminName) => {
  openModal(`Add Area Scope for ${adminName}`, `
    <form id="addScopeForm" style="display:flex;flex-direction:column;gap:14px">
      <div>
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">Scope Type *</label>
        <select id="scopeTypeInput" class="admin-filter-bar" style="width:100%" required>
          <option value="STATE">STATE (State-Level Admin)</option>
          <option value="CITY">CITY (City-Level Admin)</option>
          <option value="GLOBAL">GLOBAL (India-Wide Super Admin)</option>
        </select>
      </div>
      <div id="stateFieldGroup">
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">State *</label>
        <input type="text" id="stateInput" class="admin-filter-bar" style="width:100%" placeholder="e.g. Delhi, Maharashtra, Karnataka" required />
      </div>
      <div id="cityFieldGroup" style="display:none">
        <label style="display:block;font-size:13px;color:#94a3b8;margin-bottom:4px">City *</label>
        <input type="text" id="cityInput" class="admin-filter-bar" style="width:100%" placeholder="e.g. Mumbai, Pune, Bangalore" />
      </div>
      <button type="submit" class="admin-btn admin-btn-primary" style="margin-top:10px;padding:12px">Assign Scope</button>
    </form>
  `);

  const scopeTypeSelect = document.getElementById("scopeTypeInput");
  const stateGrp = document.getElementById("stateFieldGroup");
  const cityGrp = document.getElementById("cityFieldGroup");
  const stateInp = document.getElementById("stateInput");
  const cityInp = document.getElementById("cityInput");

  scopeTypeSelect?.addEventListener("change", (e) => {
    const val = e.target.value;
    if (val === "GLOBAL") {
      stateGrp.style.display = "none";
      cityGrp.style.display = "none";
      stateInp.required = false;
      cityInp.required = false;
    } else if (val === "STATE") {
      stateGrp.style.display = "block";
      cityGrp.style.display = "none";
      stateInp.required = true;
      cityInp.required = false;
    } else if (val === "CITY") {
      stateGrp.style.display = "block";
      cityGrp.style.display = "block";
      stateInp.required = true;
      cityInp.required = true;
    }
  });

  document.getElementById("addScopeForm")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const scopeType = scopeTypeSelect.value;
    const state = stateInp.value.trim();
    const city = cityInp.value.trim();

    try {
      const res = await fetch(`${API}/admin/scopes`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
        body: JSON.stringify({ adminUserId: adminId, scopeType, state, city })
      });
      const data = await res.json();
      if (data.success) {
        showToast("Scope assigned successfully!", "success");
        closeModal();
        loadAdminManagement(true);
      } else {
        showToast(data.message || "Failed to assign scope", "error");
      }
    } catch (err) {
      showToast("Error assigning scope", "error");
    }
  });
};

window.removeAdminScope = async (scopeId) => {
  if (!confirm("Are you sure you want to remove this area scope?")) return;
  try {
    const res = await fetch(`${API}/admin/scopes/${scopeId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` }
    });
    const data = await res.json();
    if (data.success) {
      showToast("Scope removed successfully", "info");
      loadAdminManagement(true);
    } else {
      showToast(data.message || "Failed to remove scope", "error");
    }
  } catch (err) {
    showToast("Error removing scope", "error");
  }
};

window.toggleAdminStatus = async (adminId, status) => {
  const actionText = status === "DISABLED" ? "disable" : "enable";
  if (!confirm(`Are you sure you want to ${actionText} this administrator?`)) return;
  try {
    const res = await fetch(`${API}/admin/scopes/status/${adminId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Administrator ${actionText}d successfully`, "success");
      loadAdminManagement(true);
    } else {
      showToast(data.message || "Failed to update administrator status", "error");
    }
  } catch (err) {
    showToast("Error updating status", "error");
  }
};

document.getElementById("openCreateAdminModal")?.addEventListener("click", openCreateAdminModalDialog);

console.log("✅ Campora Admin Dashboard Loaded");
