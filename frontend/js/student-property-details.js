// =====================================================
// CAMPORA STUDENT V3 - PROPERTY DETAILS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, inr, esc, timeAgo } from "./student-utils.js";
import { getPropertiesUrl, getToken, getUser, isLoggedIn, getLoginUrl } from "./session.js";

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
loading.innerHTML = `<i class="fa-solid fa-triangle-exclamation" style="font-size:40px;color:#f87171"></i><p style="margin-top:12px;color:var(--sv3-muted)">${esc(msg)}</p><a href="${getPropertiesUrl()}" class="sv3-btn sv3-btn-primary" style="margin-top:16px">Back to Explore</a>`;
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

  // Join PG events
  const joinPgBtn = $("joinPgBtn");
  if (joinPgBtn) {
    joinPgBtn.addEventListener("click", () => {
      import("./session.js").then(({ isLoggedIn }) => {
        if (!isLoggedIn()) {
          const currentUrl = window.location.pathname + window.location.search + "&joinPg=true";
          window.location.href = `/login.html?redirectTo=${encodeURIComponent(currentUrl)}`;
        } else {
          openJoinPgFlow();
        }
      });
    });
  }

  $("closeJoinPgModal")?.addEventListener("click", () => {
    $("joinPgModal").style.display = "none";
  });
  $("cancelJoinPg")?.addEventListener("click", () => {
    $("joinPgModal").style.display = "none";
  });
  $("joinPgModal")?.addEventListener("click", (e) => {
    if (e.target === $("joinPgModal")) {
      $("joinPgModal").style.display = "none";
    }
  });

  $("joinPgForm")?.addEventListener("submit", handleJoinSubmit);
}

async function loadProperty() {
  try {
    // Auto restore save if returning from login page
    const pendingSaveId = localStorage.getItem("pendingSavePropertyId");
    if (pendingSaveId && getToken() && pendingSaveId === propertyId) {
      localStorage.removeItem("pendingSavePropertyId");
      await apiFetch(`/properties/save/${propertyId}`, { method: "POST" }).catch(() => null);
    }

    const data = await apiFetch(`/properties/${propertyId}`);
    renderProperty(data.property, data.currentResidentsCount, data.verifiedStaysCount);
    loadReviews();

    // Auto-trigger Join PG flow if returning from login
    if (params.get("joinPg") === "true") {
      setTimeout(openJoinPgFlow, 800);
    }
  } catch (err) {
    showError(err.message || "Unable to load property");
  }
}

function renderProperty(p, currentResidentsCount, verifiedStaysCount) {
  const loading = $("loading");
  const details = $("propertyDetails");
  if (loading) loading.style.display = "none";
  if (details) details.style.display = "block";

  const name = p.propertyName || p.title || "Campora Property";
  const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
  const rent = p.rent || p.price || 0;
  const rating = p.averageRating || 0;
  const img = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/logos/logo.png";

  // Dynamic SEO title & canonical link
  document.title = `Campora • ${name} in ${p.city || ''}`;
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = `${window.location.origin}/pages/property/property.html?id=${p._id}`;

  if ($("propertyName")) $("propertyName").textContent = name;
  if ($("propertyLocation")) $("propertyLocation").textContent = loc;
  if ($("propertyPrice")) $("propertyPrice").textContent = `${inr(rent)}/month`;
  if ($("propertyRating")) $("propertyRating").innerHTML = rating > 0 ? `<i class="fa-solid fa-star"></i> ${rating.toFixed(1)} ${p.totalReviews ? `(${p.totalReviews})` : ""}` : "New listing";
  if ($("propertyDescription")) $("propertyDescription").textContent = p.description || "No description available.";

  // Image Gallery Swiper (If multiple images are returned, replace single img element with swiper)
  const imgEl = $("propertyImage");
  if (imgEl) {
    const imgContainer = imgEl.parentElement;
    if (imgContainer) {
      if (p.images && p.images.length > 1) {
        imgContainer.innerHTML = `
          <div class="details-slides" style="display:flex;overflow-x:auto;scroll-snap-type:x mandatory;height:100%;width:100%;scrollbar-width:none;-webkit-overflow-scrolling:touch">
            ${p.images.map((imgUrl, i) => `
              <img src="${imageUrl(imgUrl)}" alt="${esc(name)} - Image ${i + 1}" style="flex:0 0 100%;width:100%;height:100%;object-fit:cover;scroll-snap-align:start" onerror="this.src='/assets/logos/logo.png'">
            `).join("")}
          </div>
          <span class="details-image-indicator" style="position:absolute;bottom:16px;right:16px;background:rgba(11,31,58,0.75);color:#fff;padding:4px 8px;border-radius:4px;font-size:12px;font-weight:600;z-index:2;pointer-events:none">1/${p.images.length}</span>
          <button class="sv3-save-btn" id="saveBtn" style="width:44px;height:44px;top:16px;right:16px;z-index:10"><i class="fa-regular fa-heart"></i></button>
        `;
        // Scroll event updates slide indicator
        const slides = imgContainer.querySelector('.details-slides');
        const indicator = imgContainer.querySelector('.details-image-indicator');
        slides.addEventListener('scroll', () => {
          const index = Math.round(slides.scrollLeft / slides.clientWidth) + 1;
          indicator.textContent = `${index}/${p.images.length}`;
        }, { passive: true });
        
        // Re-bind save button event
        const newSaveBtn = imgContainer.querySelector("#saveBtn");
        if (newSaveBtn) newSaveBtn.addEventListener("click", toggleSave);
      } else {
        imgContainer.innerHTML = `
          <img id="propertyImage" src="${img}" alt="${esc(name)}" style="width:100%;height:100%;object-fit:cover" onerror="this.src='/assets/logos/logo.png'">
          <button class="sv3-save-btn" id="saveBtn" style="width:44px;height:44px;top:16px;right:16px;z-index:10"><i class="fa-regular fa-heart"></i></button>
        `;
        const newSaveBtn = imgContainer.querySelector("#saveBtn");
        if (newSaveBtn) newSaveBtn.addEventListener("click", toggleSave);
      }
    }
  }

  // Trust/Verification elements
  const verifiedProp = $("verifiedPropertyBadge");
  const verifiedOwner = $("verifiedOwnerBadge");
  const currentResWrap = $("currentResidentsCountWrap");
  const verifiedStaysWrap = $("verifiedStaysCountWrap");
  const currentResCount = $("currentResidentsCount");
  const verifiedStaysCountEl = $("verifiedStaysCount");

  if (verifiedProp) verifiedProp.style.display = p.verified ? "flex" : "none";
  if (verifiedOwner) verifiedOwner.style.display = (p.owner && p.owner.verified) ? "flex" : "none";
  
  if (currentResWrap) {
    currentResWrap.style.display = "flex";
    if (currentResCount) currentResCount.textContent = currentResidentsCount || 0;
  }
  if (verifiedStaysWrap) {
    verifiedStaysWrap.style.display = "flex";
    if (verifiedStaysCountEl) verifiedStaysCountEl.textContent = verifiedStaysCount || 0;
  }

  // CTA visibility
  const joinCta = $("joinPgCta");
  if (joinCta) {
    const user = getUser();
    if (!isLoggedIn() || (user && user.role === "student")) {
      joinCta.style.display = "block";
    } else {
      joinCta.style.display = "none";
    }
  }

  // Chips & Availability Status
  const chips = $("propertyChips");
  if (chips) {
    const parts = [];
    if (p.propertyType) parts.push(`<span class="sv3-pill sv3-pill-info">${esc(p.propertyType)}</span>`);
    if (p.sharing) parts.push(`<span class="sv3-pill sv3-pill-neutral">${esc(p.sharing)}</span>`);
    if (p.gender) parts.push(`<span class="sv3-pill sv3-pill-purple" style="background:rgba(124,58,237,.15);color:#a78bfa">${esc(p.gender)}</span>`);
    if (p.deposit) parts.push(`<span class="sv3-pill sv3-pill-warning">Deposit ${inr(p.deposit)}</span>`);
    if (p.availableBeds !== undefined && p.availableBeds > 0) {
      parts.push(`<span class="sv3-pill sv3-pill-success" style="background:rgba(34,197,94,.15);color:#4ade80"><i class="fa-solid fa-bed"></i> ${p.availableBeds} beds left</span>`);
    }
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

  // Nearby distance locations list
  const nearbySection = $("nearbySection");
  const nearbyList = $("nearbyList");
  if (nearbySection && nearbyList) {
    if (p.nearby && p.nearby.length > 0) {
      nearbySection.style.display = "block";
      nearbyList.innerHTML = p.nearby.map((n) => `
        <div class="sv3-card" style="padding:16px;display:flex;align-items:center;gap:12px;background:rgba(255,255,255,0.02);border:1px solid var(--sv3-border)">
          <i class="fa-solid fa-person-walking" style="color:#3b82f6;font-size:18px"></i>
          <div>
            <strong style="display:block;font-size:14px;color:#fff">${esc(n.title)}</strong>
            <span style="font-size:12px;color:var(--sv3-muted)">${esc(n.distance)}</span>
          </div>
        </div>
      `).join("");
    } else {
      nearbySection.style.display = "none";
    }
  }

  // Owner details (Mask contact details if unauthenticated)
  const ownerSection = $("ownerSection");
  if (ownerSection && p.owner) {
    ownerSection.style.display = "block";
    if ($("ownerName")) $("ownerName").textContent = p.owner.name || "Campora Host";
    if ($("ownerInitials")) $("ownerInitials").textContent = (p.owner.name || "O").charAt(0).toUpperCase();

    const ownerContact = $("ownerContact");
    if (ownerContact) {
      if (isLoggedIn()) {
        ownerContact.innerHTML = `<i class="fa-solid fa-phone" style="color:#22c55e;margin-right:4px"></i> ${esc(p.owner.phone || "Not available")} &nbsp;&bull;&nbsp; <i class="fa-solid fa-envelope" style="color:#3b82f6;margin-right:4px"></i> ${esc(p.owner.email || "")}`;
      } else {
        const redirectUrl = window.location.pathname + window.location.search;
        ownerContact.innerHTML = `<a href="${getLoginUrl()}?redirectTo=${encodeURIComponent(redirectUrl)}" style="color:#60a5fa;text-decoration:underline"><i class="fa-solid fa-lock" style="margin-right:4px"></i> Login to view contact</a>`;
      }
    }
  }

  // Map coordinates OSM iframe integration (no keys needed)
  const mapSection = $("mapSection");
  const mapIframe = $("mapIframe");
  if (mapSection && mapIframe) {
    const lat = Number(p.latitude);
    const lon = Number(p.longitude);
    if (lat && lon && !isNaN(lat) && !isNaN(lon)) {
      mapSection.style.display = "block";
      const delta = 0.003;
      const bbox = `${lon - delta}%2C${lat - delta}%2C${lon + delta}%2C${lat + delta}`;
      mapIframe.src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lon}`;
    } else {
      mapSection.style.display = "none";
    }
  }

  // Check saved state
  checkSaved();
}

// =====================================================
// JOIN PG MODAL FLOW
// =====================================================
function openJoinPgFlow() {
  const modal = $("joinPgModal");
  if (!modal) return;

  import("./session.js").then(({ getUser }) => {
    const user = getUser();
    if (user) {
      if ($("joinName")) $("joinName").value = user.name || "";
      if ($("joinPhone")) $("joinPhone").value = user.phone || "";
      if ($("joinEmail")) $("joinEmail").value = user.email || "";
    }
  });

  modal.style.display = "flex";
}

async function uploadDocument(file) {
  const token = localStorage.getItem("camporaToken") || sessionStorage.getItem("camporaToken");
  const formData = new FormData();
  formData.append("images", file);

  const res = await fetch(`${window.__API || '/api'}/upload`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${token}`
    },
    body: formData
  });

  const data = await res.json();
  if (!res.ok || !data.success) {
    throw new Error(data.message || "Failed to upload document.");
  }
  return data.images && data.images[0] ? data.images[0].url : "";
}

async function handleJoinSubmit(e) {
  e.preventDefault();
  const submitBtn = $("submitJoinPg");
  const originalText = submitBtn.innerHTML;
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Submitting...';

  try {
    const name = $("joinName").value.trim();
    const phone = $("joinPhone").value.trim();
    const room = $("joinRoom").value.trim();
    const bed = $("joinBed").value.trim();
    const moveInDate = $("joinMoveInDate").value;
    const expectedMoveOutDate = $("joinMoveOutDate").value;
    const residenceSource = $("joinSource").value;
    const message = $("joinMessage").value.trim();
    const proofFile = $("joinProofFile").files[0];

    if (expectedMoveOutDate && new Date(expectedMoveOutDate) <= new Date(moveInDate)) {
      throw new Error("Expected move-out date must be after the move-in date.");
    }

    let proofUrl = "";
    if (proofFile) {
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Uploading document...';
      proofUrl = await uploadDocument(proofFile);
    }

    submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Sending request...';
    await apiFetch("/residents/requests", {
      method: "POST",
      body: JSON.stringify({
        property: propertyId,
        room,
        bed,
        moveInDate,
        expectedMoveOutDate: expectedMoveOutDate || undefined,
        residenceSource,
        proofDocument: proofUrl,
        message
      })
    });

    // Update profile in background if details modified
    try {
      await apiFetch("/student/profile", {
        method: "PUT",
        body: JSON.stringify({ name, phone })
      });
      import("./session.js").then(({ getUser, login, getToken }) => {
        const user = getUser();
        if (user) {
          user.name = name;
          user.phone = phone;
          login(getToken(), user);
        }
      });
    } catch (profileErr) {
      console.warn("Failed to update profile", profileErr);
    }

    alert("Resident Request Submitted!\n\nStatus: PENDING OWNER VERIFICATION\n\nThe property owner needs to confirm that you currently stay here.");
    $("joinPgModal").style.display = "none";
    window.location.href = "/pages/student/dashboard.html";

  } catch (err) {
    alert(err.message || "Failed to submit request.");
  } finally {
    submitBtn.disabled = false;
    submitBtn.innerHTML = originalText;
  }
}

async function checkSaved() {
  if (!getToken()) return;
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
  if (!getToken()) {
    localStorage.setItem("pendingSavePropertyId", propertyId);
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `${getLoginUrl()}?redirectTo=${encodeURIComponent(currentUrl)}`;
    return;
  }
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
