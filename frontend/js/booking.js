// =====================================================
// CAMPORA BOOKING SYSTEM
// =====================================================

import { getToken, getUser, protectPageByRole } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

// ==========================================
// AUTH CHECK - only students can book
// ==========================================

const user = protectPageByRole(["student"]);
if (!user) {
  // redirect already handled by protectPageByRole
}

const token = getToken();
const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

function $(id) {
  return document.getElementById(id);
}

// =====================================================
// TOAST
// =====================================================

function showToast(msg, type = "info", dur = 4000) {
  const tc = document.getElementById("toastContainer");
  if (!tc) return;
  const icons = {
    success: "fa-solid fa-circle-check",
    error: "fa-solid fa-circle-exclamation",
    info: "fa-solid fa-circle-info",
  };
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${msg}`;
  tc.appendChild(t);
  setTimeout(() => {
    t.classList.add("toast-leaving");
    setTimeout(() => t.remove(), 300);
  }, dur);
}

// ==========================================
// VALIDATE PROPERTY ID
// ==========================================

if (!propertyId) {
  showToast("No property selected.", "error");
  setTimeout(() => (window.location.href = "dashboard.html"), 1500);
}

// ==========================================
// LOAD PAGE
// ==========================================

window.addEventListener("DOMContentLoaded", () => {
  loadStudent();
  loadProperty();
});

// ==========================================
// STUDENT INFO
// ==========================================

function loadStudent() {
  if (!user) return;

  const nameField = $("studentName");
  const emailField = $("studentEmail");

  if (nameField) nameField.value = user.name || "";
  if (emailField) emailField.value = user.email || "";
}

// ==========================================
// LOAD PROPERTY
// ==========================================

async function loadProperty() {
  try {
    const res = await fetch(`${API}/properties/${propertyId}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Unable to load property.");
    }

    const property = data.property || data;
    renderProperty(property);
  } catch (err) {
    console.error("Load Property Error:", err);
    showToast("Unable to load property details.", "error");
    setTimeout(() => (window.location.href = "dashboard.html"), 1500);
  }
}

// ==========================================
// RENDER PROPERTY SUMMARY
// ==========================================

function renderProperty(property) {
  const propertyName = property.propertyName || property.title || "Campora Property";
  const rent = property.rent || property.price || 0;
  const deposit = property.deposit || 0;
  const city = property.city || "";
  const state = property.state || "";
  const location = city + (state ? ", " + state : "");

  const imagePath = property.images && property.images.length ? property.images[0] : "";

  // Property title
  const titleEl = $("propertyTitle");
  if (titleEl) titleEl.textContent = propertyName;

  // Location
  const locEl = $("propertyLocation");
  if (locEl) locEl.textContent = location || "Location not specified";

  // Price
  const priceEl = $("propertyPrice");
  if (priceEl) priceEl.textContent = rent.toLocaleString();

  // Deposit
  const depositEl = $("deposit");
  if (depositEl) depositEl.textContent = "\u20B9" + Number(deposit).toLocaleString();

  // Image
  const imageEl = $("propertyImage");
  if (imageEl) {
    imageEl.src = imagePath
      ? imagePath.startsWith("http")
        ? imagePath
        : `${API.replace("/api", "")}/${imagePath.replace(/^\/+/, "")}`
      : "https://placehold.co/700x450?text=Campora";
  }

  // Total amount
  const total = Number(rent) + 1000 + Number(deposit);
  const totalEl = $("totalAmount");
  if (totalEl) totalEl.textContent = "\u20B9" + total.toLocaleString();
}

// ==========================================
// SUBMIT BOOKING
// ==========================================

const bookingForm = $("bookingForm");

if (bookingForm) {
  bookingForm.addEventListener("submit", submitBooking);
}

async function submitBooking(e) {
  e.preventDefault();

  const button = bookingForm.querySelector("button[type='submit']");
  if (!button) return;

  // ==========================================
  // INPUT VALIDATION
  // ==========================================

  const moveInDate = $("moveInDate")?.value;
  const duration = $("duration")?.value;
  const specialRequestField = $("specialRequest");
  const specialRequest = specialRequestField ? specialRequestField.value.trim() : "";

  if (!moveInDate) {
    showToast("Please select a move-in date.", "error");
    return;
  }

  // Validate move-in date is not in the past
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const selectedDate = new Date(moveInDate);
  if (selectedDate < today) {
    showToast("Move-in date cannot be in the past.", "error");
    return;
  }

  if (!duration) {
    showToast("Please select a duration.", "error");
    return;
  }

  if (specialRequest.length > 500) {
    showToast("Special request must be under 500 characters.", "error");
    return;
  }

  // ==========================================
  // CHECK DUPLICATE BOOKING
  // ==========================================

  try {
    const checkRes = await fetch(
      `${API}/bookings/check?propertyId=${propertyId}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const checkData = await checkRes.json();
    if (checkData.exists) {
      showToast("You already have a booking for this property.", "info");
      setTimeout(() => (window.location.href = "bookings.html"), 1500);
      return;
    }
  } catch (err) {
    // Continue even if check fails
  }

  // Disable button
  button.disabled = true;
  button.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating Booking...';

  try {
    // NOTE: userId/userName/userEmail are NOT sent.
    // The backend derives identity from the JWT token.
    const body = {
      propertyId,
      moveInDate,
      duration,
      specialRequest,
    };

    const res = await fetch(`${API}/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Booking failed.");
    }

    showToast("Booking created successfully!", "success", 2000);

    // Redirect to payment
    const bookingId = data.booking?._id || data.booking?.id;
    if (bookingId) {
      setTimeout(() => {
        window.location.href = `payment.html?id=${bookingId}`;
      }, 1000);
    } else {
      setTimeout(() => (window.location.href = "bookings.html"), 1000);
    }
  } catch (err) {
    console.error("Booking Error:", err);
    showToast(err.message || "Unable to create booking. Please try again.", "error");
  } finally {
    button.disabled = false;
    button.textContent = "Proceed to Payment";
  }
}

// =====================================================
// EXPOSE TOAST
// =====================================================

window.showToast = showToast;

console.log("✅ Campora Booking Page Loaded");

