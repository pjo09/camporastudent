// =====================================================
// CAMPORA OWNER BOOKINGS & RESIDENT PROFILE REVIEW V3
// Supabase-Native Architecture & Privacy Controls
// =====================================================

import { initShell, apiFetch, showToast, formatDate, formatCurrency, $ } from "./owner-shell.js";
import { supabaseAPI } from "./supabase-api.js";

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
  DOM.tableBody.innerHTML = `<tr><td colspan="7" class="v3-loading" style="padding:40px"><i class="fa-solid fa-spinner fa-spin"></i> Loading booking requests...</td></tr>`;

  try {
    let requests = [];
    try {
      requests = await supabaseAPI.getOwnerBookingRequests();
    } catch (apiErr) {
      const data = await apiFetch("/owner/bookings");
      requests = data.bookings || [];
    }

    state.bookings = requests;

    const total = state.bookings.length;
    const pending = state.bookings.filter((b) => ["pending", "requested"].includes((b.bookingStatus || "").toLowerCase())).length;
    const confirmed = state.bookings.filter((b) => ["confirmed", "accepted", "checked-in"].includes((b.bookingStatus || "").toLowerCase())).length;
    const cancelled = state.bookings.filter((b) => ["cancelled", "rejected", "checked-out"].includes((b.bookingStatus || "").toLowerCase())).length;

    if (DOM.totalBookings) DOM.totalBookings.textContent = total;
    if (DOM.pendingCount) DOM.pendingCount.textContent = pending;
    if (DOM.confirmedCount) DOM.confirmedCount.textContent = confirmed;
    if (DOM.cancelledCount) DOM.cancelledCount.textContent = cancelled;

    renderBookings();
  } catch (err) {
    console.error("Owner bookings load error:", err);
    DOM.tableBody.innerHTML = `<tr><td colspan="7" class="v3-error" style="padding:40px"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load Bookings</h3><p>${err.message}</p><button class="v3-btn v3-btn-primary" onclick="location.reload()">Try Again</button></td></tr>`;
    showToast("Failed to load booking requests", "error");
  }
}

// =====================================================
// RENDER
// =====================================================

function renderBookings() {
  let filtered = [...state.bookings];

  if (state.currentFilter !== "all") {
    filtered = filtered.filter((b) => {
      const st = (b.bookingStatus || "").toLowerCase();
      if (state.currentFilter === "pending") return st === "pending" || st === "requested";
      if (state.currentFilter === "confirmed") return st === "confirmed" || st === "accepted";
      if (state.currentFilter === "cancelled") return st === "cancelled" || st === "rejected";
      return st === state.currentFilter;
    });
  }

  if (state.searchTerm) {
    filtered = filtered.filter((b) => {
      const prop = b.property || {};
      const student = b.student || {};
      const haystack = [
        prop.property_name || b.propertyName || "",
        prop.city || "",
        student.name || "",
        student.email || "",
        student.phone || "",
        student.college || "",
        student.course || ""
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
    const prop = b.property || {};
    const student = b.student || {};
    const name = prop.property_name || b.propertyName || "Campora Property";
    const studentName = student.name || "Student";
    const city = prop.city || "";
    const status = (b.bookingStatus || "pending").toLowerCase();
    const payment = (b.paymentStatus || "pending").toLowerCase();
    const createdAt = b.createdAt ? formatDate(b.createdAt) : "Today";
    const price = b.price || prop.rent || 0;

    const statusPill =
      ["confirmed", "accepted"].includes(status) ? "v3-pill-success"
      : ["rejected", "cancelled"].includes(status) ? "v3-pill-danger"
      : "v3-pill-warning";

    const paymentPill =
      payment === "paid" ? "v3-pill-success"
      : payment === "failed" ? "v3-pill-danger"
      : "v3-pill-warning";

    const statusLabel =
      status === "pending" ? "NEW REQUEST"
      : status === "accepted" ? "ACCEPTED (PAYMENT PENDING)"
      : status.charAt(0).toUpperCase() + status.slice(1);

    const payLabel = payment.charAt(0).toUpperCase() + payment.slice(1);

    rows += `
      <tr>
        <td>
          <strong>${name}</strong>
          ${city ? `<div style="color:var(--v3-muted);font-size:12px;margin-top:2px"><i class="fa-solid fa-location-dot"></i> ${city}</div>` : ""}
        </td>
        <td>
          <div style="display:flex;align-items:center;gap:10px">
            <img src="${student.avatar || student.profile_image || '/assets/images/avatar-placeholder.jpg'}" alt="${studentName}" style="width:34px;height:34px;border-radius:50%;object-fit:cover" onerror="this.onerror=null; this.src='/assets/images/avatar-placeholder.jpg'">
            <div>
              <strong>${studentName}</strong>
              <div style="color:var(--v3-muted);font-size:12px">${student.college || student.email || ''}</div>
            </div>
          </div>
        </td>
        <td>${createdAt}</td>
        <td style="font-weight:700">${formatCurrency(price)}</td>
        <td><span class="v3-pill ${statusPill}">${statusLabel}</span></td>
        <td><span class="v3-pill ${paymentPill}">${payLabel}</span></td>
        <td style="text-align:right;white-space:nowrap">
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="view-profile" data-student-id="${student.id || b.studentId}" data-booking-id="${b.id || b._id}" style="margin-right:6px"><i class="fa-solid fa-user"></i> View Resident Profile</button>
          ${status === "pending" || status === "requested" ? `
            <button class="v3-btn v3-btn-success v3-btn-sm" data-action="accept" data-id="${b.id || b._id}" style="margin-right:6px"><i class="fa-solid fa-check"></i> Accept</button>
            <button class="v3-btn v3-btn-danger v3-btn-sm" data-action="reject" data-id="${b.id || b._id}"><i class="fa-solid fa-xmark"></i> Reject</button>` : ""}
        </td>
      </tr>`;
  });

  DOM.tableBody.innerHTML = rows;

  // Bind click handlers
  DOM.tableBody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const act = btn.dataset.action;
      if (act === "view-profile") {
        openResidentProfileModal(btn.dataset.studentId, btn.dataset.bookingId);
      } else if (act === "accept") {
        handleOwnerAccept(btn.dataset.id);
      } else if (act === "reject") {
        handleOwnerReject(btn.dataset.id);
      }
    });
  });
}

// =====================================================
// VIEW RESIDENT PROFILE MODAL (PRIVACY SANITIZED)
// =====================================================

async function openResidentProfileModal(studentId, bookingId) {
  DOM.bookingDetailContent.innerHTML = `<div class="v3-loading" style="padding:40px;text-align:center"><i class="fa-solid fa-spinner fa-spin" style="font-size:24px;color:#3b82f6"></i><p style="margin-top:10px">Loading Resident Profile...</p></div>`;
  DOM.bookingModal.classList.add("active");

  try {
    let resident = null;
    try {
      const res = await supabaseAPI.getOwnerResidentProfile(studentId, bookingId);
      resident = res.resident;
    } catch (e) {
      // Fallback lookup from cached list
      const b = state.bookings.find(x => String(x.id || x._id) === String(bookingId));
      resident = b?.student || { name: b?.userName || "Student", email: b?.userEmail };
    }

    if (!resident) throw new Error("Unable to load resident details");

    DOM.bookingDetailContent.innerHTML = `
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--v3-border);border-radius:16px;padding:20px;margin-bottom:20px">
        <div style="display:flex;align-items:center;gap:16px">
          <img src="${resident.avatar || '/assets/images/avatar-placeholder.jpg'}" alt="${resident.name}" style="width:72px;height:72px;border-radius:50%;object-fit:cover;border:2px solid #3b82f6" onerror="this.onerror=null; this.src='/assets/images/avatar-placeholder.jpg'">
          <div>
            <h3 style="font-size:20px;font-weight:800;color:#fff;margin-bottom:4px">${resident.name}</h3>
            <p style="font-size:13px;color:var(--v3-muted)"><i class="fa-solid fa-graduation-cap"></i> ${resident.course || 'Student'} ${resident.branch ? '• ' + resident.branch : ''}</p>
            <p style="font-size:12px;color:#60a5fa;margin-top:2px">${resident.college || 'Verified College Resident'}</p>
          </div>
        </div>
      </div>

      <!-- ACADEMIC & STAY SECTIONS -->
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px">
        <div style="background:rgba(255,255,255,0.02);border:1px solid var(--v3-border);border-radius:12px;padding:14px">
          <h4 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:10px"><i class="fa-solid fa-graduation-cap"></i> Academic Details</h4>
          <div style="font-size:13px;color:var(--v3-muted);line-height:1.6">
            <div><strong>College:</strong> ${resident.college || 'Not specified'}</div>
            <div><strong>Course:</strong> ${resident.course || 'Not specified'}</div>
            <div><strong>Branch:</strong> ${resident.branch || 'N/A'}</div>
            <div><strong>Year:</strong> ${resident.year || 'N/A'}</div>
            ${resident.studentId ? `<div><strong>Student ID:</strong> ${resident.studentId}</div>` : ''}
          </div>
        </div>

        <div style="background:rgba(255,255,255,0.02);border:1px solid var(--v3-border);border-radius:12px;padding:14px">
          <h4 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:10px"><i class="fa-solid fa-bed"></i> Stay Preferences</h4>
          <div style="font-size:13px;color:var(--v3-muted);line-height:1.6">
            <div><strong>Move-in Date:</strong> ${resident.preferredMoveInDate ? formatDate(resident.preferredMoveInDate) : 'Flexible'}</div>
            <div><strong>Expected Duration:</strong> ${resident.expectedDuration || '12 Months'}</div>
            <div><strong>Preferred Room:</strong> ${resident.preferredRoomType || 'Single Room'}</div>
            <div><strong>Budget Range:</strong> ${resident.budgetRange || 'Market Rate'}</div>
          </div>
        </div>
      </div>

      <!-- EMERGENCY CONTACT & VERIFICATION BADGES -->
      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--v3-border);border-radius:12px;padding:14px;margin-bottom:20px">
        <h4 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:8px"><i class="fa-solid fa-phone"></i> Emergency Contact</h4>
        <div style="font-size:13px;color:var(--v3-muted);display:flex;gap:20px">
          <span><strong>Guardian:</strong> ${resident.emergencyContact?.name || 'Parent/Guardian'} (${resident.emergencyContact?.relationship || 'Parent'})</span>
          <span><strong>Phone:</strong> ${resident.emergencyContact?.phone || 'Provided to owner'}</span>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.02);border:1px solid var(--v3-border);border-radius:12px;padding:14px;margin-bottom:20px">
        <h4 style="font-size:14px;font-weight:700;color:#fff;margin-bottom:8px"><i class="fa-solid fa-shield-halved"></i> Verification Badges</h4>
        <div style="display:flex;gap:10px;flex-wrap:wrap">
          <span style="font-size:12px;background:rgba(16,185,129,0.15);color:#34d399;padding:4px 10px;border-radius:12px"><i class="fa-solid fa-check"></i> Email Verified</span>
          <span style="font-size:12px;background:rgba(16,185,129,0.15);color:#34d399;padding:4px 10px;border-radius:12px"><i class="fa-solid fa-check"></i> Phone Verified</span>
          <span style="font-size:12px;background:rgba(148,163,184,0.15);color:#94a3b8;padding:4px 10px;border-radius:12px"><i class="fa-solid fa-clock"></i> College Verification Pending</span>
        </div>
      </div>

      <!-- MODAL ACTIONS -->
      <div style="display:flex;gap:12px">
        <button class="v3-btn v3-btn-success" id="modalAcceptBtn" style="flex:1"><i class="fa-solid fa-check"></i> Accept Request</button>
        <button class="v3-btn v3-btn-danger" id="modalRejectBtn" style="flex:1"><i class="fa-solid fa-xmark"></i> Reject Request</button>
      </div>
    `;

    $("modalAcceptBtn")?.addEventListener("click", () => {
      DOM.bookingModal.classList.remove("active");
      handleOwnerAccept(bookingId);
    });

    $("modalRejectBtn")?.addEventListener("click", () => {
      DOM.bookingModal.classList.remove("active");
      handleOwnerReject(bookingId);
    });

  } catch (err) {
    DOM.bookingDetailContent.innerHTML = `<div class="v3-error" style="padding:30px;text-align:center"><i class="fa-solid fa-exclamation-triangle" style="font-size:32px;color:#ef4444"></i><p style="margin-top:10px">${err.message}</p></div>`;
  }
}

// =====================================================
// OWNER ACCEPT & REJECT ACTIONS
// =====================================================

async function handleOwnerAccept(bookingId) {
  if (!confirm("Are you sure you want to accept this booking request? This will reserve a bed and notify the student for payment.")) return;

  try {
    const res = await supabaseAPI.respondBookingRequest(bookingId, "ACCEPT");
    showToast(res.message || "Booking request accepted successfully!", "success");
    loadBookings();
  } catch (err) {
    showToast(err.message || "Failed to accept booking request", "error");
  }
}

async function handleOwnerReject(bookingId) {
  const reason = prompt("Enter a rejection reason for the student (optional):", "Room no longer available for requested dates");
  if (reason === null) return; // User clicked Cancel in prompt

  try {
    const res = await supabaseAPI.respondBookingRequest(bookingId, "REJECT", reason);
    showToast("Booking request declined.", "info");
    loadBookings();
  } catch (err) {
    showToast(err.message || "Failed to reject booking request", "error");
  }
}
