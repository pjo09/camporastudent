// =====================================================
// CAMPORA STUDENT V3 - DASHBOARD
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, timeAgo, imageUrl, inr, esc } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadDashboard();
  loadUnreadCount();
  setupDropdown();
});

function setupDropdown() {
  const profileBtn = $("profileBtn");
  const dropdown = $("profileDropdown");
  const dropdownLogout = $("dropdownLogout");
if (dropdownLogout) {
    dropdownLogout.addEventListener("click", (e) => {
      e.preventDefault();
      import("./session.js").then(({ logout }) => {
        logout();
      });
    });
  }
  if (profileBtn && dropdown) {
    profileBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      dropdown.classList.toggle("active");
    });
    document.addEventListener("click", (e) => {
      if (!profileBtn.contains(e.target) && !dropdown.contains(e.target)) {
        dropdown.classList.remove("active");
      }
    });
  }
}

async function loadDashboard() {
  try {
    const data = await apiFetch("/student/dashboard-v3");
    const stats = data.statistics || {};
    const user = data.user || {};

    // Stats
    if ($("statBookings")) $("statBookings").textContent = stats.totalBookings || 0;
    if ($("statActive")) $("statActive").textContent = stats.activeBookings || 0;
    if ($("statSaved")) $("statSaved").textContent = stats.savedCount || 0;
    if ($("statNotifications")) $("statNotifications").textContent = stats.unreadNotifications || 0;
    if ($("statMaintenance")) $("statMaintenance").textContent = stats.pendingMaintenance || 0;
    if ($("statRentDue")) $("statRentDue").textContent = inr(stats.rentDue || 0);

    // Recommended
    renderRecommended(data.recommended || []);
    renderRecentBookings(data.recentBookings || []);
    renderRecentNotifications(data.recentNotifications || []);

    // Load Move-In Center Banner & Announcements
    const confirmedBooking = (data.recentBookings || []).find(b => b.bookingStatus === "confirmed" || b.bookingStatus === "checked-in");
    let announcements = [];
    try {
      const annRes = await apiFetch("/student/announcements");
      announcements = annRes.announcements || [];
    } catch (e) {
      console.warn("Failed to load announcements for dashboard", e);
    }
    renderMoveInAndAnnouncements(confirmedBooking, announcements);

  } catch (err) {
    const grid = $("recommendedGrid");
    if (grid) grid.innerHTML = `<div class="sv3-error" style="grid-column:1/-1"><i class="fa-solid fa-triangle-exclamation"></i><h3>Failed to load dashboard</h3><p>${esc(err.message)}</p></div>`;
  }
}

function renderMoveInAndAnnouncements(booking, announcements) {
  const container = $("moveInBannerContainer");
  if (!container) return;

  let html = "";

  if (booking) {
    const propName = booking.propertyName || (booking.propertyId && booking.propertyId.propertyName) || "Property";
    html += `
      <div class="sv3-card" style="background:linear-gradient(135deg, rgba(37,99,235,0.06), rgba(99,102,241,0.06));border:1px solid rgba(37,99,235,0.2);padding:20px;border-radius:16px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:16px">
        <div style="display:flex;align-items:center;gap:16px">
          <div style="width:48px;height:48px;border-radius:12px;background:var(--sv3-primary);color:#fff;display:flex;align-items:center;justify-content:center;font-size:20px">
            <i class="fa-solid fa-truck-ramp-box"></i>
          </div>
          <div>
            <h3 style="font-size:16px;font-weight:800;margin-bottom:4px;color:#fff">Move-In Center: ${esc(propName)}</h3>
            <p style="font-size:13px;color:var(--sv3-muted)">Submit your required documents, view check-in coordinates, and coordinate with the owner.</p>
          </div>
        </div>
        <button class="sv3-btn sv3-btn-primary" style="padding:10px 20px" onclick="window.location.href='move-in.html?bookingId=${booking._id}'">Go to Move-In Center <i class="fa-solid fa-arrow-right" style="margin-left:6px"></i></button>
      </div>
    `;
  }

  if (announcements && announcements.length > 0) {
    const annHTML = announcements.map(a => {
      const propName = a.property?.propertyName || "Property Update";
      const date = new Date(a.createdAt).toLocaleDateString("en-IN", { day: '2-digit', month: 'short' });
      return `
        <div style="background:rgba(255,255,255,0.01);border:1px solid var(--sv3-border);padding:14px 16px;border-radius:12px;display:flex;align-items:start;gap:12px;margin-bottom:8px">
          <div style="color:var(--sv3-warning);font-size:16px;margin-top:2px"><i class="fa-solid fa-bullhorn"></i></div>
          <div style="flex:1">
            <div style="display:flex;justify-content:space-between;align-items:baseline">
              <strong style="font-size:12px;color:var(--sv3-primary);text-transform:uppercase">${esc(propName)}</strong>
              <span style="font-size:11px;color:var(--sv3-muted)">${date}</span>
            </div>
            <h4 style="font-size:14px;font-weight:700;margin:4px 0 2px 0;color:#fff">${esc(a.title)}</h4>
            <p style="font-size:13px;color:rgba(255,255,255,0.75);line-height:1.45">${esc(a.message)}</p>
          </div>
        </div>
      `;
    }).join("");

    html += `
      <div class="sv3-card" style="padding:20px;border-radius:16px;background:rgba(255,255,255,0.02)">
        <h3 style="font-size:15px;font-weight:800;margin-bottom:12px;color:#fff"><i class="fa-solid fa-bullhorn" style="color:var(--sv3-warning);margin-right:6px"></i> Property Announcements</h3>
        <div>${annHTML}</div>
      </div>
    `;
  }

  container.innerHTML = html;
}

function renderRecommended(properties) {
  const grid = $("recommendedGrid");
  if (!grid) return;
  if (properties.length === 0) {
    grid.innerHTML = `<div class="sv3-empty" style="grid-column:1/-1"><i class="fa-solid fa-house"></i><h3>No properties yet</h3><p>Properties will appear here once available.</p></div>`;
    return;
  }
  grid.innerHTML = properties.map((p) => {
    const name = p.propertyName || p.title || "Campora Property";
    const loc = p.city ? `${p.city}${p.state ? ", " + p.state : ""}` : "Location not specified";
    const rent = p.rent || p.price || 0;
    const rating = p.averageRating || 0;
    const img = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/logos/logo.png";
    const badge = p.verified ? "Verified" : p.featured ? "Featured" : "";
    return `
<div class="sv3-property-card" onclick="window.location.href='/pages/property/property.html?id=${p._id}'" role="article" aria-label="${esc(name)}">
        <div class="sv3-property-image">
          <img src="${img}" alt="${esc(name)}" loading="lazy" onerror="this.src='/assets/logos/logo.png'">
          ${badge ? `<span class="sv3-property-badge">${badge}</span>` : ""}
          <button class="sv3-save-btn" onclick="event.stopPropagation();window.toggleSave('${p._id}', this)" aria-label="Save ${esc(name)}"><i class="fa-${p.isSaved ? "solid" : "regular"} fa-heart"></i></button>
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

function renderRecentBookings(bookings) {
  const list = $("recentBookings");
  if (!list) return;
  if (bookings.length === 0) {
    list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-calendar-check"></i><p>No bookings yet</p></div>`;
    return;
  }
  list.innerHTML = bookings.map((b) => {
    const prop = b.propertyId || {};
    const name = prop.propertyName || b.propertyName || "Property";
    const status = b.bookingStatus || "pending";
    const color = ["confirmed", "checked-in"].includes(status) ? "success" : ["cancelled", "checked-out"].includes(status) ? "danger" : "warning";
    return `
<div class="sv3-list-item" style="cursor:pointer" onclick="window.location.href='bookings.html'">
        <div class="sv3-list-item-icon"><i class="fa-solid fa-bed"></i></div>
        <div class="sv3-list-item-body">
          <div class="sv3-list-item-title">${esc(name)}</div>
          <div class="sv3-list-item-sub">${b.checkIn ? new Date(b.checkIn).toLocaleDateString() : ""}</div>
        </div>
        <span class="sv3-pill sv3-pill-${color}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>`;
  }).join("");
}

function renderRecentNotifications(notifications) {
  const list = $("recentNotifications");
  if (!list) return;
  if (notifications.length === 0) {
    list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-bell"></i><p>No notifications</p></div>`;
    return;
  }
  list.innerHTML = notifications.map((n) => {
    return `
<div class="sv3-list-item" style="cursor:pointer" onclick="window.location.href='notifications.html'">
        <div class="sv3-list-item-icon"><i class="fa-solid fa-bell"></i></div>
        <div class="sv3-list-item-body">
          <div class="sv3-list-item-title">${esc(n.title || "Notification")}</div>
          <div class="sv3-list-item-sub">${esc(n.message || "")} · ${timeAgo(n.createdAt)}</div>
        </div>
      </div>`;
  }).join("");
}
