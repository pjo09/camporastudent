// =====================================================
// CAMPORA PROPERTY DETAILS PAGE
// Full production version with all states
// =====================================================

import {
  getToken,
  getUser,
  isLoggedIn,
  protectPage,
} from "./session.js";
import { API } from "./config.js";

const API_BASE = API;
const IMAGE_BASE = `${API.replace("/api", "")}/`;

// =====================================================
// STATE
// =====================================================

const params = new URLSearchParams(window.location.search);
const propertyId = params.get("id");

let currentProperty = null;
let isSaved = false;
let currentImages = [];
let currentImageIndex = 0;
let reviews = [];
let reviewsPage = 0;
const REVIEWS_PER_PAGE = 6;
let user = null;
let token = null;

// =====================================================
// DOM REFS
// =====================================================

const $ = (id) => document.getElementById(id);

const DOM = {
  loading: $("propertyLoading"),
  error: $("propertyError"),
  errorMsg: $("propertyErrorMessage"),
  content: $("propertyContent"),

  mainImage: $("mainImage"),
  thumbContainer: $("thumbnailContainer"),
  prevImage: $("prevImage"),
  nextImage: $("nextImage"),

  title: $("propertyTitle"),
  location: $("propertyLocation"),
  rating: $("propertyRating"),
  reviewCount: $("reviewCount"),
  viewCount: $("viewCount"),
  price: $("propertyPrice"),
  deposit: $("depositDisplay"),
  sharing: $("sharingDisplay"),
  description: $("propertyDescription"),

  badge: $("propertyBadge"),
  typeBadge: $("propertyTypeBadge"),
  availBadge: $("availabilityBadge"),

  amenities: $("amenities"),
  roomType: $("roomType"),
  availableBeds: $("availableBeds"),
  propertyGender: $("propertyGender"),
  securityDeposit: $("securityDeposit"),
  totalBeds: $("totalBeds"),
  propType: $("propType"),

  houseRules: $("houseRules"),
  extraCharges: $("extraCharges"),
  nearbyUnis: $("nearbyUniversities"),

  avgRating: $("averageRating"),
  starsDisplay: $("starsDisplay"),
  totalReviews: $("totalReviews"),
  reviewContainer: $("reviewContainer"),
  loadMoreReviews: $("loadMoreReviews"),

  reviewRating: $("reviewRating"),
  reviewComment: $("reviewComment"),
  reviewForm: $("reviewForm"),
  ratingStars: $("ratingStars"),

  ownerName: $("ownerName"),
  ownerAvatar: $("ownerAvatar"),
  ownerStatus: $("ownerStatus"),
  contactOwner: $("contactOwner"),
  chatOwner: $("chatOwner"),

  qAvailableBeds: $("qAvailableBeds"),
  qOccupancy: $("qOccupancy"),
  qPosted: $("qPosted"),
  qViews: $("qViews"),

  mapContainer: $("propertyMap"),
  directionBtn: $("directionBtn"),

  saveBtn: $("saveProperty"),
  bookBtn: $("bookNowBtn"),

  similarContainer: $("similarProperties"),

  bookingModal: $("bookingModal"),
  closeModal: $("closeModal"),
  cancelBooking: $("cancelBooking"),
  bookingForm: $("bookingForm"),
  moveInDate: $("moveInDate"),
  duration: $("duration"),
  specialRequest: $("specialRequest"),
  confirmBookingBtn: $("confirmBookingBtn"),
  bookPropertyName: $("bookPropertyName"),

  toastContainer: $("toastContainer"),
};

// =====================================================
// INIT
// =====================================================

window.addEventListener("DOMContentLoaded", async () => {
  // Check auth but don't block property viewing
  token = getToken();
  user = getUser();

  if (!propertyId) {
    showError("Property ID is missing. Please select a property.");
    return;
  }

  await loadProperty();
});

// =====================================================
// TOAST
// =====================================================

function showToast(msg, type = "info", dur = 4000) {
  if (!DOM.toastContainer) return;
  const icons = { success: "fa-circle-check", error: "fa-circle-exclamation", info: "fa-circle-info" };
  const t = document.createElement("div");
  t.className = `toast toast-${type}`;
  t.innerHTML = `<i class="fa-solid ${icons[type] || icons.info}"></i> ${msg}`;
  DOM.toastContainer.appendChild(t);
  setTimeout(() => { t.classList.add("toast-leaving"); setTimeout(() => t.remove(), 300); }, dur);
}

// =====================================================
// LOAD PROPERTY
// =====================================================

async function loadProperty() {
  showLoading();

  try {
    const res = await fetch(`${API_BASE}/properties/${propertyId}`);
    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "Unable to load property.");
    }

    currentProperty = data.property || data;
    currentImages = currentProperty.images || [];
    currentImageIndex = 0;

    hideLoading();
    renderProperty(currentProperty);
    await loadReviews();
    await loadSimilar();
    await checkSavedStatus();
  } catch (err) {
    console.error("Property load error:", err);
    hideLoading();
    showError(err.message || "Unable to load property details.");
  }
}

// =====================================================
// RENDER PROPERTY
// =====================================================

function renderProperty(p) {
  DOM.content.style.display = "block";

  // Title
  const name = p.propertyName || p.title || "Campora Property";
  DOM.title.textContent = name;

  // Location
  const loc = [p.city, p.state, p.address].filter(Boolean).join(", ") || "Location not specified";
  DOM.location.innerHTML = `<i class="fa-solid fa-location-dot"></i> ${loc}`;

  // Price
  const rent = p.rent || p.price || 0;
  DOM.price.textContent = rent.toLocaleString();
  DOM.deposit.textContent = `Deposit: ₹${(p.deposit || 0).toLocaleString()}`;
  DOM.sharing.textContent = p.sharing || "";

  // Rating & views
  const rating = p.averageRating || 0;
  DOM.rating.textContent = rating.toFixed(1);
  DOM.reviewCount.textContent = `${p.totalReviews || 0} Reviews`;
  DOM.viewCount.innerHTML = `<i class="fa-regular fa-eye"></i> ${p.views || 0} views`;

  // Description
  DOM.description.textContent = p.description || "No description available.";

  // Badges
  if (p.verified) { DOM.badge.textContent = "Verified"; DOM.badge.style.display = "inline-flex"; DOM.badge.className = "badge-chip badge-verified"; }
  else if (p.featured) { DOM.badge.textContent = "Featured"; DOM.badge.style.display = "inline-flex"; DOM.badge.className = "badge-chip"; }
  else DOM.badge.style.display = "none";

  DOM.typeBadge.textContent = p.propertyType || "";
  DOM.typeBadge.style.display = p.propertyType ? "inline-flex" : "none";

  DOM.availBadge.textContent = p.available ? "Available" : "Occupied";
  DOM.availBadge.style.display = "inline-flex";
  DOM.availBadge.className = `badge-chip ${p.available ? "badge-success" : "badge-danger"}`;

  // Images
  renderImages(currentImages);

  // Amenities
  renderAmenities(p.amenities);

  // Room info
  DOM.roomType.textContent = p.sharing || "Not specified";
  DOM.availableBeds.textContent = p.availableBeds ?? 0;
  DOM.propertyGender.textContent = p.gender || "Open";
  DOM.securityDeposit.textContent = `₹${(p.deposit || 0).toLocaleString()}`;
  DOM.totalBeds.textContent = p.totalBeds ?? 0;
  DOM.propType.textContent = p.propertyType || "Not specified";

  // House rules
  renderHouseRules(p.houseRules);

  // Extra charges
  renderExtraCharges(p);

  // Nearby universities
  renderNearby(p.nearby);

  // Owner
  const owner = p.owner || {};
  DOM.ownerName.textContent = owner.name || "Campora Owner";
  DOM.ownerAvatar.textContent = (owner.name || "C").charAt(0).toUpperCase();
  DOM.ownerStatus.textContent = owner.verified ? "✅ Verified Owner" : "Property Owner";

  // Quick stats
  const bedsAvail = p.availableBeds || 0;
  const bedsTotal = p.totalBeds || 0;
  const occupancy = bedsTotal > 0 ? Math.round(((bedsTotal - bedsAvail) / bedsTotal) * 100) : 0;
  DOM.qAvailableBeds.textContent = bedsAvail;
  DOM.qOccupancy.textContent = `${occupancy}%`;
  DOM.qViews.textContent = p.views || 0;
  DOM.qPosted.textContent = p.createdAt ? timeAgo(p.createdAt) : "Recently";

  // Map
  renderMap(p);

  // Booking modal
  DOM.bookPropertyName.textContent = name;

  // Setup events
  setupEvents(p);
}

// =====================================================
// RENDER IMAGES
// =====================================================

function renderImages(images) {
  if (!images || images.length === 0) {
    DOM.mainImage.src = "./images/property-placeholder.jpg";
    DOM.thumbContainer.innerHTML = `<div class="empty-thumbs">No images available</div>`;
    return;
  }

  currentImageIndex = 0;
  updateMainImage();

  DOM.thumbContainer.innerHTML = "";
  images.forEach((img, i) => {
    const thumb = document.createElement("img");
    thumb.src = getImageUrl(img);
    thumb.alt = `Property image ${i + 1}`;
    thumb.className = `thumbnail ${i === 0 ? "active" : ""}`;
    thumb.loading = "lazy";
    thumb.addEventListener("click", () => {
      currentImageIndex = i;
      updateMainImage();
      DOM.thumbContainer.querySelectorAll(".thumbnail").forEach(t => t.classList.remove("active"));
      thumb.classList.add("active");
    });
    DOM.thumbContainer.appendChild(thumb);
  });
}

function updateMainImage() {
  if (currentImages.length > 0) {
    DOM.mainImage.src = getImageUrl(currentImages[currentImageIndex]);
  }
  DOM.prevImage.style.display = currentImages.length > 1 ? "flex" : "none";
  DOM.nextImage.style.display = currentImages.length > 1 ? "flex" : "none";
}

function getImageUrl(imgPath) {
  if (!imgPath) return "./images/property-placeholder.jpg";
  if (imgPath.startsWith("http")) return imgPath;
  return IMAGE_BASE + imgPath.replace(/^\//, "");
}

// =====================================================
// RENDER AMENITIES
// =====================================================

function renderAmenities(amenities) {
  const am = amenities || [];
  const iconMap = {
    wifi: "fa-wifi", "high speed wifi": "fa-wifi", internet: "fa-wifi",
    food: "fa-utensils", "food included": "fa-utensils", meals: "fa-utensils",
    laundry: "fa-shirt", washing: "fa-shirt",
    parking: "fa-car", "car parking": "fa-car",
    ac: "fa-fan", "air conditioning": "fa-fan", "air conditioner": "fa-fan",
    security: "fa-shield", "24x7 security": "fa-shield", cctv: "fa-shield",
    gym: "fa-dumbbell", fitness: "fa-dumbbell",
    tv: "fa-tv", "smart tv": "fa-tv",
    water: "fa-faucet", "water supply": "fa-faucet",
    cleaning: "fa-broom", housekeeping: "fa-broom",
    power: "fa-bolt", backup: "fa-bolt", "power backup": "fa-bolt",
    lift: "fa-elevator", elevator: "fa-elevator",
    garden: "fa-seedling", terrace: "fa-seedling",
    library: "fa-book", "study room": "fa-book",
  };

  DOM.amenities.innerHTML = "";
  if (am.length === 0) {
    DOM.amenities.innerHTML = `<div class="empty-small">Amenities not specified</div>`;
    return;
  }

  am.forEach((item) => {
    const key = item.toLowerCase().trim();
    const icon = iconMap[key] || "fa-circle-check";
    const card = document.createElement("div");
    card.className = "amenity";
    card.innerHTML = `<i class="fa-solid ${icon}"></i><span>${item}</span>`;
    DOM.amenities.appendChild(card);
  });
}

// =====================================================
// RENDER HOUSE RULES
// =====================================================

function renderHouseRules(rules) {
  DOM.houseRules.innerHTML = "";
  if (!rules) {
    DOM.houseRules.innerHTML = `<div class="empty-small">No rules specified</div>`;
    return;
  }
  const ruleItems = [
    { key: "smoking", icon: "fa-smoking", label: "Smoking" },
    { key: "drinking", icon: "fa-wine-bottle", label: "Drinking" },
    { key: "pets", icon: "fa-dog", label: "Pets" },
    { key: "visitors", icon: "fa-users", label: "Visitors" },
    { key: "gateClosingTime", icon: "fa-clock", label: `Gate Closing: ${rules.gateClosingTime || "Not set"}` },
  ];

  ruleItems.forEach((r) => {
    if (r.key === "gateClosingTime") {
      const div = document.createElement("div");
      div.className = "rule-chip";
      div.innerHTML = `<i class="fa-solid ${r.icon}"></i> ${r.label}`;
      DOM.houseRules.appendChild(div);
    } else if (rules[r.key] !== undefined) {
      const allowed = rules[r.key];
      const div = document.createElement("div");
      div.className = `rule-chip ${allowed ? "allowed" : "not-allowed"}`;
      div.innerHTML = `<i class="fa-solid ${r.icon}"></i> ${r.label}: ${allowed ? "✅ Allowed" : "❌ Not Allowed"}`;
      DOM.houseRules.appendChild(div);
    }
  });
}

// =====================================================
// RENDER EXTRA CHARGES
// =====================================================

function renderExtraCharges(p) {
  DOM.extraCharges.innerHTML = "";
  const charges = [
    { label: "Maintenance", value: p.maintenanceCharge },
    { label: "Electricity", value: p.electricityCharge },
    { label: "Food", value: p.foodCharge },
  ];
  let hasCharges = false;
  charges.forEach((c) => {
    if (c.value && c.value > 0) {
      hasCharges = true;
      const div = document.createElement("div");
      div.className = "charge-item";
      div.innerHTML = `<span>${c.label}</span><span>₹${c.value}/month</span>`;
      DOM.extraCharges.appendChild(div);
    }
  });
  if (!hasCharges) {
    DOM.extraCharges.innerHTML = `<div class="empty-small">No additional charges</div>`;
  }
}

// =====================================================
// RENDER NEARBY
// =====================================================

function renderNearby(nearby) {
  DOM.nearbyUnis.innerHTML = "";
  const n = nearby || [];
  if (n.length === 0) {
    DOM.nearbyUnis.innerHTML = `<div class="empty-small">No nearby universities listed</div>`;
    return;
  }
  n.forEach((item) => {
    const div = document.createElement("div");
    div.className = "university";
    const title = typeof item === "string" ? item : item.title || "";
    const distance = typeof item === "string" ? "" : item.distance || "";
    div.innerHTML = `<h3>${title}</h3>${distance ? `<p>${distance} away</p>` : ""}`;
    DOM.nearbyUnis.appendChild(div);
  });
}

// =====================================================
// RENDER MAP
// =====================================================

function renderMap(p) {
  const lat = p.latitude;
  const lng = p.longitude;
  if (lat && lng) {
    const address = encodeURIComponent(`${p.address || ""} ${p.city || ""} ${p.state || ""}`);
    DOM.mapContainer.innerHTML = `
      <iframe
        src="https://www.google.com/maps?q=${lat},${lng}&output=embed"
        width="100%" height="100%" style="border:0;border-radius:18px"
        loading="lazy" allowfullscreen title="Property location on map">
      </iframe>`;
    DOM.directionBtn.style.display = "block";
    DOM.directionBtn.onclick = () => window.open(`https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`, "_blank");
  } else {
    DOM.mapContainer.innerHTML = `<p style="color:var(--muted)"><i class="fa-solid fa-map-pin"></i> Map location not available</p>`;
  }
}

// =====================================================
// REVIEWS
// =====================================================

async function loadReviews() {
  try {
    const res = await fetch(`${API_BASE}/reviews/${propertyId}`);
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message);

    reviews = data.reviews || [];
    const avg = data.average || 0;

    DOM.avgRating.textContent = avg.toFixed(1);
    DOM.totalReviews.textContent = `${data.total || 0} Reviews`;

    // Stars
    const full = Math.floor(avg);
    const half = avg - full >= 0.5;
    let starsHtml = "";
    for (let i = 0; i < 5; i++) {
      if (i < full) starsHtml += '<i class="fa-solid fa-star"></i>';
      else if (i === full && half) starsHtml += '<i class="fa-solid fa-star-half-stroke"></i>';
      else starsHtml += '<i class="fa-regular fa-star"></i>';
    }
    DOM.starsDisplay.innerHTML = starsHtml;

    renderReviewList();
  } catch (err) {
    console.error("Reviews load error:", err);
    DOM.avgRating.textContent = "0.0";
    DOM.totalReviews.textContent = "0 Reviews";
    DOM.reviewContainer.innerHTML = `<div class="empty-small">Unable to load reviews</div>`;
  }
}

function renderReviewList() {
  DOM.reviewContainer.innerHTML = "";
  if (reviews.length === 0) {
    DOM.reviewContainer.innerHTML = `<div class="empty-small" style="padding:30px;text-align:center">
      <i class="fa-regular fa-star" style="font-size:40px;color:var(--muted);display:block;margin-bottom:12px"></i>
      No reviews yet. Be the first to review!
    </div>`;
    DOM.loadMoreReviews.style.display = "none";
    return;
  }

  const start = 0;
  const end = Math.min(start + REVIEWS_PER_PAGE, reviews.length);
  const shown = reviews.slice(start, end);

  shown.forEach((r) => {
    const div = document.createElement("div");
    div.className = "review";
    const stars = "⭐".repeat(r.rating) + "☆".repeat(5 - r.rating);
    div.innerHTML = `
      <div class="review-header">
        <div class="review-avatar">${(r.name || "S").charAt(0).toUpperCase()}</div>
        <div>
          <h4>${r.name || "Student"}</h4>
          <div class="review-stars">${stars}</div>
        </div>
        <span class="review-time">${r.createdAt ? timeAgo(r.createdAt) : ""}</span>
      </div>
      <p class="review-comment">${r.comment || ""}</p>`;
    DOM.reviewContainer.appendChild(div);
  });

  DOM.loadMoreReviews.style.display = reviews.length > REVIEWS_PER_PAGE ? "block" : "none";
}

// =====================================================
// SIMILAR PROPERTIES
// =====================================================

async function loadSimilar() {
  try {
    const res = await fetch(`${API_BASE}/properties/search?limit=4&sort=rating`);
    const data = await res.json();
    const properties = (data.properties || []).filter((p) => p._id !== propertyId).slice(0, 4);

    DOM.similarContainer.innerHTML = "";
    if (properties.length === 0) {
      DOM.similarContainer.innerHTML = `<div class="empty-small" style="grid-column:1/-1;padding:30px;text-align:center">No similar properties found</div>`;
      return;
    }

    properties.forEach((p) => {
      const img = p.images?.length ? getImageUrl(p.images[0]) : "./images/property-placeholder.jpg";
      const name = p.propertyName || p.title || "Campora Property";
      const loc = [p.city, p.state].filter(Boolean).join(", ") || "";
      const price = p.rent || p.price || 0;
      const card = document.createElement("div");
      card.className = "similar-card";
      card.innerHTML = `
        <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='./images/property-placeholder.jpg'" />
        <div class="similar-content">
          <h3>${name}</h3>
          ${loc ? `<p><i class="fa-solid fa-location-dot"></i> ${loc}</p>` : ""}
          <h4>₹${price.toLocaleString()}/month</h4>
          <button class="view-btn" data-id="${p._id}">View Property</button>
        </div>`;
      card.querySelector(".view-btn").addEventListener("click", () => {
        window.location.href = `property-details.html?id=${p._id}`;
      });
      DOM.similarContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Similar load error:", err);
  }
}

// =====================================================
// SAVE / UNSAVE
// =====================================================

async function checkSavedStatus() {
  if (!token || !user) return;
  try {
    const res = await fetch(`${API_BASE}/properties/save/${propertyId}/check`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json();
    if (data.success && data.saved) {
      isSaved = true;
      DOM.saveBtn.innerHTML = `<i class="fa-solid fa-heart"></i> <span>Saved</span>`;
      DOM.saveBtn.classList.add("saved");
    }
  } catch (err) {
    console.error("Check saved error:", err);
  }
}

// =====================================================
// SETUP EVENTS
// =====================================================

function setupEvents(p) {
  // Image navigation
  DOM.prevImage.addEventListener("click", () => {
    if (currentImages.length === 0) return;
    currentImageIndex = (currentImageIndex - 1 + currentImages.length) % currentImages.length;
    updateMainImage();
    DOM.thumbContainer.querySelectorAll(".thumbnail").forEach((t, i) => t.classList.toggle("active", i === currentImageIndex));
  });

  DOM.nextImage.addEventListener("click", () => {
    if (currentImages.length === 0) return;
    currentImageIndex = (currentImageIndex + 1) % currentImages.length;
    updateMainImage();
    DOM.thumbContainer.querySelectorAll(".thumbnail").forEach((t, i) => t.classList.toggle("active", i === currentImageIndex));
  });

  // Keyboard navigation for images
  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowLeft") DOM.prevImage.click();
    if (e.key === "ArrowRight") DOM.nextImage.click();
  });

  // Save button
  DOM.saveBtn.addEventListener("click", handleSave);

  // Book now
  DOM.bookBtn.addEventListener("click", () => {
    if (!token || !user) {
      showToast("Please login to book", "info");
      window.location.href = "login.html";
      return;
    }
    openBookingModal();
  });

  // Booking modal
  DOM.closeModal.addEventListener("click", closeBookingModal);
  DOM.cancelBooking.addEventListener("click", closeBookingModal);
  DOM.bookingModal.addEventListener("click", (e) => {
    if (e.target === DOM.bookingModal) closeBookingModal();
  });
  DOM.bookingForm.addEventListener("submit", submitBooking);

  // Contact owner
  DOM.contactOwner.addEventListener("click", () => {
    const email = p.owner?.email;
    if (email) {
      window.location.href = `mailto:${email}?subject=Inquiry about ${p.propertyName || "property"}`;
    } else {
      showToast("Owner email not available", "error");
    }
  });

  // Chat
  DOM.chatOwner.addEventListener("click", () => {
    if (!token || !user) {
      showToast("Please login to send messages", "info");
      window.location.href = "login.html";
      return;
    }
    window.location.href = `messages.html?owner=${p.owner?._id || ""}&property=${propertyId}`;
  });

  // Review form
  setupRatingStars();
  DOM.reviewForm.addEventListener("submit", submitReview);

  // Share
  document.querySelectorAll(".share-btn").forEach((btn) => {
    btn.addEventListener("click", () => handleShare(btn.dataset.platform));
  });
}

// =====================================================
// SAVE HANDLER
// =====================================================

async function handleSave() {
  if (!token || !user) {
    showToast("Please login to save properties", "info");
    window.location.href = "login.html";
    return;
  }

  try {
    if (isSaved) {
      const res = await fetch(`${API_BASE}/properties/save/${propertyId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        isSaved = false;
        DOM.saveBtn.innerHTML = `<i class="fa-regular fa-heart"></i> <span>Save</span>`;
        DOM.saveBtn.classList.remove("saved");
        showToast("Removed from saved", "info");
      }
    } else {
      const res = await fetch(`${API_BASE}/properties/save/${propertyId}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        isSaved = true;
        DOM.saveBtn.innerHTML = `<i class="fa-solid fa-heart"></i> <span>Saved</span>`;
        DOM.saveBtn.classList.add("saved");
        showToast("Property saved!", "success");
      }
    }
  } catch (err) {
    console.error("Save error:", err);
    showToast("Failed to save property", "error");
  }
}

// =====================================================
// BOOKING MODAL
// =====================================================

function openBookingModal() {
  DOM.bookingModal.hidden = false;
  document.body.style.overflow = "hidden";

  // Set min date to today
  const today = new Date().toISOString().split("T")[0];
  DOM.moveInDate.min = today;
  DOM.moveInDate.value = today;
}

function closeBookingModal() {
  DOM.bookingModal.hidden = true;
  document.body.style.overflow = "";
}

async function submitBooking(e) {
  e.preventDefault();
  if (!token || !user) {
    showToast("Please login to book", "error");
    return;
  }

  const moveInDate = DOM.moveInDate.value;
  const duration = DOM.duration.value;
  const specialRequest = DOM.specialRequest.value.trim();

  if (!moveInDate) {
    showToast("Please select a move-in date", "error");
    return;
  }

  DOM.confirmBookingBtn.disabled = true;
  DOM.confirmBookingBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Booking...';

  try {
    // Check for duplicate booking
    const checkRes = await fetch(`${API_BASE}/bookings/check?propertyId=${propertyId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const checkData = await checkRes.json();
    if (checkData.exists) {
      showToast("You already have a booking for this property", "info");
      DOM.confirmBookingBtn.disabled = false;
      DOM.confirmBookingBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Booking';
      closeBookingModal();
      return;
    }

    const res = await fetch(`${API_BASE}/bookings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        propertyId,
        moveInDate,
        duration,
        specialRequest,
      }),
    });

    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Booking failed");

    showToast("Booking created successfully!", "success");
    closeBookingModal();
    setTimeout(() => {
      window.location.href = `bookings.html`;
    }, 1500);
  } catch (err) {
    console.error("Booking error:", err);
    showToast(err.message || "Booking failed. Please try again.", "error");
  } finally {
    DOM.confirmBookingBtn.disabled = false;
    DOM.confirmBookingBtn.innerHTML = '<i class="fa-solid fa-check"></i> Confirm Booking';
  }
}

// =====================================================
// RATING STARS
// =====================================================

function setupRatingStars() {
  const stars = DOM.ratingStars.querySelectorAll(".star-btn");
  stars.forEach((btn) => {
    btn.addEventListener("click", () => {
      const val = parseInt(btn.dataset.value);
      DOM.reviewRating.value = val;
      stars.forEach((s, i) => {
        const icon = s.querySelector("i");
        if (i < val) {
          icon.className = "fa-solid fa-star";
          icon.style.color = "#facc15";
        } else {
          icon.className = "fa-regular fa-star";
          icon.style.color = "";
        }
      });
    });
  });
}

// =====================================================
// SUBMIT REVIEW
// =====================================================

async function submitReview(e) {
  e.preventDefault();
  if (!token || !user) {
    showToast("Please login to submit a review", "info");
    window.location.href = "login.html";
    return;
  }

  const rating = DOM.reviewRating.value;
  const comment = DOM.reviewComment.value.trim();

  if (!comment) {
    showToast("Please write a review comment", "error");
    return;
  }
  if (comment.length < 10) {
    showToast("Review must be at least 10 characters", "error");
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/reviews`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ property: propertyId, userName: user.name, rating: parseInt(rating), comment }),
    });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || "Failed to submit review");

    showToast("Review submitted! Thank you.", "success");
    DOM.reviewComment.value = "";
    DOM.reviewRating.value = "5";
    setupRatingStars();
    await loadReviews();
  } catch (err) {
    console.error("Review submit error:", err);
    showToast(err.message || "Failed to submit review", "error");
  }
}

// =====================================================
// SHARE
// =====================================================

function handleShare(platform) {
  const url = window.location.href;
  const text = `Check out this property on Campora!`;

  switch (platform) {
    case "copy":
      navigator.clipboard.writeText(url).then(() => showToast("Link copied!", "success")).catch(() => showToast("Failed to copy link", "error"));
      break;
    case "whatsapp":
      window.open(`https://wa.me/?text=${encodeURIComponent(text + " " + url)}`, "_blank");
      break;
    case "facebook":
      window.open(`https://facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, "_blank");
      break;
    case "twitter":
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, "_blank");
      break;
  }
}

// =====================================================
// UI HELPERS
// =====================================================

function showLoading() {
  DOM.loading.style.display = "block";
  DOM.error.style.display = "none";
  DOM.content.style.display = "none";
}

function hideLoading() {
  DOM.loading.style.display = "none";
}

function showError(msg) {
  DOM.loading.style.display = "none";
  DOM.error.style.display = "block";
  DOM.errorMsg.textContent = msg || "Something went wrong.";
  DOM.content.style.display = "none";
}

function timeAgo(dateInput) {
  const now = new Date();
  const date = new Date(dateInput);
  const diffMs = now - date;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

// =====================================================
// EXPOSE TOAST
// =====================================================

window.showToast = showToast;

console.log("✅ Campora Property Details Page Loaded");

