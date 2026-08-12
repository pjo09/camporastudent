// =====================================================
// CAMPORA STUDENT V3 - NOTIFICATIONS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, esc, timeAgo, showToast } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  loadNotifications();
  $("markAllRead")?.addEventListener("click", markAllRead);
});

async function loadNotifications() {
  const list = $("notificationList");
  if (!list) return;
  try {
    const data = await apiFetch("/student/notifications");
    const notifications = data.notifications || [];
    if (notifications.length === 0) {
      list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-bell"></i><h3>No notifications</h3><p>You're all caught up!</p></div>`;
      return;
    }
    list.innerHTML = notifications.map((n) => {
      const unread = !n.isRead;
      const type = n.type || "general";
      const icon = type === "booking" ? "fa-calendar-check" : type === "payment" ? "fa-credit-card" : type === "maintenance" ? "fa-screwdriver-wrench" : "fa-bell";
      return `
        <div class="sv3-list-item ${unread ? "sv3-unread" : ""}" ${unread ? `onclick="window.markRead('${n._id}', this)"` : ""}>
          <div class="sv3-list-item-icon ${unread ? "sv3-i-blue" : ""}"><i class="fa-solid ${icon}"></i></div>
          <div class="sv3-list-item-body">
            <div class="sv3-list-item-title">${esc(n.title || "Campora")}</div>
            <div class="sv3-list-item-sub">${esc(n.message || "")}</div>
            <div class="sv3-list-item-sub">${timeAgo(n.createdAt)}</div>
          </div>
          ${unread ? '<span class="sv3-dot" aria-label="Unread"></span>' : ""}
        </div>`;
    }).join("");
  } catch (err) {
    list.innerHTML = `<div class="sv3-error"><i class="fa-solid fa-triangle-exclamation"></i><h3>Failed to load notifications</h3><p>${esc(err.message)}</p></div>`;
  }
}

window.markRead = async function (id, el) {
  try {
    await apiFetch(`/student/notifications/${id}/read`, { method: "PUT" });
    if (el) {
      el.classList.remove("sv3-unread");
      const dot = el.querySelector(".sv3-dot");
      if (dot) dot.remove();
    }
    loadUnreadCount();
  } catch (err) {
    // silent
  }
};

async function markAllRead() {
  try {
    await apiFetch("/student/notifications/read-all", { method: "PUT" });
    showToast("All notifications marked as read", "success");
    loadNotifications();
    loadUnreadCount();
  } catch (err) {
    showToast(err.message || "Unable to mark all as read", "error");
  }
}
