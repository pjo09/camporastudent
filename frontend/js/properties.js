// ================================================
// CAMPORA PROPERTIES LISTING PAGE
// Public page - loads properties from GET /api/properties/search
// Cards link to /pages/property/property.html?id=<MongoDB _id>
// ================================================

import { API } from "./config.js";
import { getImageUrl } from "./image-utils.js";

const API_BASE = API;

// ================================================
// DOM CACHE
// ================================================

const $ = (id) => document.getElementById(id);

const DOM = {
  // Sidebar / topbar
  menuBtn: $("menuBtn"),
  sidebar: $("sidebar"),
  sidebarBackdrop: $("sidebarBackdrop"),

  // Search
  searchInput: $("searchInput"),

  // Filters / sort
  filterBtns: document.querySelectorAll(".filter-btn"),
  sortSelect: $("sortSelect"),

  // Grid / states
  propertyGrid: $("propertyGrid"),
  propertySkeleton: $("propertySkeleton"),
  propertyEmpty: $("propertyEmpty"),
  emptyMessage: $("emptyMessage"),
  propertyError: $("propertyError"),
  resultCount: $("resultCount"),

  // Pagination
  propertyPagination: $("propertyPagination"),
  prevPage: $("prevPage"),
  nextPage: $("nextPage"),
  pageInfo: $("pageInfo"),

  // Toast
  toastContainer: $("toastContainer"),
};

// ================================================
// STATE
// ================================================

const state = {
  currentPage: 1,
  currentFilter: "all",
  currentSort: "latest",
  totalPages: 1,
  searchTimeout: null,
};

// ================================================
// TOAST
// ================================================

function showToast(message, type = "info", duration = 4000) {
  if (!DOM.toastContainer) return;
  const icons = {
    success: "fa-solid fa-circle-check",
    error: "fa-solid fa-circle-exclamation",
    info: "fa-solid fa-circle-info",
  };
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.setAttribute("role", "alert");
  toast.innerHTML = `<i class="${icons[type] || icons.info}"></i> ${message}`;
  DOM.toastContainer.appendChild(toast);
  setTimeout(() => {
    toast.classList.add("toast-leaving");
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

// ================================================
// VIEW HELPERS
// ================================================

function showSkeleton() {
  if (DOM.propertySkeleton) DOM.propertySkeleton.hidden = false;
}
function hideSkeleton() {
  if (DOM.propertySkeleton) DOM.propertySkeleton.hidden = true;
}
function showGrid() {
  if (DOM.propertyGrid) DOM.propertyGrid.hidden = false;
}
function hideGrid() {
  if (DOM.propertyGrid) DOM.propertyGrid.hidden = true;
}
function showEmpty() {
  if (DOM.propertyEmpty) DOM.propertyEmpty.hidden = false;
}
function hideEmpty() {
  if (DOM.propertyEmpty) DOM.propertyEmpty.hidden = true;
}
function showError() {
  if (DOM.propertyError) DOM.propertyError.hidden = false;
}
function hideError() {
  if (DOM.propertyError) DOM.propertyError.hidden = true;
}
function showPagination() {
  if (DOM.propertyPagination) DOM.propertyPagination.hidden = false;
}
function hidePagination() {
  if (DOM.propertyPagination) DOM.propertyPagination.hidden = true;
}

// ================================================
// API FETCH
// ================================================

async function apiFetch(endpoint) {
  const res = await fetch(`${API_BASE}${endpoint}`);
  const data = await res.json();
  if (!res.ok || !data.success)
    throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// ================================================
// INIT
// ================================================

(function init() {
  setupEventListeners();
  loadProperties();
})();

// ================================================
// EVENT LISTENERS
// ================================================

function setupEventListeners() {
  // Sidebar toggle (mobile)
  if (DOM.menuBtn && DOM.sidebar) {
    DOM.menuBtn.addEventListener("click", () => {
      const active = DOM.sidebar.classList.toggle("active");
      DOM.menuBtn.setAttribute("aria-expanded", active ? "true" : "false");
      if (DOM.sidebarBackdrop) DOM.sidebarBackdrop.hidden = !active;
    });
    if (DOM.sidebarBackdrop) {
      DOM.sidebarBackdrop.addEventListener("click", () => {
        DOM.sidebar.classList.remove("active");
        DOM.menuBtn.setAttribute("aria-expanded", "false");
        DOM.sidebarBackdrop.hidden = true;
      });
    }
  }

  // Search (debounced)
  if (DOM.searchInput) {
    DOM.searchInput.addEventListener("input", () => {
      clearTimeout(state.searchTimeout);
      state.searchTimeout = setTimeout(() => {
        state.currentPage = 1;
        loadProperties();
      }, 400);
    });
  }

  // Filters
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      state.currentPage = 1;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      loadProperties();
    });
  });

  // Sort
  if (DOM.sortSelect) {
    DOM.sortSelect.addEventListener("change", (e) => {
      state.currentSort = e.target.value;
      state.currentPage = 1;
      loadProperties();
    });
  }

  // Pagination
  if (DOM.prevPage) {
    DOM.prevPage.addEventListener("click", () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        loadProperties();
      }
    });
  }
  if (DOM.nextPage) {
    DOM.nextPage.addEventListener("click", () => {
      if (state.currentPage < state.totalPages) {
        state.currentPage++;
        loadProperties();
      }
    });
  }
}

// ================================================
// LOAD PROPERTIES
// ================================================

async function loadProperties() {
  showSkeleton();
  hideGrid();
  hideEmpty();
  hideError();
  hidePagination();

  try {
    const query = new URLSearchParams();
    if (state.currentFilter !== "all") query.set("propertyType", state.currentFilter);
    if (state.currentSort) query.set("sort", state.currentSort);
    query.set("page", state.currentPage);
    query.set("limit", "12");

    const searchTerm = DOM.searchInput?.value.trim();
    if (searchTerm) query.set("college", searchTerm);

    const res = await apiFetch(`/properties/search?${query.toString()}`);

    hideSkeleton();

    const properties = res.properties || [];
    state.totalPages = res.totalPages || 1;

    // Result count
    if (DOM.resultCount) {
      DOM.resultCount.textContent = res.total
        ? `${res.total} propert${res.total === 1 ? "y" : "ies"} found`
        : "";
    }

    if (properties.length === 0) {
      hideGrid();
      if (DOM.emptyMessage) {
        DOM.emptyMessage.textContent = searchTerm
          ? `No results for "${searchTerm}". Try a different search.`
          : "Properties will appear here once added.";
      }
      showEmpty();
      hidePagination();
      return;
    }

    hideEmpty();
    showGrid();
    renderProperties(properties);

    // Pagination
    if (state.totalPages > 1) {
      showPagination();
      if (DOM.pageInfo) DOM.pageInfo.textContent = `Page ${state.currentPage} of ${state.totalPages}`;
      if (DOM.prevPage) DOM.prevPage.disabled = state.currentPage <= 1;
      if (DOM.nextPage) DOM.nextPage.disabled = state.currentPage >= state.totalPages;
    } else {
      hidePagination();
    }
  } catch (err) {
    console.error("Properties error:", err);
    hideSkeleton();
    hideGrid();
    hideEmpty();
    showError();
    showToast("Failed to load properties: " + err.message, "error");
  }
}

// ================================================
// RENDER PROPERTY CARDS
// ================================================

function renderProperties(properties) {
  if (!DOM.propertyGrid) return;
  DOM.propertyGrid.innerHTML = "";

properties.forEach((p) => {
    const imgSrc = getImageUrl(p.images && p.images.length ? p.images[0] : "");

    const name = p.propertyName || p.title || "Campora Property";
    const loc = p.city
      ? `${p.city}${p.state ? ", " + p.state : ""}`
      : "Location not specified";
    const rent = p.rent || p.price || 0;
    const rating = p.averageRating || 0;
    const badge = p.verified ? "Verified" : p.featured ? "Featured" : "";

    const card = document.createElement("div");
    card.className = "property-card";
    card.setAttribute("role", "article");
    card.innerHTML = `
      <div class="property-image">
        <img src="${imgSrc}" alt="${name}" loading="lazy" decoding="async" onerror="this.src='./assets/images/property-placeholder.jpg'">
        ${badge ? `<div class="property-badge ${p.verified ? "verified" : "featured"}">${badge}</div>` : ""}
      </div>
      <div class="property-body">
        <h3 class="property-title">${name}</h3>
        <p class="property-location"><i class="fa-solid fa-location-dot"></i> ${loc}</p>
        <div class="property-price">₹${rent.toLocaleString()}<span>/month</span></div>
        <div class="property-features">
          ${p.sharing ? `<span class="feature-chip">${p.sharing}</span>` : ""}
          ${p.gender ? `<span class="feature-chip">${p.gender}</span>` : ""}
          ${p.propertyType ? `<span class="feature-chip">${p.propertyType}</span>` : ""}
        </div>
        <div class="property-footer">
          <div class="property-rating">
            ${rating > 0 ? `<i class="fa-solid fa-star"></i> ${rating.toFixed(1)}` : '<span style="color:#94a3b8">New</span>'}
          </div>
          <button class="book-btn" onclick="window.viewProperty('${p._id}')" aria-label="View ${name}">View</button>
        </div>
      </div>
    `;

    DOM.propertyGrid.appendChild(card);
  });
}

// ================================================
// GLOBAL: VIEW PROPERTY
// ================================================

window.viewProperty = function (id) {
  window.location.href = `/pages/property/property.html?id=${id}`;
};

// ================================================
// GLOBAL: RETRY
// ================================================

window.retryLoadProperties = function () {
  hideError();
  loadProperties();
};

// ================================================
// INITIALISED
// ================================================

console.log("✅ Campora Properties Listing initialised");

