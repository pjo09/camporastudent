// =====================================================
// CAMPORA OWNER BOOKINGS V3
// Shared shell + premium bookings table
// =====================================================

import { initShell, apiFetch, showToast, formatDate, formatCurrency, $ } from "./owner-shell.js";

const DOM = {
  tableBody: $("bookingTableBody"),
  empty: $("bookingEmpty"),
  search: $("bookingSearch"),
  filterBtns: document.querySelectorAll(".v3-filter-btn"),
  totalBookings: $("totalBookings"),
  pendingCount: $("pendingCount"),
  confirmedCount: $("confirmedCount"),
  cancelledCount: $("cancelledCount"),
  bookingModal: $("bookingModal"),
  closeBookingModal: $("closeBookingModal"),
  bookingDetailContent: $("bookingDetailContent"),
};

const state = {
  bookings: [],
  currentFilter: "all",
  searchTerm: "",
};

// =====================================================
// INIT
// =====================================================

initShell("Bookings");

// Wait for shell to inject DOM before binding
document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadBookings();
});

function setupListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderBookings();
    });
  });

  DOM.search?.addEventListener("input", (e) => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderBookings();
  });

  DOM.closeBookingModal?.addEventListener("click", () => DOM.bookingModal.classList.remove("active"));
  DOM.bookingModal?.addEventListener("click", (e) => { if (e.target === DOM.bookingModal) DOM.bookingModal.classList.remove("active"); });
}

// =====================================================
// LOAD BOOKINGS
// =====================================================

async function loadBookings() {
  DOM.tableBody.innerHTML = `<tr><td colspan="7" class="v3-loading" style="padding:40px"><i class="fa-solid fa-spinner fa-spin"></i> Loading bookings...</td></tr>`;

  try {
    const data = await apiFetch("/owner/bookings");
    state.bookings = data.bookings || [];

    const total = state.bookings.length;
    const pending = state.bookings.filter((b) => b.bookingStatus === "pending").length;
    const confirmed = state.bookings.filter((b) => ["confirmed", "checked-in"].includes(b.bookingStatus || "")).length;
    const cancelled = state.bookings.filter((b) => ["cancelled", "checked-out"].includes(b.bookingStatus || "")).length;

    if (DOM.totalBookings) DOM.totalBookings.textContent = total;
    if (DOM.pendingCount) DOM.pendingCount.textContent = pending;
    if (DOM.confirmedCount) DOM.confirmedCount.textContent = confirmed;
    if (DOM.cancelledCount) DOM.cancelledCount.textContent = cancelled;

    renderBookings();
  } catch (err) {
    console.error("Owner bookings load error:", err);
    DOM.tableBody.innerHTML = `<tr><td colspan="7" class="v3-error" style="padding:40px"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load Bookings</h3><p>${err.message}</p><button class="v3-btn v3-btn-primary" onclick="location.reload()">Try Again</button></td></tr>`;
    showToast("Failed to load bookings", "error");
  }
}

// =====================================================
// RENDER
// =====================================================

function renderBookings() {
  let filtered = [...state.bookings];

  if (state.currentFilter !== "all") {
    filtered = filtered.filter((b) => (b.bookingStatus || "").toLowerCase() === state.currentFilter);
  }

  if (state.searchTerm) {
    filtered = filtered.filter((b) => {
      const prop = b.propertyId || {};
      const student = b.userId || {};
      const haystack = [
        prop.propertyName || b.propertyName || "",
        prop.city || "",
        student.name || "",
        student.email || "",
        student.phone || "",
      ].join(" ").toLowerCase();
      return haystack.includes(state.searchTerm);
    });
  }

  if (filtered.length === 0) {
    DOM.tableBody.innerHTML = "";
    DOM.empty.style.display = "block";
    return;
  }

  DOM.empty.style.display = "none";

  let rows = "";
  filtered.forEach((b) => {
    const prop = b.propertyId || {};
    const student = b.userId || {};
    const name = prop.propertyName || b.propertyName || "Property";
    const studentName = student.name || "Student";
    const city = prop.city || "";
    const status = b.bookingStatus || "pending";
    const payment = b.paymentStatus || "pending";
    const createdAt = b.createdAt ? formatDate(b.createdAt) : "";
    const price = b.price || 0;

    const statusPill =
      ["confirmed", "checked-in"].includes(status) ? "v3-pill-success"
      : ["cancelled", "checked-out"].includes(status) ? "v3-pill-danger"
      : "v3-pill-warning";

    const paymentPill =
      payment === "paid" ? "v3-pill-success"
      : payment === "failed" ? "v3-pill-danger"
      : "v3-pill-warning";

    const statusLabel = status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, " ");
    const payLabel = payment.charAt(0).toUpperCase() + payment.slice(1);

    rows += `
      <tr>
        <td>
          <strong>${name}</strong>
          ${city ? `<div style="color:var(--v3-muted);font-size:12.5px;margin-top:3px"><i class="fa-solid fa-location-dot"></i> ${city}</div>` : ""}
        </td>
        <td>
          <strong>${studentName}</strong>
          ${student.email ? `<div style="color:var(--v3-muted);font-size:12.5px;margin-top:3px">${student.email}</div>` : ""}
        </td>
        <td>${createdAt}</td>
        <td style="font-weight:700">${formatCurrency(price)}</td>
        <td><span class="v3-pill ${statusPill}">${statusLabel}</span></td>
        <td><span class="v3-pill ${paymentPill}">${payLabel}</span></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="view" data-id="${b._id}" style="margin-right:6px">Details</button>
          ${status === "pending" ? `
            <button class="v3-btn v3-btn-success v3-btn-sm" data-action="confirm" data-id="${b._id}" style="margin-right:6px">Confirm</button>
            <button class="v3-btn v3-btn-danger v3-btn-sm" data-action="reject" data-id="${b._id}" style="margin-right:6px">Reject</button>` : ""}
          ${status === "confirmed" ? `
            <button class="v3-btn v3-btn-primary v3-btn-sm" data-action="checkin" data-id="${b._id}" style="margin-right:6px">Check In</button>` : ""}
          ${status === "checked-in" ? `
            <button class="v3-btn v3-btn-primary v3-btn-sm" data-action="checkout" data-id="${b._id}" style="margin-right:6px">Check Out</button>` : ""}
          ${payment !== "paid" ? `
            <button class="v3-btn v3-btn-primary v3-btn-sm" data-action="payment" data-id="${b._id}">Mark Paid</button>` : ""}
        </td>
      </tr>`;
  });

  DOM.tableBody.innerHTML = rows;

  // Attach actions
  DOM.tableBody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.dataset.action === "view") {
        openBookingDetail(btn.dataset.id);
      } else {
        updateBooking(btn.dataset.id, btn.dataset.action);
      }
    });
  });
}

// =====================================================
// UPDATE BOOKING
// =====================================================

async function updateBooking(id, action) {
  const actionMap = {
    confirm: { endpoint: `/owner/bookings/${id}/confirm`, method: "PATCH" },
    reject: { endpoint: `/owner/bookings/${id}/reject`, method: "PATCH", body: { reason: "Cancelled by owner" } },
    checkin: { endpoint: `/owner/bookings/${id}/checkin`, method: "PATCH" },
    checkout: { endpoint: `/owner/bookings/${id}/checkout`, method: "PATCH" },
    payment: { endpoint: `/owner/bookings/${id}/payment`, method: "PATCH" },
  };

  const actionNames = {
    confirm: "Booking Confirmed",
    reject: "Booking Rejected",
    checkin: "Checked In",
    checkout: "Checked Out",
    payment: "Payment Marked Paid",
  };

  const config = actionMap[action];
  if (!config) return;

  if (action === "reject" && !confirm("Are you sure you want to reject this booking?")) return;

  try {
    await apiFetch(config.endpoint, {
      method: config.method,
      body: config.body ? JSON.stringify(config.body) : undefined,
    });
    showToast(actionNames[action], "success");
    loadBookings();
  } catch (err) {
    console.error(`${action} error:`, err);
    showToast(`Failed to ${action}: ${err.message}`, "error");
  }
}

// =====================================================
// BOOKING DETAIL MODAL
// =====================================================

function openBookingDetail(id) {
  const b = state.bookings.find((x) => x._id === id);
  if (!b) return;

  const prop = b.propertyId || {};
  const student = b.userId || {};
  const status = b.bookingStatus || "pending";
  const payment = b.paymentStatus || "pending";

  const timelineSteps = ["pending", "confirmed", "checked-in", "checked-out"];
  const currentIdx = timelineSteps.indexOf(status);
  const timeline = timelineSteps.map((step, i) => {
    const label = step.charAt(0).toUpperCase().replace(/-/g, " ");
    const dotClass = i < currentIdx ? "v3-timeline-dot done" : i === currentIdx ? "v3-timeline-dot current" : "v3-timeline-dot";
    const lineClass = i < currentIdx ? "v3-timeline-line done" : "v3-timeline-line";
    const icon = i < currentIdx ? "fa-check" : i === currentIdx ? "fa-circle" : "";
    return `
      ${i > 0 ? `<div class="${lineClass}"></div>` : ""}
      <div class="v3-timeline-item">
        <div class="${dotClass}">${icon ? `<i class="fa-solid ${icon}"></i>` : i + 1}</div>
        <span>${label}</span>
      </div>`;
  }).join("");

  DOM.bookingDetailContent.innerHTML = `
    <div class="v3-detail-grid" style="margin-bottom:20px">
      <div class="v3-detail-item">
        <div class="d-label">Property</div>
        <div class="d-value">${prop.propertyName || b.propertyName || "Property"}</div>
      </div>
      <div class="v3-detail-item">
        <div class="d-label">Student</div>
        <div class="d-value">${student.name || "Student"}</div>
      </div>
      <div class="v3-detail-item">
        <div class="d-label">Booking Date</div>
        <div class="d-value">${b.createdAt ? formatDate(b.createdAt) : "—"}</div>
      </div>
      <div class="v3-detail-item">
        <div class="d-label">Amount</div>
        <div class="d-value">${formatCurrency(b.price || 0)}</div>
      </div>
      <div class="v3-detail-item">
        <div class="d-label">Booking Status</div>
        <div class="d-value">${status.charAt(0).toUpperCase() + status.slice(1)}</div>
      </div>
      <div class="v3-detail-item">
        <div class="d-label">Payment Status</div>
        <div class="d-value">${payment.charAt(0).toUpperCase() + payment.slice(1)}</div>
      </div>
    </div>
    <div style="margin-bottom:20px">
      <div class="d-label" style="font-size:11.5px;color:var(--v3-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:12px">Booking Timeline</div>
      <div class="v3-timeline">${timeline}</div>
    </div>
    <div class="v3-detail-grid">
      ${student.email ? `<div class="v3-detail-item"><div class="d-label">Email</div><div class="d-value">${student.email}</div></div>` : ""}
      ${student.phone ? `<div class="v3-detail-item"><div class="d-label">Phone</div><div class="d-value">${student.phone}</div></div>` : ""}
      ${prop.city ? `<div class="v3-detail-item"><div class="d-label">City</div><div class="d-value">${prop.city}</div></div>` : ""}
      ${b.roomNumber ? `<div class="v3-detail-item"><div class="d-label">Room</div><div class="d-value">${b.roomNumber}</div></div>` : ""}
    </div>`;

  DOM.bookingModal.classList.add("active");
}

console.log("✅ Owner Bookings V3 initialised");

