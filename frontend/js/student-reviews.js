// =====================================================
// CAMPORA STUDENT V3 - REVIEWS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, esc, timeAgo, showToast } from "./student-utils.js";

let myReviews = [];
let currentUserId = null;

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  setupModal();
  loadData();
});

async function loadData() {
  try {
    const profile = await apiFetch("/student/profile");
    currentUserId = profile.user?._id || null;
    const bookings = await apiFetch("/student/bookings");
    const properties = bookings.bookings || [];
    await loadMyReviews(properties);
    populatePropertySelect(properties);
  } catch (err) {
    const list = $("reviewsList");
    if (list) list.innerHTML = `<div class="sv3-error"><p>${esc(err.message)}</p></div>`;
  }
}

async function loadMyReviews(bookings) {
  const list = $("reviewsList");
  if (!list) return;
  const results = [];
  const seen = new Set();
  for (const b of bookings) {
    const prop = b.propertyId || {};
    if (!prop._id || seen.has(prop._id)) continue;
    seen.add(prop._id);
    try {
      const data = await apiFetch(`/reviews/${prop._id}`);
      (data.reviews || []).forEach((r) => {
        if (currentUserId && r.user && (r.user._id || r.user) === currentUserId) {
          results.push({ ...r, property: prop });
        }
      });
    } catch (e) { /* skip */ }
  }

  if (results.length === 0) {
    list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-star"></i><h3>No reviews yet</h3><p>You haven't written any reviews. Share your experience with a property you've booked.</p></div>`;
    return;
  }

  list.innerHTML = results.map((r) => {
    const prop = r.property || {};
    const stars = "★".repeat(Math.max(0, Math.min(5, r.rating || 0))) + "☆".repeat(Math.max(0, 5 - (r.rating || 0)));
    return `
      <div class="sv3-list-item">
        <div class="sv3-list-item-icon"><i class="fa-solid fa-star" style="color:#fbbf24"></i></div>
        <div class="sv3-list-item-body">
          <div class="sv3-list-item-title">${esc(prop.propertyName || "Property")}</div>
          <div style="color:#fbbf24;font-size:14px">${stars}</div>
          <div class="sv3-list-item-sub">${esc(r.comment || "")}</div>
          <div class="sv3-list-item-sub">${timeAgo(r.createdAt)}</div>
        </div>
      </div>`;
  }).join("");
}

function populatePropertySelect(bookings) {
  const select = $("reviewProperty");
  if (!select) return;
  const seen = new Set();
  bookings.forEach((b) => {
    const prop = b.propertyId || {};
    if (prop._id && !seen.has(prop._id)) {
      seen.add(prop._id);
      const opt = document.createElement("option");
      opt.value = prop._id;
      opt.textContent = prop.propertyName || "Property";
      select.appendChild(opt);
    }
  });
  if (seen.size === 0) {
    select.innerHTML = `<option value="">Book a property to review</option>`;
  }
}

// =====================================================
// MODAL
// =====================================================

let selectedRating = 0;

function setupModal() {
  const modal = $("reviewModal");
  const openBtn = $("newReviewBtn");
  const closeBtn = $("reviewModalClose");
  if (!modal) return;

  openBtn?.addEventListener("click", () => {
    modal.classList.add("sv3-open");
    modal.setAttribute("aria-hidden", "false");
  });
  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  const stars = document.querySelectorAll("#starInput .fa-star");
  stars.forEach((s) => {
    s.addEventListener("click", () => {
      selectedRating = Number(s.dataset.v);
      stars.forEach((x) => {
        const v = Number(x.dataset.v);
        x.style.color = v <= selectedRating ? "#fbbf24" : "rgba(255,255,255,.2)";
      });
    });
  });

  $("reviewForm")?.addEventListener("submit", submitReview);
}

function closeModal() {
  const modal = $("reviewModal");
  if (modal) {
    modal.classList.remove("sv3-open");
    modal.setAttribute("aria-hidden", "true");
  }
}

async function submitReview(e) {
  e.preventDefault();
  const btn = $("submitReview");
  if (!btn) return;
  btn.disabled = true;
  try {
    const propertyId = $("reviewProperty")?.value;
    const comment = $("reviewComment")?.value.trim();
    if (!propertyId) throw new Error("Please select a property");
    if (!selectedRating) throw new Error("Please select a rating");
    if (!comment) throw new Error("Please write a comment");

    await apiFetch("/reviews", {
      method: "POST",
      body: JSON.stringify({ property: propertyId, rating: selectedRating, comment }),
    });
    showToast("Review submitted", "success");
    closeModal();
    e.target.reset();
    selectedRating = 0;
    document.querySelectorAll("#starInput .fa-star").forEach((x) => (x.style.color = "rgba(255,255,255,.2)"));
    loadData();
  } catch (err) {
    showToast(err.message || "Unable to submit review", "error");
  } finally {
    btn.disabled = false;
  }
}
