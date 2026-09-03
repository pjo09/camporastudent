// =====================================================
// CAMPORA PAYMENT PAGE
// =====================================================
// NOTE: Payment integration is INTENTIONALLY DISABLED for
// the current production phase. This file is retained for
// future Razorpay integration. No active page imports it.
// =====================================================
// Razorpay Checkout + Real Booking Load

import { getToken, getUser, protectPageByRole } from "./session.js";
import { API } from "./config.js";
import { getImageUrl } from "./image-utils.js";

const API_BASE = API;

const params = new URLSearchParams(window.location.search);
const bookingId = params.get("id");

// =====================================================
// AUTH CHECK - only students can pay
// =====================================================

const user = protectPageByRole(["student"]);
const token = getToken();

function $(id) {
  return document.getElementById(id);
}

// =====================================================
// STATE
// =====================================================

let bookingData = null;
let propertyData = null;
let orderAmount = 0;
let razorpayOrder = null;
let isSubmitting = false;

// =====================================================
// INIT
// =====================================================

window.addEventListener("DOMContentLoaded", () => {
  if (!bookingId) {
    showToast("No booking selected", "error");
    setTimeout(() => (window.location.href = "bookings.html"), 1500);
    return;
  }
  setupCardFormatting();
  loadBooking();
});

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
// LOAD BOOKING
// =====================================================

async function loadBooking() {
  try {
    const { supabase } = await import("./supabaseClient.js");
    const { data: booking, error } = await supabase
      .from("bookings")
      .select("*, properties!property_id(*)")
      .eq("id", bookingId)
      .maybeSingle();

    if (error || !booking) throw new Error(error?.message || "Unable to load booking.");

    bookingData = {
      ...booking,
      propertyId: booking.properties ? {
        propertyName: booking.properties.property_name,
        city: booking.properties.city,
        state: booking.properties.state,
        rent: booking.properties.rent,
        deposit: booking.properties.deposit,
        images: booking.properties.images
      } : {}
    };
    propertyData = bookingData.propertyId;
    renderBooking();
  } catch (err) {
    console.error("Load booking error:", err);
    showToast(err.message || "Unable to load booking", "error");
  }
}

// =====================================================
// RENDER BOOKING SUMMARY
// =====================================================

function renderBooking() {
  const prop = propertyData;
  const name = prop.propertyName || bookingData.propertyName || "Campora Property";
  const city = prop.city || "";
  const state = prop.state || "";
  const location = city + (state ? ", " + state : "") || "Location not specified";
  const rent = Number(prop.rent || bookingData.price || 0);
  const deposit = Number(prop.deposit || 0);
  const bookingFee = 1000;
  const total = rent + deposit + bookingFee;

  orderAmount = total;

  // Property title
  const titleEl = $("propertyTitle");
  if (titleEl) titleEl.textContent = name;

  // Location
  const locEl = $("propertyLocation");
  if (locEl) locEl.textContent = location;

  // Image
  const img = getImageUrl(prop.images?.[0] || prop.image || prop.imageUrl);
  const imgEl = $("propertyImage");
  if (imgEl) {
    imgEl.src = img;
    imgEl.onerror = () => { imgEl.onerror = null; imgEl.src = "/assets/images/property-placeholder.jpg"; };
  }

  // Price
  const amountEl = $("amount");
  if (amountEl) amountEl.textContent = rent.toLocaleString();

  // Deposit
  const depositEl = $("deposit");
  if (depositEl) depositEl.textContent = "₹" + deposit.toLocaleString();

  // Total
  const totalEl = $("total");
  if (totalEl) totalEl.textContent = "₹" + total.toLocaleString();

  // Pay button label
  const payBtn = document.querySelector(".pay-btn");
  if (payBtn) payBtn.textContent = `Pay ₹${total.toLocaleString()}`;
}

// =====================================================
// IMAGE URL HELPER
// =====================================================

// Centralized getImageUrl helper is imported from image-utils.js

// =====================================================
// CARD FORMATTING (UI only - Razorpay handles real input)
// =====================================================

function setupCardFormatting() {
  const card = $("cardNumber");
  if (card) {
    card.addEventListener("input", () => {
      let value = card.value.replace(/\D/g, "");
      value = value.match(/.{1,4}/g);
      card.value = value ? value.join(" ") : "";
    });
  }

  const expiry = $("expiry");
  if (expiry) {
    expiry.addEventListener("input", (e) => {
      let value = e.target.value.replace(/\D/g, "");
      if (value.length >= 3) {
        value = value.substring(0, 2) + "/" + value.substring(2, 4);
      }
      e.target.value = value;
    });
  }

  const coupon = $("coupon");
  if (coupon) {
    coupon.addEventListener("change", () => {
      const code = coupon.value.trim().toUpperCase();
      if (code) {
        showToast("Coupon functionality is currently unavailable.", "error");
      }
    });
  }
}

// =====================================================
// PAYMENT FLOW
// =====================================================

const form = $("paymentForm");
if (form) {
  form.addEventListener("submit", payNow);
}

async function payNow(e) {
  e.preventDefault();
  if (isSubmitting) return;
  if (!bookingData) {
    showToast("Booking is still loading. Please wait.", "error");
    return;
  }

  const payBtn = document.querySelector(".pay-btn");
  if (payBtn) {
    payBtn.disabled = true;
    payBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Preparing Checkout...';
  }
  isSubmitting = true;

  try {
    const { supabase } = await import("./supabaseClient.js");
    const { data: updatedBooking, error } = await supabase
      .from("bookings")
      .update({
        payment_status: "paid",
        booking_status: "confirmed",
        updated_at: new Date().toISOString()
      })
      .eq("id", bookingId)
      .select()
      .single();

    if (error) throw error;

    showToast("Payment recorded successfully!", "success", 2000);
    setTimeout(() => {
      window.location.href = `success.html?id=${bookingId}`;
    }, 1000);
  } catch (err) {
    console.error("Payment error:", err);
    showToast(err.message || "Payment failed. Please try again.", "error");
  } finally {
    isSubmitting = false;
    const payBtn2 = document.querySelector(".pay-btn");
    if (payBtn2) {
      payBtn2.disabled = false;
      payBtn2.textContent = orderAmount ? `Pay ₹${orderAmount.toLocaleString()}` : "Pay Securely";
    }
  }
}

// =====================================================
// RAZORPAY CHECKOUT
// =====================================================

function openRazorpayCheckout(order, amount) {
  return new Promise((resolve, reject) => {
    if (typeof Razorpay === "undefined") {
      reject(new Error("Payment SDK failed to load. Please refresh and try again."));
      return;
    }

    const options = {
      key: window.__RAZORPAY_KEY_ID || "",
      amount: (order.amount || amount) * 100,
      currency: "INR",
      name: "Campora",
      description: `Booking ${bookingId}`,
      order_id: order.id,
      handler: async (response) => {
        try {
          const { supabase } = await import("./supabaseClient.js");
          const { error } = await supabase
            .from("bookings")
            .update({
              payment_status: "paid",
              booking_status: "confirmed",
              updated_at: new Date().toISOString()
            })
            .eq("id", bookingId);

          if (error) throw error;

          showToast("Payment successful!", "success", 2000);
          setTimeout(() => {
            window.location.href = `success.html?id=${bookingId}`;
          }, 1000);
          resolve();
        } catch (err) {
          showToast(err.message || "Payment verification failed", "error");
          reject(err);
        }
      },
      modal: {
        ondismiss: () => {
          showToast("Payment cancelled", "info");
          resolve();
        },
      },
      prefill: {
        name: user ? user.name || "" : "",
        email: user ? user.email || "" : "",
      },
      theme: {
        color: "#2563eb",
      },
    };

    try {
      const rzp = new Razorpay(options);
      rzp.open();
    } catch (err) {
      console.error("Razorpay open error:", err);
      reject(new Error("Unable to open payment window"));
    }
  });
}

// =====================================================
// EXPOSE TOAST GLOBALLY
// =====================================================

window.showToast = showToast;

console.log("✅ Campora Payment Page Loaded");

