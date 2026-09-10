// =====================================================
// CAMPORA STUDENT V3 - MY BOOKINGS & REQUEST STATUS
// Supabase-Native Integration
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, esc, timeAgo, showToast, inr } from "./student-utils.js";
import { getPropertiesUrl } from "./session.js";
import { supabaseAPI } from "./supabase-api.js";

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
    let requests = [];
    try {
      requests = await supabaseAPI.getStudentBookingRequests();
    } catch (apiErr) {
      const data = await apiFetch("/student/bookings");
      requests = data.bookings || data || [];
    }

    allBookings = requests;
    renderList();
  } catch (err) {
    list.innerHTML = `<div class="sv3-error"><i class="fa-solid fa-triangle-exclamation"></i><h3>Failed to load bookings</h3><p>${esc(err.message)}</p></div>`;
  }
}

function renderList() {
  const list = $("bookingList");
  if (!list) return;

  const filtered = currentFilter === "all"
    ? allBookings
    : allBookings.filter((b) => {
        const st = (b.bookingStatus || b.status || "pending").toLowerCase();
        if (currentFilter === "pending") return st === "pending" || st === "requested";
        if (currentFilter === "accepted") return st === "accepted";
        if (currentFilter === "confirmed") return st === "confirmed" || st === "checked-in";
        if (currentFilter === "rejected") return st === "rejected" || st === "cancelled";
        return st === currentFilter;
      });

  if (filtered.length === 0) {
    list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-calendar-check"></i><h3>No bookings found</h3><p>${currentFilter === "all" ? 'You have no active bookings or requests. <a href="' + getPropertiesUrl() + '" style="color:#60a5fa">Explore properties</a>.' : "No " + currentFilter + " bookings."}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((b) => {
    const prop = b.property || {};
    const name = prop.property_name || b.propertyName || "Campora Residency";
    const loc = prop.city ? `${prop.city}${prop.state ? ", " + prop.state : ""}` : "";
    const status = (b.bookingStatus || b.status || "pending").toLowerCase();
    const payment = (b.paymentStatus || "pending").toLowerCase();
    const img = imageUrl(prop.images?.[0] || prop.image || prop.imageUrl);

    let statusPillClass = "warning";
    let statusText = "Pending Owner Review";

    if (status === "accepted") {
      statusPillClass = "primary";
      statusText = "Accepted • Payment Pending";
    } else if (status === "confirmed" || status === "checked-in") {
      statusPillClass = "success";
      statusText = "Booking Confirmed";
    } else if (status === "rejected") {
      statusPillClass = "danger";
      statusText = "Declined by Owner";
    } else if (status === "cancelled") {
      statusPillClass = "danger";
      statusText = "Cancelled";
    }

    const isAcceptedPaymentPending = status === "accepted" || (status === "pending" && payment === "pending");
    const isConfirmed = status === "confirmed";

    return `
      <div class="sv3-list-item" style="padding:16px;margin-bottom:12px;background:rgba(255,255,255,0.02);border:1px solid var(--sv3-border);border-radius:16px">
        <img src="${img}" alt="${esc(name)}" style="width:72px;height:72px;border-radius:14px;object-fit:cover;flex-shrink:0" onerror="this.onerror=null; this.src='/assets/images/property-placeholder.jpg'">
        
        <div class="sv3-list-item-body">
          <div class="sv3-list-item-title" style="font-size:16px;font-weight:700">${esc(name)}</div>
          <div class="sv3-list-item-sub" style="font-size:13px;color:var(--sv3-muted)">
            ${loc ? esc(loc) + " · " : ""}${b.checkIn ? "Move-in: " + new Date(b.checkIn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ""} ${b.price ? " · " + inr(b.price) + "/month" : ""}
          </div>
          ${b.rejectionReason ? `<div style="font-size:12px;color:#f87171;margin-top:4px"><i class="fa-solid fa-circle-info"></i> Reason: ${esc(b.rejectionReason)}</div>` : ''}
        </div>

        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:10px">
          <span class="sv3-pill sv3-pill-${statusPillClass}">${statusText}</span>
          <div style="display:flex;gap:8px">
            ${isAcceptedPaymentPending ? `<button class="sv3-btn sv3-btn-primary" style="padding:8px 16px;font-size:13px;font-weight:700" onclick="window.payNow('${b.id || b._id}')"><i class="fa-solid fa-credit-card"></i> Pay Now</button>` : ''}
            ${isConfirmed ? `<a href="/payment.html?id=${b.id || b._id}" class="sv3-btn sv3-btn-secondary" style="padding:8px 14px;font-size:12px"><i class="fa-solid fa-receipt"></i> Receipt</a>` : ''}
          </div>
        </div>
      </div>`;
  }).join("");
}

window.payNow = function (bookingId) {
  window.location.href = `/payment.html?id=${bookingId}`;
};
