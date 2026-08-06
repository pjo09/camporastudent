// =====================================================
// CAMPORA OWNER NOTIFICATIONS V3
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  notificationsList: $("notificationsList"),
  refreshBtn: $("refreshBtn"),
};

// =====================================================
// INIT
// =====================================================

initShell("Notifications");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadNotifications();
});

function setupListeners() {
  DOM.refreshBtn?.addEventListener("click", loadNotifications);
}

// =====================================================
// LOAD NOTIFICATIONS
// =====================================================

async function loadNotifications() {
  DOM.notificationsList.innerHTML = `<div class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading notifications...</div>`;

  try {
    const [data, msgData] = await Promise.all([
      apiFetch("/owner/notifications"),
      apiFetch("/owner/messages/unread-count").catch(() => ({ unreadCount: 0 })),
    ]);

    const notifications = data.notifications || [];
    const unread = msgData.unreadCount || 0;

    // Build combined list with unread messages alert first
    const combined = [];
    if (unread > 0) {
      combined.push({
        type: "message",
        title: "Unread Messages",
        message: `You have ${unread} unread message(s) from students.`,
        priority: "high",
      });
    }
    combined.push(...notifications);

    renderNotifications(combined);
  } catch (err) {
    console.error("Notifications load error:", err);
    DOM.notificationsList.innerHTML = `<div class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load</h3><p>${err.message}</p></div>`;
  }
}

function renderNotifications(notifications) {
  if (notifications.length === 0) {
    DOM.notificationsList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-bell-slash"></i><h3>No Notifications</h3><p>You're all caught up!</p></div>`;
    return;
  }

  const icons = {
    booking: "fa-calendar-check",
    property: "fa-building",
    message: "fa-comments",
    payment: "fa-indian-rupee-sign",
    maintenance: "fa-screwdriver-wrench",
    review: "fa-star",
    general: "fa-bell",
  };

  const colors = {
    booking: "#3b82f6",
    property: "#7c3aed",
    message: "#06b6d4",
    payment: "#22c55e",
    maintenance: "#f59e0b",
    review: "#fbbf24",
    general: "#60a5fa",
  };

  const links = {
    booking: "/pages/owner/bookings.html",
    property: "/pages/owner/properties.html",
    message: "/pages/owner/messages.html",
    payment: "/pages/owner/payments.html",
    maintenance: "/pages/owner/maintenance.html",
    review: "/pages/owner/reviews.html",
    general: "/pages/owner//pages/student/dashboard.html",
  };

  DOM.notificationsList.innerHTML = notifications.map((n, idx) => {
    const type = n.type || "general";
    const icon = icons[type] || icons.general;
    const color = colors[type] || colors.general;
    const link = links[type] || links.general;
    const time = n.createdAt ? timeAgo(n.createdAt) : "";
    return `
      <a href="${link}" class="v3-card v3-animate" style="display:flex;gap:16px;align-items:flex-start;padding:20px;text-decoration:none">
        <div style="width:48px;height:48px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:${color}22;color:${color};flex-shrink:0;font-size:20px">
          <i class="fa-solid ${icon}"></i>
        </div>
        <div style="flex:1;min-width:0">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <strong style="font-size:15px">${n.title || "Notification"}</strong>
            ${n.priority === "high" ? '<span class="v3-pill v3-pill-danger">HIGH</span>' : ""}
          </div>
          <p style="color:var(--v3-muted);font-size:13.5px;margin-top:6px;line-height:1.6">${n.message || ""}</p>
          ${time ? `<span style="color:var(--v3-muted);font-size:12px;margin-top:6px;display:block">${time}</span>` : ""}
        </div>
        <i class="fa-solid fa-chevron-right" style="color:var(--v3-muted);align-self:center"></i>
      </a>`;
  }).join("");
}

function timeAgo(input) {
  const now = new Date();
  const date = new Date(input);
  const diff = (now - date) / 1000;
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
  return date.toLocaleDateString();
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Notifications V3 initialised");
