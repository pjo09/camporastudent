// =====================================================
// CAMPORA OWNER PROPERTIES V3
// =====================================================

import { initShell, apiFetch, showToast, formatImage, $ } from "./owner-shell.js";

const DOM = {
  propertyGrid: $("propertyGrid"),
  emptyState: $("emptyState"),
  propertySearch: $("propertySearch"),
  filterBtns: document.querySelectorAll(".v3-filter-btn"),
  totalCount: $("totalCount"),
  approvedCount: $("approvedCount"),
  pendingCount: $("pendingCount"),
  rejectedCount: $("rejectedCount"),
  shareModal: $("shareModal"),
  closeShareModal: $("closeShareModal"),
  shareLink: $("shareLink"),
  copyShareLink: $("copyShareLink"),
};

const state = {
  properties: [],
  currentFilter: "all",
  searchTerm: "",
};

// =====================================================
// INIT
// =====================================================

initShell("My Properties");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadProperties();
});

function setupListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      state.currentFilter = btn.dataset.filter;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderProperties();
    });
  });

  DOM.propertySearch?.addEventListener("input", (e) => {
    state.searchTerm = e.target.value.trim().toLowerCase();
    renderProperties();
  });

  DOM.closeShareModal?.addEventListener("click", () => DOM.shareModal.classList.remove("active"));
  DOM.shareModal?.addEventListener("click", (e) => { if (e.target === DOM.shareModal) DOM.shareModal.classList.remove("active"); });
  DOM.copyShareLink?.addEventListener("click", () => {
    if (DOM.shareLink) {
      navigator.clipboard.writeText(DOM.shareLink.value).then(() => showToast("Link copied to clipboard", "success"));
    }
  });
}

// =====================================================
// LOAD PROPERTIES
// =====================================================

async function loadProperties() {
  DOM.propertyGrid.innerHTML = `<div class="v3-loading" style="grid-column:1/-1"><i class="fa-solid fa-spinner fa-spin"></i> Loading properties...</div>`;

  try {
    const data = await apiFetch("/owner/properties?limit=100");
    state.properties = data.properties || [];

    // Stats
    const approved = state.properties.filter((p) => p.status === "approved").length;
    const pending = state.properties.filter((p) => p.status === "pending").length;
    const rejected = state.properties.filter((p) => p.status === "rejected").length;
    if (DOM.totalCount) DOM.totalCount.textContent = state.properties.length;
    if (DOM.approvedCount) DOM.approvedCount.textContent = approved;
    if (DOM.pendingCount) DOM.pendingCount.textContent = pending;
    if (DOM.rejectedCount) DOM.rejectedCount.textContent = rejected;

    renderProperties();
  } catch (err) {
    console.error("Properties load error:", err);
    DOM.propertyGrid.innerHTML = `<div class="v3-error" style="grid-column:1/-1"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load Properties</h3><p>${err.message}</p><button class="v3-btn v3-btn-primary" onclick="location.reload()">Try Again</button></div>`;
  }
}

// =====================================================
// RENDER
// =====================================================

function renderProperties() {
  let filtered = [...state.properties];

  if (state.currentFilter !== "all") {
    filtered = filtered.filter((p) => p.status === state.currentFilter);
  }

  if (state.searchTerm) {
    filtered = filtered.filter((p) => {
      const name = (p.propertyName || "").toLowerCase();
      const city = (p.city || "").toLowerCase();
      const college = (p.college || "").toLowerCase();
      return name.includes(state.searchTerm) || city.includes(state.searchTerm) || college.includes(state.searchTerm);
    });
  }

  if (filtered.length === 0) {
    DOM.propertyGrid.innerHTML = "";
    DOM.emptyState.style.display = "block";
    return;
  }

  DOM.emptyState.style.display = "none";
  DOM.propertyGrid.innerHTML = "";

  filtered.forEach((p) => {
    const images = (p.images && p.images.length ? p.images : [""]);
    const name = p.propertyName || "Untitled Property";
    const city = p.city || "";
    const stateName = p.state || "";
    const location = city + (stateName ? ", " + stateName : "");
    const rent = p.rent || 0;
    const status = p.status || "pending";
    const statusColor = status === "approved" ? "success" : status === "rejected" ? "danger" : "warning";
    const occupancy = p.totalBeds ? Math.round(((p.totalBeds - (p.availableBeds || 0)) / p.totalBeds) * 100) : 0;
    const rating = p.averageRating || 0;
    const views = p.views || 0;
    const published = p.published !== false;
    const available = p.available !== false;

    const card = document.createElement("div");
    card.className = "v3-card v3-animate";
    card.style.padding = "0";
    card.style.overflow = "hidden";

    // Image slider
    let sliderHtml = `<div class="v3-prop-slider" data-id="${p._id}" style="position:relative;height:200px;overflow:hidden;background:#0f172a">
      <img src="${formatImage(images[0])}" alt="${name}" style="width:100%;height:100%;object-fit:cover" loading="lazy" onerror="this.src='https://placehold.co/700x450?text=Campora'">
      ${images.length > 1 ? `<div style="position:absolute;top:12px;right:12px;background:rgba(0,0,0,.6);color:#fff;border-radius:999px;padding:4px 10px;font-size:12px;font-weight:700"><i class="fa-solid fa-images"></i> ${images.length}</div>` : ""}
      <span class="v3-pill ${statusColor === 'success' ? 'v3-pill-success' : statusColor === 'danger' ? 'v3-pill-danger' : 'v3-pill-warning'}" style="position:absolute;top:12px;left:12px">${status.toUpperCase()}</span>
    </div>`;

    card.innerHTML = `
      ${sliderHtml}
      <div style="padding:20px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">
          <h3 style="font-size:20px;font-weight:800">${name}</h3>
          <span class="v3-pill ${published ? 'v3-pill-success' : 'v3-pill-warning'}">${published ? 'Live' : 'Draft'}</span>
        </div>
        <p style="color:var(--v3-muted);font-size:14px;margin-top:6px"><i class="fa-solid fa-location-dot"></i> ${location || "Location not set"}</p>
        <p style="color:var(--v3-muted);font-size:13px;margin-top:4px">${p.propertyType || "PG"} ${available ? '' : '• Paused'}</p>

        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin:16px 0;padding:14px;border-radius:14px;background:rgba(255,255,255,.04)">
          <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#60a5fa">₹${rent.toLocaleString()}</div><div style="font-size:11px;color:var(--v3-muted)">Rent</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#22c55e">${occupancy}%</div><div style="font-size:11px;color:var(--v3-muted)">Occupancy</div></div>
          <div style="text-align:center"><div style="font-size:18px;font-weight:800;color:#fbbf24">${views}</div><div style="font-size:11px;color:var(--v3-muted)">Views</div></div>
        </div>

        <div style="display:flex;align-items:center;gap:8px;margin-bottom:14px">
          <span style="color:#fbbf24"><i class="fa-solid fa-star"></i> ${rating > 0 ? rating.toFixed(1) : "New"}</span>
          <span style="color:var(--v3-muted);font-size:13px">• ${p.totalReviews || 0} reviews</span>
        </div>

        <div style="display:flex;flex-wrap:wrap;gap:8px">
          <button class="v3-btn v3-btn-primary v3-btn-sm" data-action="view" data-id="${p._id}"><i class="fa-solid fa-eye"></i> View</button>
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="edit" data-id="${p._id}"><i class="fa-solid fa-pen"></i> Edit</button>
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="duplicate" data-id="${p._id}"><i class="fa-solid fa-copy"></i> Duplicate</button>
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="toggle" data-id="${p._id}" data-published="${published}"><i class="fa-solid ${published ? 'fa-pause' : 'fa-play'}"></i> ${published ? 'Pause' : 'Resume'}</button>
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="share" data-id="${p._id}"><i class="fa-solid fa-share"></i> Share</button>
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="students" data-id="${p._id}"><i class="fa-solid fa-user-graduate"></i> Students</button>
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="reviews" data-id="${p._id}"><i class="fa-solid fa-star"></i> Reviews</button>
          <button class="v3-btn v3-btn-danger v3-btn-sm" data-action="delete" data-id="${p._id}"><i class="fa-solid fa-trash"></i> Delete</button>
        </div>
      </div>
    `;

    // Attach action handlers
    card.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        handleAction(btn.dataset.action, btn.dataset.id, btn);
      });
    });

    DOM.propertyGrid.appendChild(card);
  });
}

// =====================================================
// ACTIONS
// =====================================================

async function handleAction(action, id, btn) {
  switch (action) {
    case "view":
      window.location.href = `/pages/property/property.html?id=${id}`;
      break;
    case "edit":
      window.location.href = `/pages/owner/add-property.html?id=${id}`;
      break;
    case "duplicate":
      await duplicateProperty(id, btn);
      break;
    case "toggle":
      await toggleProperty(id, btn);
      break;
    case "share":
      openShare(id);
      break;
    case "students":
      window.location.href = `/pages/owner/tenants.html?propertyId=${id}`;
      break;
    case "reviews":
      window.location.href = `/pages/owner/reviews.html?propertyId=${id}`;
      break;
    case "delete":
      await deleteProperty(id, btn);
      break;
  }
}

async function duplicateProperty(id, btn) {
  btn.disabled = true;
  try {
    await apiFetch(`/owner/properties/${id}/duplicate`, { method: "POST" });
    showToast("Property duplicated successfully", "success");
    loadProperties();
  } catch (err) {
    showToast("Failed to duplicate: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function toggleProperty(id, btn) {
  const isPublished = btn.dataset.published === "true";
  btn.disabled = true;
  try {
    await apiFetch(`/owner/properties/${id}/${isPublished ? "unpublish" : "publish"}`, { method: "PATCH" });
    showToast(isPublished ? "Listing paused" : "Listing resumed", "success");
    loadProperties();
  } catch (err) {
    showToast("Failed to update listing: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

async function deleteProperty(id, btn) {
  if (!confirm("Are you sure you want to delete this property? This action cannot be undone.")) return;
  btn.disabled = true;
  try {
    await apiFetch(`/owner/properties/${id}`, { method: "DELETE" });
    showToast("Property deleted successfully", "success");
    loadProperties();
  } catch (err) {
    showToast("Failed to delete: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

function openShare(id) {
  const property = state.properties.find((p) => p._id === id);
  if (!property) return;
  const url = `${window.location.origin}${window.location.pathname.replace(/owner-properties\.html$/, "")}/pages/property/property.html?id=${id}`;
  if (DOM.shareLink) DOM.shareLink.value = url;
  if (DOM.shareModal) DOM.shareModal.classList.add("active");
}

window.showToast = showToast;
console.log("✅ Campora Owner Properties V3 initialised");
