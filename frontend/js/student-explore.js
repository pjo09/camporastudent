// =====================================================
// CAMPORA STUDENT V3 - EXPLORE
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, inr, esc } from "./student-utils.js";
import { getToken, getLoginUrl } from "./session.js";

const state = {
  page: 1,
  filter: "all",
  sort: "latest",
  search: "",
  totalPages: 1,
  searchTimeout: null,
  city: "",
  college: "",
  maxRent: "",
  sharing: "",
  amenities: [],
  available: false,
};

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  parseUrlParams();
  setupEvents();
  loadProperties();
});

function parseUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  state.city = urlParams.get("city") || "";
  state.college = urlParams.get("college") || "";
  state.maxRent = urlParams.get("maxRent") || "";
  state.sharing = urlParams.get("sharing") || "";
  state.filter = urlParams.get("propertyType") || "all";

  // Pre-populate search input value
  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.value = state.college || state.city || "";
  }

  // Pre-select active filter button
  if (state.filter !== "all") {
    document.querySelectorAll(".sv3-filter-btn").forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.filter === state.filter);
    });
  }
}

function setupEvents() {
  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => {
        const val = searchInput.value.trim();
        state.search = val;
        // Reset specific city/college searches from homepage
        state.city = "";
        state.college = val;
        state.page = 1;
        loadProperties();
      }, 400);
    });
  }

  const sortSelect = $("sortSelect");
  if (sortSelect) {
    sortSelect.addEventListener("change", () => {
      state.sort = sortSelect.value;
      state.page = 1;
      loadProperties();
    });
  }

  // Mobile sort change selector
  const mobileSortSelect = $("mobileSortSelect");
  if (mobileSortSelect) {
    mobileSortSelect.addEventListener("change", () => {
      state.sort = mobileSortSelect.value;
      state.page = 1;
      loadProperties();
    });
  }

  document.querySelectorAll(".sv3-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      state.page = 1;
      document.querySelectorAll(".sv3-filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
      loadProperties();
    });
  });

  // Mobile bottom sheet filters toggles
  const mobileFilterBtn = $("mobileFilterBtn");
  const filterSheet = $("mobileFilterSheet");
  const filterBackdrop = $("mobileFilterBackdrop");
  const closeFilterBtn = $("closeFilterSheetBtn");

  const openFilters = () => {
    if (!filterSheet) return;
    filterSheet.classList.add("active");
    if (filterBackdrop) filterBackdrop.classList.add("active");
    document.body.style.overflow = "hidden"; // lock body scroll

    // Sync input fields with current state values
    if ($("mobileCityInput")) $("mobileCityInput").value = state.city;
    if ($("mobileCollegeInput")) $("mobileCollegeInput").value = state.college;
    if ($("mobileBudgetSelect")) $("mobileBudgetSelect").value = state.maxRent;
    if ($("mobileSharingSelect")) $("mobileSharingSelect").value = state.sharing;
    if ($("mobileAvailableOnly")) $("mobileAvailableOnly").checked = state.available;

    // Set active property type chips
    document.querySelectorAll(".property-type-chips .type-chip").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.type === state.filter);
    });

    // Check matching amenities checkboxes
    document.querySelectorAll("#mobileAmenitiesList input[type=checkbox]").forEach((cb) => {
      cb.checked = state.amenities.includes(cb.value);
    });
  };

  const closeFilters = () => {
    if (!filterSheet) return;
    filterSheet.classList.remove("active");
    if (filterBackdrop) filterBackdrop.classList.remove("active");
    document.body.style.overflow = ""; // unlock scroll
  };

  if (mobileFilterBtn) mobileFilterBtn.addEventListener("click", openFilters);
  if (closeFilterBtn) closeFilterBtn.addEventListener("click", closeFilters);
  if (filterBackdrop) filterBackdrop.addEventListener("click", closeFilters);

  // Close sheet on escape
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && filterSheet && filterSheet.classList.contains("active")) {
      closeFilters();
    }
  });

  // Property Type chips toggle
  document.querySelectorAll(".property-type-chips .type-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      const active = chip.classList.contains("active");
      document.querySelectorAll(".property-type-chips .type-chip").forEach((c) => c.classList.remove("active"));
      if (!active) {
        chip.classList.add("active");
      }
    });
  });

  // Reset Filters
  const resetBtn = $("resetFilterBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      state.city = "";
      state.college = "";
      state.maxRent = "";
      state.sharing = "";
      state.filter = "all";
      state.amenities = [];
      state.available = false;

      // Reset DOM elements
      if ($("mobileCityInput")) $("mobileCityInput").value = "";
      if ($("mobileCollegeInput")) $("mobileCollegeInput").value = "";
      if ($("mobileBudgetSelect")) $("mobileBudgetSelect").value = "";
      if ($("mobileSharingSelect")) $("mobileSharingSelect").value = "";
      if ($("mobileAvailableOnly")) $("mobileAvailableOnly").checked = false;
      document.querySelectorAll(".property-type-chips .type-chip").forEach((c) => c.classList.remove("active"));
      document.querySelectorAll("#mobileAmenitiesList input[type=checkbox]").forEach((cb) => cb.checked = false);

      updateFilterCount(0);
      closeFilters();
      state.page = 1;
      loadProperties();
    });
  }

  // Apply Filters
  const applyBtn = $("applyFilterBtn");
  if (applyBtn) {
    applyBtn.addEventListener("click", () => {
      state.city = $("mobileCityInput") ? $("mobileCityInput").value.trim() : "";
      state.college = $("mobileCollegeInput") ? $("mobileCollegeInput").value.trim() : "";
      state.maxRent = $("mobileBudgetSelect") ? $("mobileBudgetSelect").value : "";
      state.sharing = $("mobileSharingSelect") ? $("mobileSharingSelect").value : "";

      const activeChip = document.querySelector(".property-type-chips .type-chip.active");
      state.filter = activeChip ? activeChip.dataset.type : "all";

      // Read checkboxes
      const selectedAmenities = [];
      document.querySelectorAll("#mobileAmenitiesList input[type=checkbox]:checked").forEach((cb) => {
        selectedAmenities.push(cb.value);
      });
      state.amenities = selectedAmenities;

      // Available parameter
      state.available = $("mobileAvailableOnly") ? $("mobileAvailableOnly").checked : false;

      // Calculate total count
      let count = 0;
      if (state.city) count++;
      if (state.college) count++;
      if (state.maxRent) count++;
      if (state.sharing) count++;
      if (state.filter !== "all") count++;
      if (state.amenities.length > 0) count += state.amenities.length;
      if (state.available) count++;
      updateFilterCount(count);

      closeFilters();
      state.page = 1;
      loadProperties();
    });
  }

  const prev = $("prevPage");
  const next = $("nextPage");
  if (prev) prev.addEventListener("click", () => { if (state.page > 1) { state.page--; loadProperties(); } });
  if (next) next.addEventListener("click", () => { if (state.page < state.totalPages) { state.page++; loadProperties(); } });
}

function updateFilterCount(count) {
  const badge = $("mobileFilterCount");
  if (badge) {
    if (count > 0) {
      badge.textContent = count;
      badge.style.display = "inline-block";
    } else {
      badge.style.display = "none";
    }
  }
}

async function loadProperties() {
  const grid = $("propertyGrid");
  if (!grid) return;

  grid.innerHTML = Array(3).fill(`
    <div class="sv3-skeleton"><div class="sv3-skeleton-img"></div><div class="sv3-skeleton-line"></div><div class="sv3-skeleton-line short"></div></div>
  `).join("");

  try {
    const q = new URLSearchParams();
    if (state.filter !== "all") q.set("propertyType", state.filter);
    q.set("sort", state.sort);
    q.set("page", state.page);
    q.set("limit", "9");
    if (state.city) q.set("city", state.city);
    if (state.college) q.set("college", state.college);
    if (state.maxRent) q.set("maxRent", state.maxRent);
    if (state.sharing) q.set("sharing", state.sharing);
    if (state.search && !state.college) q.set("college", state.search);

    // Apply amenities
    if (state.amenities && state.amenities.length > 0) {
      q.set("amenities", state.amenities.join(","));
    }

    // Apply available
    if (state.available) {
      q.set("available", "true");
    }

    // Load saved property ids if authenticated
    let savedIds = new Set();
    if (getToken()) {
      // Auto trigger pending save if returning from login page
      const pendingSaveId = localStorage.getItem("pendingSavePropertyId");
      if (pendingSaveId) {
        localStorage.removeItem("pendingSavePropertyId");
        await apiFetch(`/student/saved/${pendingSaveId}`, { method: "POST" }).catch(() => null);
      }

      const savedData = await apiFetch("/student/saved").catch(() => null);
      if (savedData && savedData.properties) {
        savedIds = new Set(savedData.properties.map(sp => sp._id));
      }
    }

    const data = await apiFetch(`/properties/search?${q.toString()}`);
    const properties = data.properties || [];
    state.totalPages = data.totalPages || 1;

    if (properties.length === 0) {
      grid.innerHTML = `<div class="sv3-empty" style="grid-column:1/-1"><i class="fa-solid fa-house-circle-xmark"></i><h3>No properties found</h3><p>Try adjusting your filters or search.</p></div>`;
      $("pagination").style.display = "none";
      return;
    }

    // Map active saved state
    properties.forEach(p => {
      p.isSaved = savedIds.has(p._id);
    });

    renderProperties(properties);

    const pagination = $("pagination");
    pagination.style.display = "flex";
    pagination.style.justifyContent = "center";
    pagination.style.alignItems = "center";
    pagination.style.gap = "16px";
    $("pageInfo").textContent = `Page ${state.page} of ${state.totalPages}`;
    $("prevPage").disabled = state.page <= 1;
    $("nextPage").disabled = state.page >= state.totalPages;
  } catch (err) {
    grid.innerHTML = `<div class="sv3-error" style="grid-column:1/-1"><i class="fa-solid fa-triangle-exclamation"></i><h3>Failed to load properties</h3><p>${esc(err.message)}</p></div>`;
  }
}

function renderProperties(properties) {
  const grid = $("propertyGrid");
  grid.innerHTML = properties.map((p) => {
    const name = p.propertyName || p.title || "Campora Property";
    const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
    const rent = p.rent || p.price || 0;
    const rating = p.averageRating || 0;

    // Image gallery swiper
    let imgAreaHtml = '';
    if (p.images && p.images.length > 1) {
      const slidesHtml = p.images.map((imgUrl, i) => `
        <img src="${imageUrl(imgUrl)}" alt="${esc(name)} - Image ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" onerror="this.onerror=null; this.src='/assets/logos/logo.png'">
      `).join("");
      imgAreaHtml = `
        <div class="property-image-slider">
          <div class="property-image-slides">
            ${slidesHtml}
          </div>
          <span class="image-indicator">1/${p.images.length}</span>
        </div>
      `;
    } else {
      const singleImg = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/logos/logo.png";
      imgAreaHtml = `<img src="${singleImg}" alt="${esc(name)}" loading="lazy" onerror="this.onerror=null; this.src='/assets/logos/logo.png'">`;
    }

    // Verified badge
    const badgeHtml = p.verified 
      ? `<span class="sv3-property-badge verified" style="background:#22c55e"><i class="fa-solid fa-circle-check"></i> Verified</span>` 
      : ``;

    // Distance if real backend data exists
    const distanceHtml = p.nearby && p.nearby.length
      ? `<div style="font-size:12.5px;color:var(--sv3-muted);margin:4px 0"><i class="fa-solid fa-person-walking"></i> ${esc(p.nearby[0].distance)} from ${esc(p.nearby[0].title || p.college || "campus")}</div>`
      : '';

    // Amenities (up to 3)
    const amenitiesList = Array.isArray(p.amenities) ? p.amenities : [];
    const amenitiesHtml = amenitiesList.length
      ? `<div style="display:flex;gap:6px;flex-wrap:wrap;margin:8px 0">${amenitiesList.slice(0, 3).map(a => `<span class="sv3-pill sv3-pill-neutral" style="font-size:11px;padding:3px 8px">${esc(a)}</span>`).join("")}</div>`
      : '';

    // Availability
    const availabilityHtml = p.availableBeds > 0
      ? `<div style="font-size:12px;color:#4ade80;font-weight:600;margin-top:4px"><i class="fa-solid fa-bed"></i> ${p.availableBeds} beds available</div>`
      : '';

    return `
<div class="sv3-property-card" onclick="window.location.href='/pages/property/property.html?id=${p._id}'" role="article" aria-label="${esc(name)}" style="cursor:pointer">
        <div class="sv3-property-image loading">
          ${imgAreaHtml}
          ${badgeHtml}
          <button class="sv3-save-btn" onclick="event.stopPropagation();window.toggleSave('${p._id}', this)" aria-label="Save ${esc(name)}"><i class="fa-${p.isSaved ? "solid" : "regular"} fa-heart" style="${p.isSaved ? 'color:#ef4444' : ''}"></i></button>
        </div>
        <div class="sv3-property-body">
          <div class="sv3-property-title">${esc(name)}</div>
          <div class="sv3-property-loc"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</div>
          ${distanceHtml}
          ${amenitiesHtml}
          ${availabilityHtml}
          <div class="sv3-property-price" style="margin-top:8px">${inr(rent)}<span>/month</span></div>
          <div class="sv3-property-footer">
            <span class="sv3-rating">${rating > 0 ? '<i class="fa-solid fa-star"></i> ' + rating.toFixed(1) : "New"}</span>
            <button class="sv3-btn sv3-btn-primary" style="padding:8px 16px;font-size:13px" onclick="event.stopPropagation();window.location.href='/pages/property/property.html?id=${p._id}'">View</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

window.toggleSave = async function (propertyId, btn) {
  if (!getToken()) {
    localStorage.setItem("pendingSavePropertyId", propertyId);
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `${getLoginUrl()}?redirectTo=${encodeURIComponent(currentUrl)}`;
    return;
  }
  try {
    const icon = btn.querySelector("i");
    const isSaved = icon.classList.contains("fa-solid");
    if (isSaved) {
      await apiFetch(`/student/saved/${propertyId}`, { method: "DELETE" });
      icon.className = "fa-regular fa-heart";
      icon.style.color = "";
    } else {
      await apiFetch(`/student/saved/${propertyId}`, { method: "POST" });
      icon.className = "fa-solid fa-heart";
      icon.style.color = "#ef4444";
    }
  } catch (err) {
    // silent
  }
};
