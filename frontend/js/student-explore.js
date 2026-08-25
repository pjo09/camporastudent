// =====================================================
// CAMPORA STUDENT V3 - EXPLORE
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, inr, esc } from "./student-utils.js";

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

  document.querySelectorAll(".sv3-filter-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      state.filter = btn.dataset.filter;
      state.page = 1;
      document.querySelectorAll(".sv3-filter-btn").forEach((b) => b.classList.toggle("active", b === btn));
      loadProperties();
    });
  });

  const prev = $("prevPage");
  const next = $("nextPage");
  if (prev) prev.addEventListener("click", () => { if (state.page > 1) { state.page--; loadProperties(); } });
  if (next) next.addEventListener("click", () => { if (state.page < state.totalPages) { state.page++; loadProperties(); } });
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

    const data = await apiFetch(`/properties/search?${q.toString()}`);
    const properties = data.properties || [];
    state.totalPages = data.totalPages || 1;

    if (properties.length === 0) {
      grid.innerHTML = `
        <div class="sv3-empty" style="grid-column:1/-1;text-align:center;padding:48px 24px;background:var(--sv3-surface,#1e293b);border-radius:16px;border:1px solid rgba(255,255,255,0.08);margin:20px 0">
          <div style="font-size:48px;color:var(--sv3-primary,#3b82f6);margin-bottom:16px"><i class="fa-solid fa-house-circle-xmark"></i></div>
          <h3 style="font-size:20px;font-weight:700;margin-bottom:8px">No Available Properties Found</h3>
          <p style="color:var(--sv3-muted,#94a3b8);max-width:460px;margin:0 auto 24px;line-height:1.5">We couldn't find any published properties matching your current criteria. Try adjusting your search term or clearing your filters.</p>
          <div style="display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
            <button class="sv3-btn sv3-btn-primary" id="resetFiltersBtn" type="button" style="cursor:pointer"><i class="fa-solid fa-rotate-left"></i> Reset Filters</button>
          </div>
        </div>`;
      $("pagination").style.display = "none";
      const resetBtn = document.getElementById("resetFiltersBtn");
      if (resetBtn) {
        resetBtn.addEventListener("click", () => {
          state.search = "";
          state.city = "";
          state.college = "";
          state.maxRent = "";
          state.sharing = "";
          state.filter = "all";
          state.page = 1;
          const searchInput = $("searchInput");
          if (searchInput) searchInput.value = "";
          document.querySelectorAll(".sv3-filter-btn").forEach((b) => b.classList.toggle("active", b.dataset.filter === "all"));
          loadProperties();
        });
      }
      return;
    }

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
    const propId = p.id || p._id;
    const name = p.propertyName || p.title || "Campora Property";
    const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
    const rent = p.rent || p.price || 0;
    const rating = p.averageRating || 0;
    const img = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/logos/logo.png";
    const badge = p.verified ? "Verified" : p.featured ? "Featured" : "";
    const detailUrl = `/property-details.html?id=${encodeURIComponent(propId)}`;
    return `
<div class="sv3-property-card" onclick="window.location.href='${detailUrl}'" role="article" aria-label="${esc(name)}">
        <div class="sv3-property-image">
          <img src="${img}" alt="${esc(name)}" loading="lazy" onerror="this.src='/assets/logos/logo.png'">
          ${badge ? `<span class="sv3-property-badge">${badge}</span>` : ""}
          <button class="sv3-save-btn" onclick="event.stopPropagation();window.toggleSave('${propId}', this)" aria-label="Save ${esc(name)}"><i class="fa-${p.isSaved ? "solid" : "regular"} fa-heart"></i></button>
        </div>
        <div class="sv3-property-body">
          <div class="sv3-property-title">${esc(name)}</div>
          <div class="sv3-property-loc"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</div>
          <div class="sv3-property-price">${inr(rent)}<span>/month</span></div>
          <div class="sv3-property-footer">
            <span class="sv3-rating">${rating > 0 ? '<i class="fa-solid fa-star"></i> ' + rating.toFixed(1) : "New"}</span>
            <button class="sv3-btn sv3-btn-primary" style="padding:8px 16px;font-size:13px" onclick="event.stopPropagation();window.location.href='${detailUrl}'">View</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

window.toggleSave = async function (propertyId, btn) {
  const token = localStorage.getItem("camporaToken") || sessionStorage.getItem("camporaToken");
  if (!token) {
    const currentUrl = window.location.pathname + window.location.search;
    window.location.href = `/login.html?redirectTo=${encodeURIComponent(currentUrl)}`;
    return;
  }
  try {
    const icon = btn.querySelector("i");
    const isSaved = icon.classList.contains("fa-solid");
    if (isSaved) {
      await apiFetch(`/student/saved/${propertyId}`, { method: "DELETE" });
      icon.className = "fa-regular fa-heart";
    } else {
      await apiFetch(`/student/saved/${propertyId}`, { method: "POST" });
      icon.className = "fa-solid fa-heart";
    }
  } catch (err) {
    // silent
  }
};
