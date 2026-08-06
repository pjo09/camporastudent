// =====================================================
// CAMPORA NOTIFICATIONS PAGE
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

const $ = (id) => document.getElementById(id);

const DOM = {
  skeleton: $("notifSkeleton"),
  list: $("notifList"),
  empty: $("notifEmpty"),
  errorState: $("notifError"),
  retryBtn: $("retryNotifBtn"),
  markAllBtn: $("markAllBtn"),
  filterBtns: document.querySelectorAll(".filter-btn"),
  pagination: $("notifPagination"),
  prevPage: $("prevPage"),
  nextPage: $("nextPage"),
  pageInfo: $("pageInfo"),
};

const state = {
  user: null,
  token: null,
  notifications: [],
  currentFilter: "all",
  currentPage: 1,
  perPage: 15,
};

state.user = protectPageByRole(["student"]);
state.token = getToken();
if (!state.user || !state.token) {}

setupEventListeners();
loadNotifications();

function setupEventListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      state.currentPage = 1;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderNotifications();
    });
  });

  DOM.markAllBtn?.addEventListener("click", markAllRead);

  DOM.retryBtn?.addEventListener("click", loadNotifications);

  DOM.prevPage?.addEventListener("click", () => {
    if (state.currentPage > 1) { state.currentPage--; renderNotifications(); }
  });
  DOM.nextPage?.addEventListener("click", () => {
    const totalPages = Math.ceil(state.filtered.length / state.perPage);
    if (state.currentPage < totalPages) { state.currentPage++; renderNotifications(); }
  });
}

async function loadNotifications() {
  showSkeleton();
  hideError();
  hideEmpty();

  try {
    const res = await fetch(`${API}/student/notifications`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    state.notifications = data.notifications || [];
    const unreadCount = data.unreadCount || 0;

    // Update mark all button
    if (DOM.markAllBtn) {
      DOM.markAllBtn.hidden = unreadCount === 0;
    }

    hideSkeleton();
    renderNotifications();
  } catch (err) {
    console.error("Notifications load error:", err);
    hideSkeleton();
    showError();
  }
}

function renderNotifications() {
  let filtered = [...state.notifications];

  if (state.currentFilter === "unread") {
    filtered = filtered.filter((n) => !n.isRead);
  } else if (state.currentFilter !== "all") {
    filtered = filtered.filter((n) => n.type === state.currentFilter);
  }

  if (filtered.length === 0) {
    DOM.list.hidden = true;
    DOM.empty.hidden = false;
    DOM.pagination.hidden = true;
    return;
  }

  DOM.list.hidden = false;
  DOM.empty.hidden = true;

  // Pagination
  const totalPages = Math.ceil(filtered.length / state.perPage);
  const start = (state.currentPage - 1) * state.perPage;
  const end = start + state.perPage;
  const pageItems = filtered.slice(start, end);

  DOM.list.innerHTML = "";

  pageItems.forEach((n) => {
    const isUnread = !n.isRead;
    const time = n.createdAt ? timeAgo(n.createdAt) : "";
    const typeIcons = {
      booking: "fa-calendar-check",
      payment: "fa-credit-card",
      property: "fa-building",
      system: "fa-gear",
      general: "fa-bell",
    };
    const icon = typeIcons[n.type] || "fa-bell";

    const row = document.createElement("div");
    row.className = `notification-row ${isUnread ? "unread" : ""}`;
    row.style.cursor = "pointer";
    row.innerHTML = `
      <div class="notification-dot ${isUnread ? "active" : ""}" style="background:${isUnread ? "linear-gradient(135deg,#2563eb,#7c3aed)" : "transparent"}"></div>
      <div style="display:flex;gap:14px;align-items:flex-start;flex:1">
        <div style="width:40px;height:40px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(37,99,235,.12);color:#60a5fa;flex-shrink:0">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div style="flex:1">
          <div class="notification-title">${n.title || "Campora"}</div>
          <div class="notification-message">${n.message || ""}</div>
          <div class="notification-time">${time}</div>
        </div>
      </div>
      <div style="display:flex;gap:6px;align-items:center;flex-shrink:0">
        ${isUnread ? `<button class="mark-read-btn" data-id="${n._id}" style="padding:6px 12px;font-size:12px">Mark Read</button>` : ""}
        <button class="delete-notif-btn" data-id="${n._id}" style="width:32px;height:32px;border:none;border-radius:8px;background:rgba(239,68,68,.1);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center" aria-label="Delete notification">
          <i class="fa-solid fa-trash" style="font-size:12px"></i>
        </button>
      </div>`;

    // Mark read
    const markBtn = row.querySelector(".mark-read-btn");
    if (markBtn) {
      markBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        markRead(markBtn.dataset.id);
      });
    }

    // Delete
    const delBtn = row.querySelector(".delete-notif-btn");
    delBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      deleteNotification(delBtn.dataset.id);
    });

    DOM.list.appendChild(row);
  });

  // Pagination
  if (totalPages > 1) {
    DOM.pagination.hidden = false;
    DOM.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    DOM.prevPage.disabled = state.currentPage <= 1;
    DOM.nextPage.disabled = state.currentPage >= totalPages;
  } else {
    DOM.pagination.hidden = true;
  }
}

async function markRead(id) {
  try {
    const res = await fetch(`${API}/student/notifications/${id}/read`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (data.success) {
      const notif = state.notifications.find((n) => n._id === id);
      if (notif) notif.isRead = true;
      renderNotifications();
    }
  } catch (err) {
    console.error("Mark read error:", err);
  }
}

async function markAllRead() {
  try {
    const res = await fetch(`${API}/student/notifications/read-all`, {
      method: "PUT",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (data.success) {
      state.notifications.forEach((n) => (n.isRead = true));
      renderNotifications();
      showToast("All notifications marked as read", "success");
    }
  } catch (err) {
    console.error("Mark all read error:", err);
  }
}

async function deleteNotification(id) {
  if (!confirm("Delete this notification?")) return;
  try {
    const res = await fetch(`${API}/student/notifications/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (data.success) {
      state.notifications = state.notifications.filter((n) => n._id !== id);
      renderNotifications();
      showToast("Notification deleted", "info");
    }
  } catch (err) {
    console.error("Delete notification error:", err);
  }
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

function timeAgo(dateInput) {
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

function showSkeleton() { if (DOM.skeleton) DOM.skeleton.hidden = false; }
function hideSkeleton() { if (DOM.skeleton) DOM.skeleton.hidden = true; }
function hideEmpty() { if (DOM.empty) DOM.empty.hidden = true; }
function showError() { if (DOM.errorState) DOM.errorState.hidden = false; }
function hideError() { if (DOM.errorState) DOM.errorState.hidden = true; }

console.log("✅ Notifications Page Loaded");

