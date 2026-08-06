// =====================================================
// CAMPORA NEARBY / MAP PAGE
// Leaflet + Property search integration
// =====================================================

import { getToken, getUser, protectPage } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;
const IMAGE_BASE = API.replace("/api", "") + "/";

const $ = (id) => document.getElementById(id);

const DOM = {
  mapContainer: $("mapContainer"),
  nearbyList: $("nearbyList"),
  propertyCount: $("propertyCount"),
  searchInput: $("searchInput"),
  sortSelect: $("sortSelect"),
  filterBtns: document.querySelectorAll(".filter-btn"),
};

const state = {
  user: null,
  token: null,
  properties: [],
  filtered: [],
  currentFilter: "all",
  currentSort: "distance",
  searchTerm: "",
  map: null,
  markers: [],
};

state.user = protectPage();
state.token = getToken();

init();

async function init() {
  setupEventListeners();
  await loadProperties();
  initMap();
}

function setupEventListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      applyFilters();
    });
  });

  DOM.sortSelect?.addEventListener("change", (e) => {
    state.currentSort = e.target.value;
    applyFilters();
  });

  DOM.searchInput?.addEventListener("input", () => {
    state.searchTerm = DOM.searchInput.value.trim().toLowerCase();
    applyFilters();
  });
}

async function loadProperties() {
  try {
    const res = await fetch(`${API}/properties/search?limit=50`);
    const data = await res.json();
    state.properties = data.properties || [];
    applyFilters();
  } catch (err) {
    console.error("Properties load error:", err);
    DOM.nearbyList.innerHTML = `<div style="text-align:center;padding:40px;color:#ef4444">Failed to load properties</div>`;
  }
}

function applyFilters() {
  let filtered = [...state.properties];

  // Type filter
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
      filtered.sort((a, b) => (a.rent || 0) - (b.rent || 0));
      break;
    case "rating":
      filtered.sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      break;
    default:
      // "distance" - keep as is
      break;
  }

  state.filtered = filtered;
  DOM.propertyCount.textContent = `${filtered.length} found`;
  renderList();
  updateMapMarkers();
}

function renderList() {
  DOM.nearbyList.innerHTML = "";

  if (state.filtered.length === 0) {
    DOM.nearbyList.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#64748b">
      <i class="fa-solid fa-map-pin" style="font-size:36px;display:block;margin-bottom:12px"></i>
      No properties found in this area
    </div>`;
    return;
  }

  state.filtered.slice(0, 30).forEach((p) => {
    const img = p.images?.length ? getImageUrl(p.images[0]) : "./assets/images/property-placeholder.jpg";
    const name = p.propertyName || p.title || "Property";
    const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "";
    const rent = p.rent || p.price || 0;
    const college = p.college || "";

    const card = document.createElement("div");
    card.className = "nearby-card";
    card.innerHTML = `
      <img src="${img}" class="nearby-card-img" alt="${name}" loading="lazy" onerror="this.src='./assets/images/property-placeholder.jpg'" />
      <div class="nearby-card-content">
        <div class="nearby-card-title">${name}</div>
        ${loc ? `<div class="nearby-card-location"><i class="fa-solid fa-location-dot"></i> ${loc}</div>` : ""}
        <div class="nearby-card-price">₹${rent.toLocaleString()}/mo</div>
        <div style="display:flex;gap:6px;margin-top:6px;flex-wrap:wrap">
          ${college ? `<span class="univerity-marker"><i class="fa-solid fa-graduation-cap"></i> ${college}</span>` : ""}
          ${p.sharing ? `<span class="univerity-marker" style="background:rgba(124,58,237,.12);color:#a78bfa">${p.sharing}</span>` : ""}
        </div>
        ${p.latitude && p.longitude ? `<div class="nearby-card-distance"><i class="fa-solid fa-location-crosshairs"></i> Has location</div>` : ""}
      </div>`;
    card.addEventListener("click", () => {
      window.location.href = `/pages/property/property.html?id=${p._id}`;
    });
    DOM.nearbyList.appendChild(card);
  });
}

// =====================================================
// MAP (Leaflet)
// =====================================================

function initMap() {
  // Check if Leaflet is loaded via CDN
  if (typeof L === "undefined") {
    loadLeaflet().then(() => {
      createMap();
    }).catch(() => {
      // Fallback to Google Maps iframe
      createFallbackMap();
    });
  } else {
    createMap();
  }
}

function loadLeaflet() {
  return new Promise((resolve, reject) => {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
    document.head.appendChild(link);

    const script = document.createElement("script");
    script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

function createMap() {
  if (typeof L === "undefined") {
    createFallbackMap();
    return;
  }

  DOM.mapContainer.innerHTML = '<div id="leafletMap" style="width:100%;height:100%"></div>';

  state.map = L.map("leafletMap", {
    zoomControl: true,
    attributionControl: false,
  }).setView([20.5937, 78.9629], 5);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
  }).addTo(state.map);

  // Add markers for properties with coordinates
  updateMapMarkers();
}

function createFallbackMap() {
  // Use Google Maps iframe as fallback
  const bounds = getBounds();
  DOM.mapContainer.innerHTML = `
    <iframe
      src="https://www.google.com/maps/embed/v1/search?key=&q=student+accommodation+near+india&center=${bounds.lat},${bounds.lng}&zoom=12"
      width="100%" height="100%" style="border:0;border-radius:18px"
      loading="lazy" allowfullscreen title="Map of nearby properties">
    </iframe>
    <div style="position:absolute;bottom:12px;left:50%;transform:translateX(-50%);background:rgba(0,0,0,.7);padding:8px 16px;border-radius:999px;font-size:12px;color:#94a3b8">
      🗺️ ${state.filtered.length} properties
    </div>`;
}

function updateMapMarkers() {
  if (!state.map) return;

  // Clear old markers
  state.markers.forEach((m) => state.map.removeLayer(m));
  state.markers = [];

  const bounds = [];
  const propsWithCoords = state.filtered.filter((p) => p.latitude && p.longitude);

  propsWithCoords.forEach((p) => {
    const latlng = [p.latitude, p.longitude];
    bounds.push(latlng);

    const marker = L.marker(latlng, {
      icon: L.divIcon({
        className: "custom-marker",
        html: `<div style="background:linear-gradient(135deg,#2563eb,#7c3aed);color:#fff;padding:6px 12px;border-radius:999px;font-size:12px;font-weight:700;white-space:nowrap;box-shadow:0 4px 12px rgba(0,0,0,.3)">₹${(p.rent || 0).toLocaleString()}</div>`,
        iconSize: [80, 30],
        iconAnchor: [40, 15],
      }),
    })
      .addTo(state.map)
      .bindPopup(`<b>${p.propertyName || "Property"}</b><br>₹${(p.rent || 0).toLocaleString()}/month`);

    marker.on("click", () => {
      window.location.href = `/pages/property/property.html?id=${p._id}`;
    });

    state.markers.push(marker);
  });

  // Fit bounds if we have markers
  if (bounds.length > 0) {
    state.map.fitBounds(bounds, { padding: [50, 50] });
  } else if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (pos) => state.map.setView([pos.coords.latitude, pos.coords.longitude], 12),
      () => state.map.setView([20.5937, 78.9629], 5)
    );
  }
}

function getBounds() {
  if (state.filtered.length > 0) {
    const p = state.filtered[0];
    if (p.latitude && p.longitude) return { lat: p.latitude, lng: p.longitude };
  }
  return { lat: 20.5937, lng: 78.9629 };
}

function getImageUrl(path) {
  if (!path) return "";
  if (path.startsWith("http")) return path;
  return IMAGE_BASE + path.replace(/^\//, "");
}

console.log("✅ Nearby Page Loaded");

