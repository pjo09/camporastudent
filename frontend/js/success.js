// =====================================================
// CAMPORA SUCCESS PAGE
// =====================================================

import { getToken, getUser, protectPage } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

const params = new URLSearchParams(window.location.search);
const bookingId = params.get("id");

// Auth check
const user = protectPage();
const token = getToken();

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

// =====================================================
// INIT
// =====================================================

window.addEventListener("DOMContentLoaded", () => {
  if (!bookingId) {
    showToast("No booking reference found", "error");
    setTimeout(() => (window.location.href = "bookings.html"), 1500);
    return;
  }
  loadBooking();
  createConfetti();
});

// =====================================================
// LOAD BOOKING
// =====================================================

async function loadBooking() {
  try {
    const res = await fetch(`${API_BASE}/bookings/${bookingId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Unable to load booking.");

    const booking = data.booking;
    renderBooking(booking);
  } catch (err) {
    console.error("Load booking error:", err);
    showToast(err.message || "Unable to load booking details", "error");
  }
}

// =====================================================
// SHOW BOOKING
// =====================================================

function renderBooking(booking) {
  const prop = booking.propertyId || {};
  const propertyName = prop.propertyName || booking.propertyName || "Campora Property";
  const rent = Number(prop.rent || booking.price || 0);
  const deposit = Number(prop.deposit || 0);
  const bookingFee = 1000;
  const total = rent + deposit + bookingFee;

  const bookingIdEl = $("bookingId");
  if (bookingIdEl) bookingIdEl.textContent = booking._id || booking.id || bookingId;

  const propNameEl = $("propertyName");
  if (propNameEl) propNameEl.textContent = propertyName;

  const paidAmountEl = $("paidAmount");
  if (paidAmountEl) paidAmountEl.textContent = "₹" + total.toLocaleString();
}

// =====================================================
// DOWNLOAD INVOICE
// =====================================================

const invoiceBtn = $("downloadInvoice");
if (invoiceBtn) {
  invoiceBtn.addEventListener("click", downloadInvoice);
}

function downloadInvoice(e) {
  e.preventDefault();

  const bookingIdText = ($("bookingId") || {}).textContent || "N/A";
  const propertyNameText = ($("propertyName") || {}).textContent || "Campora Property";
  const paidText = ($("paidAmount") || {}).textContent || "₹0";

  const invoice = `
==============================

CAMPORA INVOICE

==============================

Booking ID :

${bookingIdText}

Property :

${propertyNameText}

Amount Paid :

${paidText}

Status :

PAID

Thank you for choosing Campora.

`;

  const blob = new Blob([invoice], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "Campora-Invoice.txt";
  a.click();
  URL.revokeObjectURL(url);
}

// =====================================================
// SIMPLE CONFETTI
// =====================================================

function createConfetti() {
  for (let i = 0; i < 120; i++) {
    const confetti = document.createElement("div");
    confetti.className = "confetti";
    confetti.style.left = Math.random() * 100 + "vw";
    confetti.style.animationDelay = Math.random() * 2 + "s";
    confetti.style.animationDuration = 3 + Math.random() * 3 + "s";
    confetti.style.background = [
      "#2563eb",
      "#22c55e",
      "#f59e0b",
      "#7c3aed",
      "#ec4899",
    ][Math.floor(Math.random() * 5)];
    document.body.appendChild(confetti);
  }
}

// =====================================================
// EXPOSE TOAST
// =====================================================

window.showToast = showToast;

console.log("✅ Campora Success Page Loaded");

