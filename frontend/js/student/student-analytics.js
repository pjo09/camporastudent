// =====================================================
// CAMPORA STUDENT V3 - ANALYTICS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, inr, esc } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  loadAnalytics();
});

async function loadAnalytics() {
  try {
    const data = await apiFetch("/student/analytics");
    const a = data.analytics || {};
    if ($("aTotalBookings")) $("aTotalBookings").textContent = a.totalBookings || 0;
    if ($("aTotalSpent")) $("aTotalSpent").textContent = inr(a.totalSpent || 0);
    if ($("aMaintenance")) $("aMaintenance").textContent = a.totalMaintenance || 0;
    if ($("aCancelled")) $("aCancelled").textContent = a.totalCancelled || 0;

    renderLocations(a.favoriteLocations || []);
    renderMonthly(a.monthly || {});
    renderTimeline(a.bookingTimeline || []);
  } catch (err) {
    const containers = ["favoriteLocations", "monthlySpending", "bookingTimeline"];
    containers.forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = `<div class="sv3-error"><p>${esc(err.message)}</p></div>`;
    });
  }
}

function renderLocations(locations) {
  const el = $("favoriteLocations");
  if (!el) return;
  if (locations.length === 0) {
    el.innerHTML = `<div class="sv3-empty" style="padding:20px"><p>No saved-location data yet.</p></div>`;
    return;
  }
  const max = Math.max(...locations.map((l) => l.count), 1);
  el.innerHTML = locations.map((l) => `
    <div style="margin-bottom:14px">
      <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px"><span>${esc(l.city)}</span><span>${l.count}</span></div>
      <div class="sv3-bar"><div class="sv3-bar-fill" style="width:${(l.count / max) * 100}%"></div></div>
    </div>`).join("");
}

function renderMonthly(monthly) {
  const el = $("monthlySpending");
  if (!el) return;
  const entries = Object.entries(monthly).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);
  if (entries.length === 0) {
    el.innerHTML = `<div class="sv3-empty" style="padding:20px"><p>No spending data yet.</p></div>`;
    return;
  }
  const max = Math.max(...entries.map(([, v]) => v), 1);
  el.innerHTML = entries.map(([key, value]) => {
    const [y, m] = key.split("-");
    const label = `${new Date(`${y}-${m}-01`).toLocaleString("en", { month: "short" })} ${y}`;
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px"><span>${label}</span><span>${inr(value)}</span></div>
        <div class="sv3-bar"><div class="sv3-bar-fill" style="width:${(value / max) * 100}%"></div></div>
      </div>`;
  }).join("");
}

function renderTimeline(timeline) {
  const el = $("bookingTimeline");
  if (!el) return;
  if (timeline.length === 0) {
    el.innerHTML = `<div class="sv3-empty" style="padding:20px"><p>No booking activity yet.</p></div>`;
    return;
  }
  const counts = {};
  timeline.forEach((b) => {
    const key = `${b.year}-${b.month}`;
    counts[key] = (counts[key] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a, b) => a[0].localeCompare(b[0]));
  const max = Math.max(...entries.map(([, v]) => v), 1);
  el.innerHTML = entries.map(([key, v]) => {
    const [y, m] = key.split("-");
    const label = `${new Date(`${y}-${m}-01`).toLocaleString("en", { month: "short" })} ${y}`;
    return `
      <div style="margin-bottom:14px">
        <div style="display:flex;justify-content:space-between;font-size:13.5px;margin-bottom:6px"><span>${label}</span><span>${v} booking${v > 1 ? "s" : ""}</span></div>
        <div class="sv3-bar"><div class="sv3-bar-fill" style="width:${(v / max) * 100}%"></div></div>
      </div>`;
  }).join("");
}
