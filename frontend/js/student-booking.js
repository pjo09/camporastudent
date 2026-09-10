// =====================================================
// CAMPORA STUDENT V3 - BOOKING REQUEST
// Supabase-Native API Integration
// =====================================================

import { $, initShell, loadUnreadCount, imageUrl, inr, esc, showToast } from "./student-utils.js";
import { getPropertiesUrl } from "./session.js";
import { supabaseAPI } from "./supabase-api.js";

const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

let propertyData = null;
let studentProfile = null;

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();

  if (!propertyId) {
    showToast("No property selected", "error");
    setTimeout(() => (window.location.href = getPropertiesUrl()), 1500);
    return;
  }

  loadData();

  $("reviewBtn")?.addEventListener("click", openReviewModal);
  $("closeReviewModal")?.addEventListener("click", closeReviewModal);
  $("cancelSubmitBtn")?.addEventListener("click", closeReviewModal);
  $("confirmSubmitBtn")?.addEventListener("click", executeBookingSubmission);
});

async function loadData() {
  try {
    const [propRes, profRes] = await Promise.all([
      supabaseAPI.getProperty(propertyId),
      supabaseAPI.getStudentProfile()
    ]);

    if (!propRes) throw new Error("Property not found");
    propertyData = propRes;
    studentProfile = profRes.user;

    renderSummary(propertyData, studentProfile);

    const loading = $("loadingProperty");
    if (loading) loading.style.display = "none";

    const form = $("bookingForm");
    if (form) form.style.display = "block";

    const today = new Date().toISOString().split("T")[0];
    const dateInput = $("moveInDate");
    if (dateInput) {
      dateInput.min = today;
      if (!dateInput.value) dateInput.value = today;
    }

  } catch (err) {
    const loading = $("loadingProperty");
    if (loading) {
      loading.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:36px;color:#f87171"></i><p style="margin-top:12px">${esc(err.message)}</p><a href="${getPropertiesUrl()}" class="sv3-btn sv3-btn-primary" style="margin-top:14px">Back to Explore</a>`;
    }
  }
}

function renderSummary(p, u) {
  const container = $("summaryContent");
  if (!container) return;

  const name = p.property_name || p.propertyName || p.title || "Campora Residency";
  const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
  const rent = p.rent || p.price || 0;
  const deposit = p.deposit || 0;
  const img = imageUrl(p.images?.[0] || p.image || p.imageUrl);

  container.innerHTML = `
    <div style="position:relative;height:170px;border-radius:16px;overflow:hidden;margin-bottom:16px">
      <img src="${img}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.onerror=null; this.src='/assets/images/property-placeholder.jpg'">
    </div>
    <h3 style="font-size:19px;font-weight:800;margin-bottom:4px">${esc(name)}</h3>
    <p style="color:var(--sv3-muted);font-size:13px;margin-bottom:14px"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</p>

    <!-- Student Snippet -->
    <div style="background:rgba(255,255,255,0.04);border:1px solid var(--sv3-border);border-radius:12px;padding:12px;margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:12px">
        <img src="${u.profileImage || u.avatar || '/assets/images/avatar-placeholder.jpg'}" alt="${esc(u.name)}" style="width:42px;height:42px;border-radius:50%;object-fit:cover">
        <div>
          <strong style="font-size:14px;color:#fff">${esc(u.name)}</strong>
          <p style="font-size:12px;color:var(--sv3-muted)">${esc(u.course || 'Student')} • ${esc(u.college || 'Verified Resident')}</p>
        </div>
      </div>
      <div style="display:flex;gap:8px;margin-top:10px">
        <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#34d399;padding:3px 8px;border-radius:10px"><i class="fa-solid fa-check"></i> Email Verified</span>
        <span style="font-size:11px;background:rgba(16,185,129,0.15);color:#34d399;padding:3px 8px;border-radius:10px"><i class="fa-solid fa-check"></i> Profile Complete</span>
      </div>
    </div>

    <!-- Financial Breakdown -->
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--sv3-border);font-size:14px">
      <span style="color:var(--sv3-muted)">Monthly Rent</span><strong>${inr(rent)}</strong>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--sv3-border);font-size:14px">
      <span style="color:var(--sv3-muted)">Security Deposit</span><strong>${inr(deposit)}</strong>
    </div>
    <div style="display:flex;justify-content:space-between;padding:10px 0;border-top:1px solid var(--sv3-border);font-size:14px">
      <span style="color:var(--sv3-muted)">Booking Fee</span><strong>₹1,000</strong>
    </div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--sv3-border);font-size:16px">
      <span style="font-weight:700">Total (Due on Acceptance)</span><strong style="color:#60a5fa">${inr(Number(rent) + Number(deposit) + 1000)}</strong>
    </div>
  `;
}

function openReviewModal() {
  const moveInDate = $("moveInDate").value;
  const duration = $("duration").value;
  const roomType = $("roomType").value;
  const specialRequest = $("specialRequest").value.trim();

  if (!moveInDate) {
    showToast("Please select a move-in date", "error");
    return;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (new Date(moveInDate) < today) {
    showToast("Move-in date cannot be in the past", "error");
    return;
  }
  if (!duration) {
    showToast("Please select stay duration", "error");
    return;
  }

  const rent = propertyData.rent || propertyData.price || 0;
  const deposit = propertyData.deposit || 0;

  const modalBody = $("reviewModalBody");
  if (modalBody) {
    modalBody.innerHTML = `
      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--sv3-border);border-radius:14px;padding:16px;margin-bottom:14px">
        <h4 style="font-size:16px;font-weight:700;color:#fff;margin-bottom:4px">${esc(propertyData.property_name || propertyData.propertyName)}</h4>
        <p style="font-size:13px;color:var(--sv3-muted)"><i class="fa-solid fa-location-dot"></i> ${esc(propertyData.city || 'Bhubaneswar')}</p>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:14px">
        <div style="background:rgba(255,255,255,0.02);padding:10px;border-radius:10px">
          <span style="font-size:12px;color:var(--sv3-muted);display:block">Room Type</span>
          <strong style="font-size:14px;color:#fff">${esc(roomType)}</strong>
        </div>
        <div style="background:rgba(255,255,255,0.02);padding:10px;border-radius:10px">
          <span style="font-size:12px;color:var(--sv3-muted);display:block">Monthly Rent</span>
          <strong style="font-size:14px;color:#60a5fa">${inr(rent)}/month</strong>
        </div>
        <div style="background:rgba(255,255,255,0.02);padding:10px;border-radius:10px">
          <span style="font-size:12px;color:var(--sv3-muted);display:block">Move-in Date</span>
          <strong style="font-size:14px;color:#fff">${new Date(moveInDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</strong>
        </div>
        <div style="background:rgba(255,255,255,0.02);padding:10px;border-radius:10px">
          <span style="font-size:12px;color:var(--sv3-muted);display:block">Stay Duration</span>
          <strong style="font-size:14px;color:#fff">${esc(duration)}</strong>
        </div>
      </div>

      <div style="background:rgba(255,255,255,0.03);border:1px solid var(--sv3-border);border-radius:12px;padding:12px">
        <div style="display:flex;align-items:center;gap:10px">
          <img src="${studentProfile.profileImage || studentProfile.avatar || '/assets/images/avatar-placeholder.jpg'}" alt="${esc(studentProfile.name)}" style="width:38px;height:38px;border-radius:50%;object-fit:cover">
          <div>
            <strong style="font-size:13px;color:#fff">${esc(studentProfile.name)}</strong>
            <p style="font-size:11px;color:var(--sv3-muted)">${esc(studentProfile.course)} • ${esc(studentProfile.college)}</p>
          </div>
        </div>
      </div>
    `;
  }

  const modal = $("reviewModal");
  if (modal) modal.style.display = "flex";
}

function closeReviewModal() {
  const modal = $("reviewModal");
  if (modal) modal.style.display = "none";
}

async function executeBookingSubmission() {
  const moveInDate = $("moveInDate").value;
  const duration = $("duration").value;
  const roomType = $("roomType").value;
  const specialRequest = $("specialRequest").value.trim();

  const confirmBtn = $("confirmSubmitBtn");
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting Request...';
  }

  try {
    const res = await supabaseAPI.createBookingRequest({
      propertyId,
      moveInDate,
      duration,
      roomType,
      specialRequest
    });

    closeReviewModal();
    showToast("Booking request sent successfully to owner!", "success");

    setTimeout(() => {
      window.location.href = "/pages/student/bookings.html";
    }, 1500);

  } catch (err) {
    showToast(err.message || "Failed to submit booking request", "error");
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Send Booking Request';
    }
  }
}
