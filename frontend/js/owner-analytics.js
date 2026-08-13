// =====================================================
// CAMPORA OWNER ANALYTICS V3
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  totalViews: $("totalViews"),
  totalBookings: $("totalBookings"),
  totalEarnings: $("totalEarnings"),
  avgRating: $("avgRating"),
  revenueChart: $("revenueChart"),
  bookingsChart: $("bookingsChart"),
  topPropertiesBody: $("topPropertiesBody"),
};

// =====================================================
// INIT
// =====================================================

initShell("Analytics");

document.addEventListener("DOMContentLoaded", () => {
  init();
});

async function init() {
  await loadOverview();
  await loadCharts();
  loadTopProperties();
}

// =====================================================
// OVERVIEW
// =====================================================

async function loadOverview() {
  try {
    const [dashData, summaryData] = await Promise.all([
      apiFetch("/owner/dashboard"),
      apiFetch("/owner/earnings"),
    ]);

    const s = dashData.statistics || {};
    if (DOM.totalViews) DOM.totalViews.textContent = s.totalViews || 0;
    if (DOM.totalBookings) DOM.totalBookings.textContent = s.totalBookings || 0;
    if (DOM.totalEarnings) DOM.totalEarnings.textContent = `₹${Number(s.earnings || 0).toLocaleString()}`;
  } catch (err) {
    console.error("Overview error:", err);
    showToast("Failed to load analytics overview: " + err.message, "error");
  }
}

// =====================================================
// CHARTS
// =====================================================

async function loadCharts() {
  try {
    const data = await apiFetch("/owner/analytics");
    const monthly = data.monthlyBookings || [];

    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const labels = Array.from({ length: 12 }, (_, i) => monthNames[i]);
    const revenue = new Array(12).fill(0);
    const bookings = new Array(12).fill(0);

    monthly.forEach((item) => {
      const idx = (item._id.month || 1) - 1;
      revenue[idx] = item.revenue || 0;
      bookings[idx] = item.bookings || 0;
    });

    renderCharts(labels, revenue, bookings);
  } catch (err) {
    console.error("Charts error:", err);
    showToast("Failed to load analytics charts: " + err.message, "error");
  }
}

function renderCharts(labels, revenue, bookings) {
  if (!window.Chart) return;

  if (DOM.revenueChart) {
    new Chart(DOM.revenueChart, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: "Revenue (₹)",
          data: revenue,
          borderColor: "#22c55e",
          backgroundColor: "rgba(34,197,94,.15)",
          fill: true,
          tension: 0.4,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#94a3b8" } },
          y: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#94a3b8" } },
        },
      },
    });
  }

  if (DOM.bookingsChart) {
    new Chart(DOM.bookingsChart, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label: "Bookings",
          data: bookings,
          backgroundColor: "rgba(37,99,235,.7)",
          borderRadius: 6,
        }],
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#94a3b8" } },
          y: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#94a3b8" } },
        },
      },
    });
  }
}

// =====================================================
// TOP PROPERTIES
// =====================================================

async function loadTopProperties() {
  DOM.topPropertiesBody.innerHTML = `<tr><td colspan="5" class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading properties...</td></tr>`;

  try {
    const data = await apiFetch("/owner/top-properties");
    const properties = data.properties || [];

    if (properties.length === 0) {
      DOM.topPropertiesBody.innerHTML = `<tr><td colspan="5" class="v3-empty" style="padding:30px"><i class="fa-solid fa-building"></i><p>No properties yet</p></td></tr>`;
      return;
    }

    DOM.topPropertiesBody.innerHTML = properties.map((p) => {
      const statusColor = p.status === "approved" ? "success" : p.status === "rejected" ? "danger" : "warning";
      return `
        <tr>
          <td style="font-weight:700">${p.propertyName || "Property"}</td>
          <td>${p.views || 0}</td>
          <td style="color:#fbbf24">${p.averageRating ? "★ " + Number(p.averageRating).toFixed(1) : "—"}</td>
          <td>${p.totalReviews || 0}</td>
          <td><span class="v3-pill v3-pill-${statusColor}">${(p.status || "pending").toUpperCase()}</span></td>
        </tr>`;
    }).join("");

    // Calculate average rating across top properties
    if (DOM.avgRating) {
      const rated = properties.filter((p) => p.averageRating > 0);
      if (rated.length) {
        const avg = rated.reduce((s, p) => s + p.averageRating, 0) / rated.length;
        DOM.avgRating.textContent = avg.toFixed(1);
      }
    }
  } catch (err) {
    console.error("Top properties error:", err);
    DOM.topPropertiesBody.innerHTML = `<tr><td colspan="5" class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load</h3><p>${err.message}</p></td></tr>`;
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Analytics V3 initialised");
