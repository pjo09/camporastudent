// =====================================================
// CAMPORA STUDENT V3 - BOOKING
// Native Supabase API Integration
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, inr, esc, showToast } from "./student-utils.js";
import { getPropertiesUrl } from "./session.js";

const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  if (!propertyId) {
    showToast("No property selected", "error");
    setTimeout(() => (window.location.href = getPropertiesUrl()), 1500);
    return;
  }
  loadProperty();
  setupForm();
});

async function loadProperty() {
  try {
    const data = await apiFetch(`/properties/${propertyId}`);
    if (!data || !data.success) throw new Error(data?.message || "Unable to load property");
    renderSummary(data.property);
    const loading = $("loadingProperty");
    if (loading) loading.style.display = "none";
    const form = $("bookingForm");
    if (form) form.style.display = "block";
    const today = new Date().toISOString().split("T")[0];
    const dateInput = $("moveInDate");
    if (dateInput) dateInput.min = today;
  } catch (err) {
    const loading = $("loadingProperty");
    if (loading) {
      loading.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:36px;color:#f87171"></i><p style="margin-top:12px">${esc(err.message)}</p><a href="${getPropertiesUrl()}" class="sv3-btn sv3-btn-primary" style="margin-top:14px">Back to Explore</a>`;
    }
  }
}

function renderSummary(p) {
  const container = $("summaryContent");
  if (!container) return;
  const name = p.propertyName || p.title || "Campora Property";
  const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
  const rent = p.rent || p.price || 0;
  const deposit = p.deposit || 0;
  const img = imageUrl(p.images?.[0] || p.image || p.imageUrl);
  container.innerHTML = `
    <div style="position:relative;height:180px;border-radius:16px;overflow:hidden;margin-bottom:16px">
      <img src="${img}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.onerror=null; this.src='/assets/images/property-placeholder.jpg'">
    </div>
    <h3 style="font-size:20px;font-weight:800;margin-bottom:6px">${esc(name)}</h3>
    <p style="color:var(--sv3-muted);font-size:14px;margin-bottom:12px"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</p>
    <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--sv3-border)">
      <span style="color:var(--sv3-muted)">Monthly Rent</span><strong>${inr(rent)}</strong>
    </div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--sv3-border)">
      <span style="color:var(--sv3-muted)">Deposit</span><strong>${inr(deposit)}</strong>
    </div>
    <div style="display:flex;justify-content:space-between;padding:12px 0;border-top:1px solid var(--sv3-border)">
      <span style="color:var(--sv3-muted)">Booking Fee</span><strong>₹1,000</strong>
    </div>
    <div style="display:flex;justify-content:space-between;padding:14px 0;border-top:1px solid var(--sv3-border);font-size:17px">
      <span style="font-weight:700">Total (Due at booking)</span><strong style="color:#60a5fa">${inr(Number(rent) + Number(deposit) + 1000)}</strong>
    </div>
  `;
}

function setupForm() {
  const form = $("bookingForm");
  if (!form) return;
  form.addEventListener("submit", submitBooking);
}

async function submitBooking(e) {
  e.preventDefault();
  const moveInDate = $("moveInDate").value;
  const duration = $("duration").value;
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
    showToast("Please select a duration", "error");
    return;
  }

  const btn = $("submitBtn");
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Booking...';

  try {
    const data = await apiFetch("/bookings", {
      method: "POST",
      body: JSON.stringify({
        propertyId,
        moveInDate,
        duration,
        specialRequest,
      }),
    });

    if (!data || !data.success) throw new Error(data?.message || "Booking submission failed");

    showToast("Booking created successfully!", "success");
    setTimeout(() => {
      window.location.href = "/pages/student/bookings.html";
    }, 1500);
  } catch (err) {
    showToast(err.message || "Failed to create booking", "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Confirm Booking';
  }
}
