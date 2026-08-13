// =====================================================
// CAMPORA STUDENT V3 - PROPERTY DETAILS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, inr, esc, timeAgo } from "./student-utils.js";

const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  if (!propertyId) {
    showError("No property selected");
    return;
  }
  loadProperty();
  setupEvents();
});

function showError(msg) {
  const loading = $("loading");
  if (loading) {
loading.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:40px;color:#f87171"></i><p style="margin-top:12px;color:var(--sv3-muted)">${esc(msg)}</p><a href="properties.html" class="sv3-btn sv3-btn-primary" style="margin-top:16px">Back to Explore</a>`;
  }
}

function setupEvents() {
  const bookBtn = $("bookBtn");
  if (bookBtn) {
    bookBtn.addEventListener("click", () => {
window.location.href = `/pages/student/booking-details.html?id=${propertyId}`;
    });
  }
  const saveBtn = $("saveBtn");
  if (saveBtn) {
    saveBtn.addEventListener("click", toggleSave);
  }
  const contactBtn = $("contactOwnerBtn");
  if (contactBtn) {
    contactBtn.addEventListener("click", () => {
window.location.href = `messages.html?property=${propertyId}`;
    });
  }
}

async function loadProperty() {
  try {
    const data = await apiFetch(`/properties/${propertyId}`);
    renderProperty(data.property);
    loadReviews();
  } catch (err) {
    showError(err.message || "Unable to load property");
  }
}

function renderProperty(p) {
  const loading = $("loading");
  const details = $("propertyDetails");
  if (loading) loading.style.display = "none";
  if (details) details.style.display = "block";

  const name = p.propertyName || p.title || "Campora Property";
  const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
  const rent = p.rent || p.price || 0;
  const rating = p.averageRating || 0;
  const img = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/logos/logo.png";

  if ($("propertyName")) $("propertyName").textContent = name;
  if ($("propertyLocation")) $("propertyLocation").textContent = loc;
  if ($("propertyPrice")) $("propertyPrice").textContent = `${inr(rent)}/month`;
  if ($("propertyRating")) $("propertyRating").innerHTML = rating > 0 ? `<i class="fa-solid fa-star"></i> ${rating.toFixed(1)} ${p.totalReviews ? `(${p.totalReviews})` : ""}` : "New listing";
  if ($("propertyDescription")) $("propertyDescription").textContent = p.description || "No description available.";
  const imgEl = $("propertyImage");
  if (imgEl) { imgEl.src = img; imgEl.onerror = () => { imgEl.src = "/assets/logos/logo.png"; }; }

  // Chips
  const chips = $("propertyChips");
  if (chips) {
    const parts = [];
    if (p.propertyType) parts.push(`<span class="sv3-pill sv3-pill-info">${esc(p.propertyType)}</span>`);
    if (p.sharing) parts.push(`<span class="sv3-pill sv3-pill-neutral">${esc(p.sharing)}</span>`);
    if (p.gender) parts.push(`<span class="sv3-pill sv3-pill-purple" style="background:rgba(124,58,237,.15);color:#a78bfa">${esc(p.gender)}</span>`);
    if (p.deposit) parts.push(`<span class="sv3-pill sv3-pill-warning">Deposit ${inr(p.deposit)}</span>`);
    chips.innerHTML = parts.join("");
  }

  // Amenities
  const amenities = $("amenitiesGrid");
  if (amenities) {
    const list = Array.isArray(p.amenities) ? p.amenities : (p.amenities ? Object.keys(p.amenities).filter((k) => p.amenities[k]) : []);
    amenities.innerHTML = list.length
      ? list.map((a) => `<div class="sv3-card" style="text-align:center;padding:18px"><i class="fa-solid fa-circle-check" style="color:#22c55e;font-size:18px;margin-bottom:8px;display:block"></i><span style="font-size:13.5px;font-weight:600">${esc(a)}</span></div>`).join("")
      : `<div class="sv3-empty" style="grid-column:1/-1"><i class="fa-solid fa-list-check"></i><p>No amenities listed</p></div>`;
  }

  // Check saved state
  checkSaved();
}

async function checkSaved() {
  try {
    const data = await apiFetch(`/properties/save/${propertyId}/check`);
    const btn = $("saveBtn");
    if (btn && data.saved) {
      btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      btn.style.background = "var(--sv3-red)";
    }
  } catch (err) {
    // silent
  }
}

async function toggleSave() {
  const btn = $("saveBtn");
  if (!btn) return;
  const isSaved = btn.querySelector("i").classList.contains("fa-solid");
  try {
    if (isSaved) {
      await apiFetch(`/properties/save/${propertyId}`, { method: "DELETE" });
      btn.innerHTML = '<i class="fa-regular fa-heart"></i>';
      btn.style.background = "rgba(0,0,0,0.4)";
    } else {
      await apiFetch(`/properties/save/${propertyId}`, { method: "POST" });
      btn.innerHTML = '<i class="fa-solid fa-heart"></i>';
      btn.style.background = "var(--sv3-red)";
    }
  } catch (err) {
    // silent
  }
}

async function loadReviews() {
  const list = $("reviewsList");
  const link = $("reviewsLink");
  if (!list) return;
if (link) link.href = `reviews.html?id=${propertyId}`;
  try {
    const data = await apiFetch(`/reviews/${propertyId}`);
    const reviews = data.reviews || [];
    if (reviews.length === 0) {
      list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-star"></i><h3>No reviews yet</h3><p>Be the first to review this property.</p></div>`;
      return;
    }
    list.innerHTML = reviews.map((r) => `
      <div class="sv3-list-item">
        <div class="sv3-list-item-icon"><i class="fa-solid fa-user"></i></div>
        <div class="sv3-list-item-body">
          <div class="sv3-list-item-title">${esc(r.name || "Student")} <span style="color:#fbbf24;font-size:13px">${'★'.repeat(Math.min(5, r.rating || 0))}</span></div>
          <div class="sv3-list-item-sub">${esc(r.comment || "")} · ${timeAgo(r.createdAt)}</div>
        </div>
      </div>`).join("");
  } catch (err) {
    list.innerHTML = `<div class="sv3-empty"><p>Could not load reviews.</p></div>`;
  }
}
