// =====================================================
// CAMPORA STUDENT V3 - SAVED PROPERTIES
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, imageUrl, inr, esc } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  loadSaved();
});

async function loadSaved() {
  const grid = $("savedGrid");
  if (!grid) return;
  try {
    const data = await apiFetch("/student/saved");
    const properties = data.properties || [];
    if (properties.length === 0) {
grid.innerHTML = `<div class="sv3-empty" style="grid-column:1/-1"><i class="fa-solid fa-heart"></i><h3>No saved properties</h3><p>Tap the heart on any property to save it here.</p><a href="properties.html" class="sv3-btn sv3-btn-primary" style="margin-top:14px">Explore Properties</a></div>`;
      return;
    }
    grid.innerHTML = properties.map((p) => {
      const name = p.propertyName || p.title || "Campora Property";
      const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
      const rent = p.rent || p.price || 0;
      const rating = p.averageRating || 0;
      const img = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/logos/logo.png";
      return `
<div class="sv3-property-card" onclick="window.location.href='/pages/property/property.html?id=${p._id}'" role="article" aria-label="${esc(name)}">
          <div class="sv3-property-image">
            <img src="${img}" alt="${esc(name)}" loading="lazy" onerror="this.src='/assets/logos/logo.png'">
            <button class="sv3-save-btn" onclick="event.stopPropagation();window.removeSaved('${p._id}', this)" aria-label="Remove from saved" title="Remove"><i class="fa-solid fa-heart" style="color:#f87171"></i></button>
          </div>
          <div class="sv3-property-body">
            <div class="sv3-property-title">${esc(name)}</div>
            <div class="sv3-property-loc"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</div>
            <div class="sv3-property-price">${inr(rent)}<span>/month</span></div>
            <div class="sv3-property-footer">
              <span class="sv3-rating">${rating > 0 ? '<i class="fa-solid fa-star"></i> ' + rating.toFixed(1) : "New"}</span>
<button class="sv3-btn sv3-btn-primary" style="padding:8px 16px;font-size:13px" onclick="event.stopPropagation();window.location.href='/pages/property/property.html?id=${p._id}'">View</button>
            </div>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    grid.innerHTML = `<div class="sv3-error" style="grid-column:1/-1"><i class="fa-solid fa-triangle-exclamation"></i><h3>Failed to load saved properties</h3><p>${esc(err.message)}</p></div>`;
  }
}

window.removeSaved = async function (propertyId, btn) {
  try {
    await apiFetch(`/student/saved/${propertyId}`, { method: "DELETE" });
    const card = btn.closest(".sv3-property-card");
    if (card) card.remove();
    const grid = $("savedGrid");
    if (grid && grid.children.length === 0) {
      grid.innerHTML = `<div class="sv3-empty" style="grid-column:1/-1"><i class="fa-solid fa-heart"></i><h3>No saved properties</h3><p>Tap the heart on any property to save it here.</p></div>`;
    }
  } catch (err) {
    // silent
  }
};

