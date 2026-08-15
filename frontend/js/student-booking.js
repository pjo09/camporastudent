// =====================================================
// CAMPORA STUDENT V3 - BOOKING
// Secure: sends only propertyId + booking metadata.
// Backend derives userId/name/email from JWT.
// =====================================================

import { $, initShell, loadUnreadCount, imageUrl, inr, esc } from "./student-utils.js";
import { API } from "./config.js";
import { getToken, getPropertiesUrl } from "./session.js";

const API_BASE = API;
const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");
const token = getToken();

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
    const res = await fetch(`${API_BASE}/properties/${propertyId}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Unable to load property");
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
  const img = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/logos/logo.png";
  container.innerHTML = `
    <div style="position:relative;height:180px;border-radius:16px;overflow:hidden;margin-bottom:16px">
      <img src="${img}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='/assets/logos/logo.png'">
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
    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        propertyId,
        moveInDate,
        duration,
        specialRequest,
      }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Booking failed");

    showToast("Booking created! Proceeding to payment...", "success", 2200);
    const bookingId = data.booking?._id || data.booking?.id;
    setTimeout(() => {
      if (bookingId) {
        window.location.href = `payment.html?id=${bookingId}`;
      } else {
window.location.href = "bookings.html";
      }
    }, 1800);
  } catch (err) {
    console.error("Booking error:", err);
    showToast(err.message || "Unable to create booking", "error");
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-calendar-check"></i> Create Booking Request';
  }
}

function showToast(msg, type, dur) {
  const tc = $("toastContainer");
  if (!tc) return;
  const icons = {
    success: "fa-circle-check",
    error: "fa-circle-exclamation",
    info: "fa-circle-info",
  };
  const t = document.createElement("div");
  t.className = `sv3-toast sv3-toast-${type}`;
  t.setAttribute("role", "alert");
  t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => {
    t.classList.add("sv3-toast-leaving");
    setTimeout(() => t.remove(), 300);
  }, dur || 3500);
}
