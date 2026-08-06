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
};

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  setupEvents();
  loadProperties();
});

function setupEvents() {
  const searchInput = $("searchInput");
  if (searchInput) {
    searchInput.addEventListener("input", () => {
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => {
        state.search = searchInput.value.trim();
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
    if (state.search) q.set("college", state.search);

    const data = await apiFetch(`/properties/search?${q.toString()}`);
    const properties = data.properties || [];
    state.totalPages = data.totalPages || 1;

    if (properties.length === 0) {
      grid.innerHTML = `<div class="sv3-empty" style="grid-column:1/-1"><i class="fa-solid fa-house-circle-xmark"></i><h3>No properties found</h3><p>Try adjusting your filters or search.</p></div>`;
      $("pagination").style.display = "none";
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
    const name = p.propertyName || p.title || "Campora Property";
    const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
    const rent = p.rent || p.price || 0;
    const rating = p.averageRating || 0;
    const img = p.images && p.images.length ? imageUrl(p.images[0]) : "./images/logo.png";
    const badge = p.verified ? "Verified" : p.featured ? "Featured" : "";
    return `
<div class="sv3-property-card" onclick="window.location.href='property-details.html?id=${p._id}'" role="article" aria-label="${esc(name)}">
        <div class="sv3-property-image">
          <img src="${img}" alt="${esc(name)}" loading="lazy" onerror="this.src='./images/logo.png'">
          ${badge ? `<span class="sv3-property-badge">${badge}</span>` : ""}
          <button class="sv3-save-btn" onclick="event.stopPropagation();window.toggleSave('${p._id}', this)" aria-label="Save ${esc(name)}"><i class="fa-${p.isSaved ? "solid" : "regular"} fa-heart"></i></button>
        </div>
        <div class="sv3-property-body">
          <div class="sv3-property-title">${esc(name)}</div>
          <div class="sv3-property-loc"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</div>
          <div class="sv3-property-price">${inr(rent)}<span>/month</span></div>
          <div class="sv3-property-footer">
            <span class="sv3-rating">${rating > 0 ? '<i class="fa-solid fa-star"></i> ' + rating.toFixed(1) : "New"}</span>
            <button class="sv3-btn sv3-btn-primary" style="padding:8px 16px;font-size:13px" onclick="event.stopPropagation();window.location.href='property-details.html?id=${p._id}'">View</button>
          </div>
        </div>
      </div>`;
  }).join("");
}

window.toggleSave = async function (propertyId, btn) {
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
