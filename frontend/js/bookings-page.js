// =====================================================
// CAMPORA BOOKINGS PAGE
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

const $ = (id) => document.getElementById(id);

const DOM = {
  skeleton: $("bookingSkeleton"),
  grid: $("bookingGrid"),
  empty: $("bookingEmpty"),
  errorState: $("bookingError"),
  retryBtn: $("retryBookingsBtn"),
  totalBookings: $("totalBookings"),
  confirmedCount: $("confirmedCount"),
  pendingCount: $("pendingCount"),
  cancelledCount: $("cancelledCount"),
  filterBtns: document.querySelectorAll(".filter-btn"),
};

const state = {
  user: null,
  token: null,
  bookings: [],
  currentFilter: "all",
};

state.user = protectPageByRole(["student"]);
state.token = getToken();
if (!state.user || !state.token) {}

setupEventListeners();
loadBookings();

function setupEventListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderBookings();
    });
  });
  DOM.retryBtn?.addEventListener("click", loadBookings);
}

async function loadBookings() {
  showSkeleton();
  hideError();
  hideEmpty();

  try {
    const res = await fetch(`${API}/student/bookings`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    state.bookings = data.bookings || [];
    hideSkeleton();

    // Stats
    const total = state.bookings.length;
    const confirmed = state.bookings.filter((b) => ["confirmed", "checked-in"].includes(b.bookingStatus || b.status)).length;
    const pending = state.bookings.filter((b) => ["pending"].includes(b.bookingStatus || b.status)).length;
    const cancelled = state.bookings.filter((b) => ["cancelled", "checked-out"].includes(b.bookingStatus || b.status)).length;

    if (DOM.totalBookings) DOM.totalBookings.textContent = total;
    if (DOM.confirmedCount) DOM.confirmedCount.textContent = confirmed;
    if (DOM.pendingCount) DOM.pendingCount.textContent = pending;
    if (DOM.cancelledCount) DOM.cancelledCount.textContent = cancelled;

    renderBookings();
  } catch (err) {
    console.error("Bookings load error:", err);
    hideSkeleton();
    showError();
  }
}

function renderBookings() {
  let filtered = [...state.bookings];

  if (state.currentFilter !== "all") {
    filtered = filtered.filter((b) => {
      const status = b.bookingStatus || b.status || "";
      return status === state.currentFilter;
    });
  }

  if (filtered.length === 0) {
    DOM.grid.hidden = true;
    DOM.empty.hidden = false;
    return;
  }

  DOM.grid.hidden = false;
  DOM.empty.hidden = true;
  DOM.grid.innerHTML = "";

  filtered.forEach((b) => {
    const prop = b.propertyId || {};
    const name = prop.propertyName || b.propertyName || "Property";
    const city = prop.city || "";
    const stateName = prop.state || "";
    const location = city + (stateName ? ", " + stateName : "");
    const status = b.bookingStatus || "pending";
    const payment = b.paymentStatus || "pending";
    const createdAt = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "";
    const price = b.price || 0;
    const img = prop.images?.length ? getImageUrl(prop.images[0]) : "";

    const statusClass = ["confirmed", "checked-in"].includes(status) ? "confirmed" : ["cancelled", "checked-out"].includes(status) ? "cancelled" : "pending";
    const paymentClass = payment === "paid" ? "confirmed" : payment === "failed" ? "cancelled" : "pending";

    const card = document.createElement("div");
    card.className = "booking-card";
    card.innerHTML = `
      <div class="booking-left">
        ${img ? `<img src="${img}" class="booking-image" alt="${name}" onerror="this.style.display='none'" />` : ""}
        <div>
          <h3 class="booking-title">${name}</h3>
          ${location ? `<p class="booking-location"><i class="fa-solid fa-location-dot"></i> ${location}</p>` : ""}
          <p style="color:#94a3b8;font-size:13px;margin-top:8px">
            <i class="fa-regular fa-calendar"></i> ${createdAt}
            ${price ? ` | ₹${price.toLocaleString()}` : ""}
          </p>
          <div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap">
            <span class="booking-status ${statusClass}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
            <span class="booking-status ${paymentClass}">Payment: ${payment.charAt(0).toUpperCase() + payment.slice(1)}</span>
          </div>
        </div>
      </div>
      <div style="display:flex;gap:8px;flex-shrink:0">
        <button class="book-btn" onclick="window.location.href='/pages/property/property.html?id=${prop._id || ""}'" style="padding:10px 16px;font-size:13px;margin:0">View</button>
        ${status === "pending" ? `<button class="secondary-btn" onclick="window.cancelBooking('${b._id}')" style="padding:10px 16px;font-size:13px;border:none;border-radius:14px;background:rgba(239,68,68,.15);color:#ef4444;font-weight:700;cursor:pointer">Cancel</button>` : ""}
      </div>`;
    DOM.grid.appendChild(card);
  });
}

window.cancelBooking = async function (id) {
  if (!confirm("Are you sure you want to cancel this booking?")) return;
  try {
    const res = await fetch(`${API}/bookings/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${state.token}` },
      body: JSON.stringify({ bookingStatus: "cancelled", cancelReason: "Cancelled by user" }),
    });
    const data = await res.json();
    if (data.success) {
      showToast("Booking cancelled", "info");
      loadBookings();
    }
  } catch (err) {
    console.error("Cancel error:", err);
    showToast("Failed to cancel booking", "error");
  }
};

function getImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return API.replace("/api", "") + "/" + path.replace(/^\//, "");
}

function showSkeleton() { if (DOM.skeleton) DOM.skeleton.hidden = false; }
function hideSkeleton() { if (DOM.skeleton) DOM.skeleton.hidden = true; }
function showError() { if (DOM.errorState) DOM.errorState.hidden = false; }
function hideError() { if (DOM.errorState) DOM.errorState.hidden = true; }
function hideEmpty() { if (DOM.empty) DOM.empty.hidden = true; }

function showToast(msg, type = "info") {
  const tc = document.getElementById("toastContainer");
  if (!tc) return;
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => { t.classList.add("toast-leaving"); setTimeout(() => t.remove(), 300); }, 3000);
}

console.log("✅ Bookings Page Loaded");

