// =====================================================
// CAMPORA SAVED PROPERTIES PAGE
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;
const IMAGE_BASE = API.replace("/api", "") + "/";

const $ = (id) => document.getElementById(id);

const DOM = {
  skeleton: $("savedSkeleton"),
  grid: $("savedGrid"),
  empty: $("savedEmpty"),
  errorState: $("savedError"),
  pagination: $("savedPagination"),
  prevPage: $("prevPage"),
  nextPage: $("nextPage"),
  pageInfo: $("pageInfo"),
  searchInput: $("searchInput"),
  sortSelect: $("sortSelect"),
  filterBtns: document.querySelectorAll(".filter-btn"),
  wishlistCount: $("wishlistCount"),
  retryBtn: $("retrySavedBtn"),
};

const state = {
  user: null,
  token: null,
  properties: [],
  filtered: [],
  currentPage: 1,
  currentFilter: "all",
  currentSort: "latest",
  searchTerm: "",
  perPage: 6,
};

// =====================================================
// INIT
// =====================================================

state.user = protectPageByRole(["student"]);
state.token = getToken();
if (!state.user || !state.token) {}

setupEventListeners();
loadSaved();

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupEventListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      state.currentPage = 1;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      applyFilters();
    });
  });

  DOM.sortSelect?.addEventListener("change", (e) => {
    state.currentSort = e.target.value;
    state.currentPage = 1;
    applyFilters();
  });

  DOM.searchInput?.addEventListener("input", () => {
    state.searchTerm = DOM.searchInput.value.trim().toLowerCase();
    state.currentPage = 1;
    applyFilters();
  });

  DOM.prevPage?.addEventListener("click", () => {
    if (state.currentPage > 1) { state.currentPage--; renderPage(); }
  });
  DOM.nextPage?.addEventListener("click", () => {
    const totalPages = Math.ceil(state.filtered.length / state.perPage);
    if (state.currentPage < totalPages) { state.currentPage++; renderPage(); }
  });
  DOM.retryBtn?.addEventListener("click", loadSaved);
}

// =====================================================
// LOAD SAVED
// =====================================================

async function loadSaved() {
  showSkeleton();
  hideError();
  hideEmpty();

  try {
    const res = await fetch(`${API}/student/saved`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (!data.success) throw new Error(data.message);

    state.properties = data.properties || [];
    hideSkeleton();
    applyFilters();
  } catch (err) {
    console.error("Saved load error:", err);
    hideSkeleton();
    showError();
  }
}

// =====================================================
// APPLY FILTERS & SORT
// =====================================================

function applyFilters() {
  let filtered = [...state.properties];

  // Filter by type
  if (state.currentFilter !== "all") {
    filtered = filtered.filter((p) => p.propertyType === state.currentFilter);
  }

  // Search
  if (state.searchTerm) {
    const term = state.searchTerm;
    filtered = filtered.filter(
      (p) =>
        (p.propertyName || "").toLowerCase().includes(term) ||
        (p.city || "").toLowerCase().includes(term) ||
        (p.college || "").toLowerCase().includes(term) ||
        (p.state || "").toLowerCase().includes(term)
    );
  }

  // Sort
  switch (state.currentSort) {
    case "priceLow":
      filtered.sort((a, b) => (a.rent || a.price || 0) - (b.rent || b.price || 0));
      break;
    case "priceHigh":
      filtered.sort((a, b) => (b.rent || b.price || 0) - (a.rent || a.price || 0));
      break;
    case "rating":
      filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      break;
    default:
      filtered.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  state.filtered = filtered;
  state.currentPage = 1;

  DOM.wishlistCount.textContent = `${filtered.length} property${filtered.length !== 1 ? "ies" : "y"}`;

  if (filtered.length === 0) {
    hideGrid();
    showEmpty();
    hidePagination();
    return;
  }

  showGrid();
  hideEmpty();
  renderPage();
}

// =====================================================
// RENDER PAGE
// =====================================================

function renderPage() {
  const totalPages = Math.ceil(state.filtered.length / state.perPage);
  const start = (state.currentPage - 1) * state.perPage;
  const end = start + state.perPage;
  const pageItems = state.filtered.slice(start, end);

  DOM.grid.innerHTML = "";

  pageItems.forEach((p) => {
    const img = p.images?.length ? getImageUrl(p.images[0]) : "./images/property-placeholder.jpg";
    const name = p.propertyName || p.title || "Campora Property";
    const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
    const rent = p.rent || p.price || 0;
    const rating = p.averageRating || 0;
    const sharing = p.sharing || "";

    const card = document.createElement("div");
    card.className = "property-card";
    card.innerHTML = `
      <div class="property-image">
        <img src="${img}" alt="${name}" loading="lazy" onerror="this.src='./images/property-placeholder.jpg'" />
        ${p.verified ? '<div class="property-badge">Verified</div>' : ""}
        <button class="property-save saved" data-id="${p._id}" aria-label="Remove from saved" onclick="window.removeSaved('${p._id}', this)">
          <i class="fa-solid fa-heart"></i>
        </button>
      </div>
      <div class="property-body">
        <h3 class="property-title">${name}</h3>
        <p class="property-location"><i class="fa-solid fa-location-dot"></i> ${loc}</p>
        <div class="property-price">₹${rent.toLocaleString()}<span>/month</span></div>
        ${sharing ? `<div class="property-features"><span class="feature-chip">${sharing}</span></div>` : ""}
        <div class="property-footer">
          <div class="property-rating">${rating > 0 ? `<i class="fa-solid fa-star"></i> ${rating.toFixed(1)}` : '<span style="color:#94a3b8">New</span>'}</div>
          <button class="book-btn" onclick="window.location.href='property-details.html?id=${p._id}'">View</button>
        </div>
      </div>`;
    DOM.grid.appendChild(card);
  });

  // Pagination
  if (totalPages > 1) {
    showPagination();
    DOM.pageInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
    DOM.prevPage.disabled = state.currentPage <= 1;
    DOM.nextPage.disabled = state.currentPage >= totalPages;
  } else {
    hidePagination();
  }
}

// =====================================================
// REMOVE SAVED (global)
// =====================================================

window.removeSaved = async function (id, btn) {
  try {
    const res = await fetch(`${API}/properties/save/${id}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    if (data.success) {
      state.properties = state.properties.filter((p) => p._id !== id);
      applyFilters();
      if (typeof window.showToast === "function") {
        window.showToast("Removed from saved", "info");
      }
    }
  } catch (err) {
    console.error("Remove saved error:", err);
  }
};

// =====================================================
// HELPERS
// =====================================================

function getImageUrl(path) {
  if (!path) return "./images/property-placeholder.jpg";
  if (path.startsWith("http")) return path;
  return IMAGE_BASE + path.replace(/^\//, "");
}

function showSkeleton() { if (DOM.skeleton) DOM.skeleton.hidden = false; }
function hideSkeleton() { if (DOM.skeleton) DOM.skeleton.hidden = true; }
function showGrid() { if (DOM.grid) DOM.grid.hidden = false; }
function hideGrid() { if (DOM.grid) DOM.grid.hidden = true; }
function showEmpty() { if (DOM.empty) DOM.empty.hidden = false; }
function hideEmpty() { if (DOM.empty) DOM.empty.hidden = true; }
function showError() { if (DOM.errorState) DOM.errorState.hidden = false; }
function hideError() { if (DOM.errorState) DOM.errorState.hidden = true; }
function showPagination() { if (DOM.pagination) DOM.pagination.hidden = false; }
function hidePagination() { if (DOM.pagination) DOM.pagination.hidden = true; }

console.log("✅ Saved Properties Page Loaded");

