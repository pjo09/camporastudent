// =====================================================
// CAMPORA STUDENT MOVE-IN JS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, esc } from "./student-utils.js";

const DOM = {
  noBookingState: $("noBookingState"),
  bookingSelectorContainer: $("bookingSelectorContainer"),
  bookingSelect: $("bookingSelect"),
  moveInContent: $("moveInContent"),
  checklistItems: $("checklistItems"),
  documentsList: $("documentsList"),
  propertyDetailsCard: $("propertyDetailsCard"),
  instructionsContent: $("instructionsContent"),
};

let confirmedBookings = [];
let selectedBookingId = null;

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  setupListeners();
  detectBookingAndLoad();
});

function setupListeners() {
  DOM.bookingSelect?.addEventListener("change", (e) => {
    selectedBookingId = e.target.value;
    if (selectedBookingId) {
      loadMoveInCenter(selectedBookingId);
    }
  });
}

// =====================================================
// INITIAL BOOKING DETECT
// =====================================================
async function detectBookingAndLoad() {
  try {
    // Read from URL query param first
    const params = new URLSearchParams(window.location.search);
    const queryId = params.get("bookingId");

    // Fetch dashboard to get recent bookings
    const data = await apiFetch("/student/dashboard-v3");
    const bookings = data.recentBookings || [];

    // Filter confirmed/active bookings
    confirmedBookings = bookings.filter(b => ["confirmed", "checked-in"].includes(b.bookingStatus));

    if (confirmedBookings.length === 0) {
      DOM.noBookingState.style.display = "block";
      DOM.moveInContent.style.display = "none";
      return;
    }

    // Populate selector dropdown if multiple confirmed bookings exist
    if (confirmedBookings.length > 1) {
      DOM.bookingSelectorContainer.style.display = "block";
      DOM.bookingSelect.innerHTML = confirmedBookings.map(b => `
        <option value="${b._id}" ${queryId === b._id ? "selected" : ""}>${esc(b.propertyName || "Property")} (${b.bookingStatus})</option>
      `).join("");
    }

    // Choose default booking
    const defaultBooking = confirmedBookings.find(b => b._id === queryId) || confirmedBookings[0];
    selectedBookingId = defaultBooking._id;

    loadMoveInCenter(selectedBookingId);

  } catch (err) {
    console.error("Failed to detect booking", err);
    window.showToast("Failed to load Move-In data: " + err.message, "error");
  }
}

// =====================================================
// LOAD MOVE-IN CENTER DETAILS
// =====================================================
async function loadMoveInCenter(bookingId) {
  try {
    DOM.moveInContent.style.display = "none";
    
    const res = await apiFetch(`/student/bookings/${bookingId}/move-in`);
    const { booking, property, owner, checklist, announcements } = res;

    renderChecklist(checklist, booking, owner);
    renderDocuments(booking.requiredDocuments || [], bookingId);
    renderPropertyAndContact(property, owner, booking);
    renderArrivalInstructions(booking);

    DOM.noBookingState.style.display = "none";
    DOM.moveInContent.style.display = "block";

  } catch (err) {
    console.error("Failed to load move in center details", err);
    window.showToast("Failed to load details: " + err.message, "error");
  }
}

// =====================================================
// RENDER CHECKLIST
// =====================================================
function renderChecklist(checklist, booking, owner) {
  const items = [
    {
      title: "Booking Confirmed",
      desc: "Your stay registration is verified and confirmed.",
      done: checklist.bookingConfirmed,
      action: ""
    },
    {
      title: "Rent Payment",
      desc: booking.paymentStatus === "paid" ? "Initial rent/deposit has been processed." : "Coordinate rent payment with your property owner.",
      done: checklist.paymentStatus,
      action: ""
    },
    {
      title: "Required Documents Submitted",
      desc: "All required identity and verification papers submitted.",
      done: checklist.documentsSubmitted,
      action: ""
    },
    {
      title: "Move-In Date Scheduled",
      desc: booking.checkIn ? `Check-in scheduled for: <strong>${new Date(booking.checkIn).toLocaleDateString("en-IN")}</strong>` : "Coordinate move-in date with the owner.",
      done: checklist.moveInDateConfirmed,
      action: ""
    },
    {
      title: "Arrival Details Received",
      desc: checklist.checkInInstructionsReceived ? "Arrival and coordination guidelines received." : "Waiting for owner check-in coordination details.",
      done: checklist.checkInInstructionsReceived,
      action: ""
    },
    {
      title: "Contact PG Owner",
      desc: checklist.ownerContacted ? "Started conversation with property management." : "Say hi to coordinate your arrival.",
      done: checklist.ownerContacted,
      action: `<a class="sv3-btn sv3-btn-ghost sv3-btn-sm" href="messages.html?owner=${owner._id || ""}"><i class="fa-solid fa-comments"></i> Message Owner</a>`
    }
  ];

  DOM.checklistItems.innerHTML = items.map(item => `
    <div style="display:flex;align-items:start;gap:14px;padding:12px;border-radius:12px;background:rgba(255,255,255,0.01);border:1px solid var(--sv3-border)">
      <div style="font-size:18px;color:${item.done ? "#22c55e" : "#eab308"};margin-top:2px">
        <i class="fa-solid ${item.done ? "fa-circle-check" : "fa-circle-dot"}"></i>
      </div>
      <div style="flex:1">
        <h4 style="font-size:14px;font-weight:700;color:#fff">${item.title}</h4>
        <p style="font-size:12px;color:var(--sv3-muted);margin-top:2px">${item.desc}</p>
      </div>
      <div style="margin-left:auto">${item.action}</div>
    </div>
  `).join("");
}

// =====================================================
// RENDER DOCUMENTS LIST & HANDLE SECURE UPLOAD
// =====================================================
function renderDocuments(documents, bookingId) {
  if (documents.length === 0) {
    DOM.documentsList.innerHTML = `<p style="color:var(--sv3-muted);font-size:13px">No documents required for this booking.</p>`;
    return;
  }

  DOM.documentsList.innerHTML = "";

  documents.forEach((d, index) => {
    const card = document.createElement("div");
    card.style.cssText = "display:flex;justify-content:space-between;align-items:center;padding:14px 16px;border-radius:12px;background:rgba(255,255,255,0.02);border:1px solid var(--sv3-border);flex-wrap:wrap;gap:12px";

    const statusBadge = d.submitted 
      ? `<span style="color:#22c55e;font-size:12px;font-weight:600"><i class="fa-solid fa-circle-check"></i> Submitted</span>`
      : `<span style="color:#ef4444;font-size:12px;font-weight:600"><i class="fa-solid fa-circle-exclamation"></i> Upload Required</span>`;

    const viewButton = d.submitted
      ? `<a href="/api/student/bookings/${bookingId}/documents/${index}/view" target="_blank" class="sv3-btn sv3-btn-ghost sv3-btn-sm" style="padding:6px 12px;font-size:12px"><i class="fa-solid fa-eye"></i> View</a>`
      : "";

    card.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:4px">
        <strong style="font-size:14px;color:#fff">${esc(d.name)} ${d.required ? "*" : ""}</strong>
        ${statusBadge}
      </div>
      <div style="display:flex;align-items:center;gap:10px;margin-left:auto">
        ${viewButton}
        <button class="sv3-btn sv3-btn-primary sv3-btn-sm" style="padding:6px 12px;font-size:12px" data-action="upload"><i class="fa-solid fa-cloud-arrow-up"></i> ${d.submitted ? "Re-upload" : "Upload"}</button>
        <input type="file" accept=".jpg,.jpeg,.png,.pdf" style="display:none" data-file-input>
      </div>
    `;

    const fileInput = card.querySelector("[data-file-input]");
    const uploadBtn = card.querySelector("[data-action='upload']");

    uploadBtn?.addEventListener("click", () => fileInput?.click());
    fileInput?.addEventListener("change", (e) => handleFileUpload(e, bookingId, index));

    DOM.documentsList.appendChild(card);
  });
}

// =====================================================
// FILE UPLOAD HANDLER
// =====================================================
async function handleFileUpload(e, bookingId, docIndex) {
  const file = e.target.files?.[0];
  if (!file) return;

  const allowedTypes = ["image/jpeg", "image/png", "application/pdf"];
  if (!allowedTypes.includes(file.type)) {
    window.showToast("Only JPG, JPEG, PNG, and PDF files are allowed.", "error");
    return;
  }

  if (file.size > 5 * 1024 * 1024) {
    window.showToast("File size must be under 5MB.", "error");
    return;
  }

  const formData = new FormData();
  formData.append("document", file);

  const uploadBtn = e.target.parentElement?.querySelector("button");
  if (uploadBtn) {
    uploadBtn.disabled = true;
    uploadBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Uploading...`;
  }

  try {
    const token = localStorage.getItem("token");
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;

    // Use raw fetch for multipart upload
    const res = await fetch(`/api/student/bookings/${bookingId}/documents/${docIndex}`, {
      method: "POST",
      body: formData,
      headers
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.message || "Failed to upload file");
    }

    window.showToast("Document submitted successfully!", "success");
    loadMoveInCenter(bookingId);

  } catch (err) {
    console.error("File upload error", err);
    window.showToast("Upload failed: " + err.message, "error");
    if (uploadBtn) {
      uploadBtn.disabled = false;
      uploadBtn.innerHTML = `<i class="fa-solid fa-cloud-arrow-up"></i> Retry`;
    }
  }
}

// =====================================================
// RENDER PROPERTY AND CONTACT
// =====================================================
function renderPropertyAndContact(property, owner, booking) {
  const img = property.images && property.images.length ? imageUrl(property.images[0]) : "/assets/logos/logo.png";
  const name = owner.name || "PG Owner";
  const initials = (name.charAt(0) || "O").toUpperCase();

  DOM.propertyDetailsCard.innerHTML = `
    <!-- Property Info -->
    <div style="border-bottom:1px solid var(--sv3-border);padding-bottom:16px;margin-bottom:16px">
      <img src="${img}" alt="${esc(property.propertyName)}" style="width:100%;height:140px;object-fit:cover;border-radius:12px;margin-bottom:12px">
      <h3 style="font-size:16px;font-weight:800;color:#fff">${esc(property.propertyName)}</h3>
      <p style="font-size:12px;color:var(--sv3-muted);margin-top:2px"><i class="fa-solid fa-location-dot"></i> ${esc(property.address)}, ${esc(property.city)}</p>
      <div style="display:flex;gap:6px;margin-top:8px">
        <span class="sv3-pill sv3-pill-primary">${esc(property.sharing || "Sharing")}</span>
        <span class="sv3-pill sv3-pill-secondary">${esc(property.gender || "Coed")} Only</span>
      </div>
    </div>

    <!-- Owner Contact -->
    <div>
      <h4 style="font-size:13px;font-weight:700;color:var(--sv3-muted);text-transform:uppercase;margin-bottom:10px">PG Management</h4>
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px">
        <div class="sv3-avatar" style="width:40px;height:40px;font-size:16px;background:var(--sv3-secondary)">${initials}</div>
        <div>
          <strong style="font-size:14px;color:#fff">${esc(name)}</strong>
          ${owner.businessName ? `<p style="font-size:11px;color:var(--sv3-muted)">${esc(owner.businessName)}</p>` : ""}
        </div>
      </div>
      <div style="display:flex;flex-direction:column;gap:8px;font-size:13px">
        ${owner.phone ? `<div><i class="fa-solid fa-phone" style="width:20px;color:var(--sv3-muted)"></i> <a href="tel:${owner.phone}" style="color:#fff">${esc(owner.phone)}</a></div>` : ""}
        <div><i class="fa-solid fa-envelope" style="width:20px;color:var(--sv3-muted)"></i> <a href="mailto:${owner.email}" style="color:#fff">${esc(owner.email)}</a></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr;gap:10px;margin-top:16px">
        <a class="sv3-btn sv3-btn-primary" style="text-align:center" href="messages.html?owner=${owner._id || ""}"><i class="fa-solid fa-comments" style="margin-right:6px"></i> Start Chat</a>
      </div>
    </div>
  `;
}

// =====================================================
// RENDER ARRIVAL INSTRUCTIONS
// =====================================================
function renderArrivalInstructions(booking) {
  const items = [
    {
      label: "Check-In Window",
      val: booking.checkInWindow || "Not specified yet by owner."
    },
    {
      label: "Check-In Instructions",
      val: booking.checkInInstructions || "The owner has not updated check-in directions yet."
    },
    {
      label: "Meeting Point / Coordination",
      val: booking.meetingInstructions || "Not specified yet."
    },
    {
      label: "Special Notes",
      val: booking.specialInstructions || "No special instructions."
    }
  ];

  DOM.instructionsContent.innerHTML = items.map(item => `
    <div>
      <div style="font-size:11px;font-weight:700;color:var(--sv3-primary);text-transform:uppercase">${item.label}</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:2px;line-height:1.45">${esc(item.val)}</div>
    </div>
  `).join("");
}

window.showToast = showToast;
console.log("✅ Campora Student Move-In Center V3 loaded");
