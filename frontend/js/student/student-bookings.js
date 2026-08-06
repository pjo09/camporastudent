// =====================================================
// CAMPORA STUDENT V3 - MY BOOKINGS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, esc, timeAgo, showToast } from "./student-utils.js";

let allBookings = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  setupTabs();
  loadBookings();
});

function setupTabs() {
  document.querySelectorAll(".sv3-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll(".sv3-tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderList();
    });
  });
}

async function loadBookings() {
  const list = $("bookingList");
  if (!list) return;
  try {
    const data = await apiFetch("/student/bookings");
    allBookings = data.bookings || [];
    renderList();
  } catch (err) {
    list.innerHTML = `<div class="sv3-error"><i class="fa-solid fa-triangle-exclamation"></i><h3>Failed to load bookings</h3><p>${esc(err.message)}</p></div>`;
  }
}

function renderList() {
  const list = $("bookingList");
  if (!list) return;
  const filtered = currentFilter === "all" ? allBookings : allBookings.filter((b) => (b.bookingStatus || b.status || "pending") === currentFilter);

  if (filtered.length === 0) {
list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-calendar-check"></i><h3>No bookings</h3><p>${currentFilter === "all" ? 'You have no bookings yet. <a href="properties.html" style="color:#60a5fa">Explore properties</a>.' : "No " + currentFilter + " bookings."}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((b) => {
    const prop = b.propertyId || {};
    const name = prop.propertyName || b.propertyName || "Property";
    const loc = prop.city ? `${prop.city}${prop.state ? ", " + prop.state : ""}` : "";
    const status = b.bookingStatus || b.status || "pending";
    const color = ["confirmed", "checked-in"].includes(status) ? "success" : ["cancelled", "checked-out"].includes(status) ? "danger" : status === "pending" ? "warning" : "info";
    const img = prop.images && prop.images.length ? imageUrl(prop.images[0]) : "./assets/logos/logo.png";
    const canPay = status === "pending" || status === "confirmed";
    return `
      <div class="sv3-list-item">
        <img src="${img}" alt="" style="width:56px;height:56px;border-radius:14px;object-fit:cover;flex-shrink:0" onerror="this.src='./assets/logos/logo.png'">
        <div class="sv3-list-item-body">
          <div class="sv3-list-item-title">${esc(name)}</div>
          <div class="sv3-list-item-sub">${loc ? esc(loc) + " · " : ""}${b.checkIn ? "Move-in " + new Date(b.checkIn).toLocaleDateString() : ""} · ${timeAgo(b.createdAt)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:8px">
          <span class="sv3-pill sv3-pill-${color}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
          <div style="display:flex;gap:6px">
            ${canPay ? `<button class="sv3-btn sv3-btn-primary" style="padding:7px 14px;font-size:12.5px" onclick="window.payNow('${b._id}')">Pay</button>` : ""}
            ${canPay ? `<button class="sv3-btn sv3-btn-danger" style="padding:7px 14px;font-size:12.5px" onclick="window.cancelBooking('${b._id}', this)">Cancel</button>` : ""}
          </div>
        </div>
      </div>`;
  }).join("");
}

window.payNow = function (bookingId) {
  window.location.href = `payment.html?id=${bookingId}`;
};

window.cancelBooking = async function (bookingId, btn) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;
  btn.disabled = true;
  try {
    await apiFetch(`/student/bookings/${bookingId}/cancel`, { method: "PATCH", body: JSON.stringify({ reason: "Cancelled by student" }) });
    showToast("Booking cancelled", "success");
    loadBookings();
  } catch (err) {
    showToast(err.message || "Unable to cancel booking", "error");
    btn.disabled = false;
  }
};
