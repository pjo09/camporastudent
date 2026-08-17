// =====================================================
// CAMPORA OWNER DASHBOARD V3 — PREMIUM COMMAND CENTER
// Phase 5: Full premium dashboard logic
// =====================================================

import { initShell, apiFetch, showToast, $, formatCurrency, formatDate, timeAgo } from "./owner-shell.js";

const DOM = {
  heroName: $("heroName"),
  unreadNotifications: $("unreadNotifications"),

  // Stats
  statsSkeleton: $("statsSkeleton"),
  statsGrid: $("statsGrid"),
  totalProperties: $("totalProperties"),
  approvedCount: $("approvedCount"),
  activeStudents: $("activeStudents"),
  occupancy: $("occupancy"),
  occupiedBeds: $("occupiedBeds"),
  totalBeds: $("totalBeds"),
  monthlyRevenue: $("monthlyRevenue"),
  todayRevenue: $("todayRevenue"),
  pendingBookings: $("pendingBookings"),
  todayCheckIns: $("todayCheckIns"),
  todayCheckOuts: $("todayCheckOuts"),
  pendingReviews: $("pendingReviews"),
  pendingMaintenance: $("pendingMaintenance"),
  urgentMaintenance: $("urgentMaintenance"),
  pendingResidentRequests: $("pendingResidentRequests"),

  // Revenue summary strip
  revToday: $("revToday"),
  revMonth: $("revMonth"),
  revTotal: $("revTotal"),
  revAvg: $("revAvg"),

  // Hero occupancy ring
  heroOccupancyRing: $("heroOccupancyRing"),
  heroOccupancyValue: $("heroOccupancyValue"),

  // Occupancy panel
  occupancyRing: $("occupancyRing"),
  occupancyRingValue: $("occupancyRingValue"),
  occupancyBedsFilled: $("occupancyBedsFilled"),
  occupancyBedsTotal: $("occupancyBedsTotal"),
  occupancyApproved: $("occupancyApproved"),
  occupancyPending: $("occupancyPending"),

  // Booking summary
  bookPending: $("bookPending"),
  bookConfirmed: $("bookConfirmed"),
  bookCheckedIn: $("bookCheckedIn"),
  bookCheckedOut: $("bookCheckedOut"),
  bookCancelled: $("bookCancelled"),
  bookTotal: $("bookTotal"),

  // Charts
  revenueChart: $("revenueChart"),
  bookingsChart: $("bookingsChart"),
  occupancyChart: $("occupancyChart"),

  // Top properties
  topPropertiesList: $("topPropertiesList"),

  // Pending approvals
  approvalBookings: $("approvalBookings"),
  approvalProperties: $("approvalProperties"),
  approvalReviews: $("approvalReviews"),
  approvalMaintenance: $("approvalMaintenance"),

  // Maintenance overview
  maintenanceOverview: $("maintenanceOverview"),

  // Review summary
  reviewSummary: $("reviewSummary"),

  // Activity
  activityList: $("activityList"),
  studentActivityList: $("studentActivityList"),

  // Lists
  recentBookingsBody: $("recentBookingsBody"),
  recentReviewsList: $("recentReviewsList"),
  recentNotificationsList: $("recentNotificationsList"),
};

// =====================================================
// INIT
// =====================================================

initShell("Command Center");

const ownerUser = (await import("./session.js")).getUser();

function initDashboard() {
  if (DOM.heroName) DOM.heroName.textContent = (ownerUser?.name || "Owner").split(" ")[0];
  loadDashboard();
  loadRevenueSummary();
  loadMaintenanceOverview();
  loadTopProperties();
  loadBookingSummary();
  loadUnreadCount();
  setupInviteModal();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDashboard);
} else {
  initDashboard();
}

// =====================================================
// LOAD DASHBOARD
// =====================================================

async function loadDashboard() {
  try {
    const data = await apiFetch("/owner/dashboard-v3");
    const stats = data.statistics || {};
    const charts = data.charts || {};

    // Hide skeleton, show stats
    if (DOM.statsSkeleton) DOM.statsSkeleton.style.display = "none";
    if (DOM.statsGrid) DOM.statsGrid.style.display = "grid";

    // Render stats
    if (DOM.totalProperties) DOM.totalProperties.textContent = stats.totalProperties || 0;
    if (DOM.approvedCount) DOM.approvedCount.textContent = stats.approvedProperties || 0;
    if (DOM.activeStudents) DOM.activeStudents.textContent = stats.activeStudents || 0;
    if (DOM.occupancy) DOM.occupancy.textContent = `${stats.occupancy || 0}%`;
    if (DOM.occupiedBeds) DOM.occupiedBeds.textContent = (stats.totalBeds || 0) - (stats.availableBeds || 0);
    if (DOM.totalBeds) DOM.totalBeds.textContent = stats.totalBeds || 0;
    if (DOM.monthlyRevenue) DOM.monthlyRevenue.textContent = formatCurrency(stats.monthlyRevenue || 0);
    if (DOM.todayRevenue) DOM.todayRevenue.textContent = formatCurrency(stats.todayRevenue || 0);
    if (DOM.pendingBookings) DOM.pendingBookings.textContent = stats.pendingBookings || 0;
    if (DOM.todayCheckIns) DOM.todayCheckIns.textContent = stats.todayCheckIns || 0;
    if (DOM.todayCheckOuts) DOM.todayCheckOuts.textContent = stats.todayCheckOuts || 0;
    if (DOM.pendingReviews) DOM.pendingReviews.textContent = stats.pendingReviews || 0;
    if (DOM.pendingMaintenance) DOM.pendingMaintenance.textContent = stats.pendingMaintenance || 0;
    if (DOM.urgentMaintenance) DOM.urgentMaintenance.textContent = stats.urgentMaintenance || 0;
    if (DOM.pendingResidentRequests) DOM.pendingResidentRequests.textContent = stats.pendingResidentRequests || 0;

    // Occupancy rings
    renderOccupancyRing(DOM.heroOccupancyRing, DOM.heroOccupancyValue, stats.occupancy || 0);
    renderOccupancyRing(DOM.occupancyRing, DOM.occupancyRingValue, stats.occupancy || 0);
    if (DOM.occupancyBedsFilled) DOM.occupancyBedsFilled.textContent = (stats.totalBeds || 0) - (stats.availableBeds || 0);
    if (DOM.occupancyBedsTotal) DOM.occupancyBedsTotal.textContent = stats.totalBeds || 0;
    if (DOM.occupancyApproved) DOM.occupancyApproved.textContent = stats.approvedProperties || 0;
    if (DOM.occupancyPending) DOM.occupancyPending.textContent = stats.pendingProperties || 0;

    // Pending approvals
    if (DOM.approvalBookings) DOM.approvalBookings.textContent = stats.pendingBookings || 0;
    if (DOM.approvalProperties) DOM.approvalProperties.textContent = stats.pendingProperties || 0;
    if (DOM.approvalReviews) DOM.approvalReviews.textContent = stats.pendingReviews || 0;
    if (DOM.approvalMaintenance) DOM.approvalMaintenance.textContent = stats.pendingMaintenance || 0;

    // Revenue strip quick fill (today + month from dashboard-v3)
    if (DOM.revToday) DOM.revToday.textContent = formatCurrency(stats.todayRevenue || 0);
    if (DOM.revMonth) DOM.revMonth.textContent = formatCurrency(stats.monthlyRevenue || 0);

    // Render lists
    renderRecentBookings(data.recentBookings || []);
    renderRecentReviews(data.recentReviews || []);
    renderRecentNotifications(data.recentNotifications || []);
    renderActivity(data.recentBookings || [], data.recentReviews || [], data.recentNotifications || []);
    renderStudentActivity(data.recentBookings || []);
    renderReviewSummary(data.recentReviews || []);
    renderPendingBookingsChart(stats);

    // Render charts
    renderCharts(charts, stats);
  } catch (err) {
    console.error("Dashboard unread error:", err);
  }
}

// =====================================================
// INVITE MODAL FLOW
// =====================================================
function setupInviteModal() {
  const quickBtn = $("inviteResidentQuickBtn");
  const modal = $("inviteResidentModal");
  const closeBtn = $("closeInviteModal");
  const select = $("invitePropertySelect");
  const generateBtn = $("generateInviteBtn");
  const resultDiv = $("inviteResult");
  const linkInput = $("inviteLinkInput");
  const copyBtn = $("copyInviteLinkBtn");
  const qrCanvas = $("inviteQrCanvas");

  if (!quickBtn || !modal) return;

  quickBtn.addEventListener("click", async () => {
    modal.style.display = "flex";
    resultDiv.style.display = "none";
    
    try {
      select.innerHTML = '<option value="" disabled selected>Loading properties...</option>';
      const data = await apiFetch("/owner/properties?limit=100");
      const props = data.properties || [];
      if (props.length === 0) {
        select.innerHTML = '<option value="" disabled selected>No properties found.</option>';
        return;
      }
      select.innerHTML = '<option value="" disabled selected>Select a property</option>' + 
        props.map(p => `<option value="${p._id}">${p.propertyName}</option>`).join("");
    } catch (err) {
      select.innerHTML = '<option value="" disabled selected>Error loading properties.</option>';
      showToast("Failed to load properties: " + err.message, "error");
    }
  });

  closeBtn?.addEventListener("click", () => {
    modal.style.display = "none";
  });

  modal.addEventListener("click", (e) => {
    if (e.target === modal) {
      modal.style.display = "none";
    }
  });

  generateBtn?.addEventListener("click", async () => {
    const propertyId = select.value;
    if (!propertyId) {
      showToast("Please select a property first.", "warning");
      return;
    }

    if (typeof QRCode === "undefined") {
      showToast("QR Code library is not loaded. Please refresh the page.", "error");
      return;
    }

    generateBtn.disabled = true;
    generateBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating invite...';

    try {
      const data = await apiFetch(`/owner/properties/${propertyId}/resident-invite`, {
        method: "POST"
      });

      const invite = data.invite;
      const inviteUrl = `${window.location.origin}/join-pg/${invite.token}`;

      linkInput.value = inviteUrl;
      resultDiv.style.display = "block";

      if (qrCanvas) {
        QRCode.toCanvas(qrCanvas, inviteUrl, {
          width: 160,
          margin: 1,
          color: {
            dark: "#000000",
            light: "#ffffff"
          }
        }, (err) => {
          if (err) {
            console.error("QR Code generation error:", err);
            showToast("Failed to render QR Code: " + err.message, "error");
          }
        });
      }
      
      showToast("Invite link generated successfully!", "success");
    } catch (err) {
      showToast("Failed to generate invite: " + err.message, "error");
    } finally {
      generateBtn.disabled = false;
      generateBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Invite Link';
    }
  });

  copyBtn?.addEventListener("click", () => {
    linkInput.select();
    linkInput.setSelectionRange(0, 99999);
    navigator.clipboard.writeText(linkInput.value);
    showToast("Invite link copied to clipboard!", "success");
  });

  const downloadBtn = $("downloadQrBtn");
  downloadBtn?.addEventListener("click", () => {
    if (!qrCanvas) return;
    try {
      const url = qrCanvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `invite-qr-${select.value || "code"}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      showToast("QR Code downloaded successfully!", "success");
    } catch (err) {
      showToast("Failed to download QR Code: " + err.message, "error");
    }
  });
}

// =====================================================
// OCCUPANCY RING (conic-gradient gauge)
// =====================================================

function renderOccupancyRing(ringEl, valueEl, pct) {
  if (!ringEl) return;
  const safe = Math.max(0, Math.min(100, Math.round(pct || 0)));
  ringEl.style.setProperty("--data-pct", safe);
  if (valueEl) valueEl.textContent = `${safe}%`;
}

// =====================================================
// REVENUE SUMMARY (uses finance summary + dashboard)
// =====================================================

async function loadRevenueSummary() {
  try {
    const data = await apiFetch("/owner/finance/summary");
    const summary = data.summary || {};
    const totalCollected = summary.totalCollected || 0;
    const paidCount = summary.totalPaidCount || 0;

    if (DOM.revTotal) DOM.revTotal.textContent = formatCurrency(totalCollected);
    if (DOM.revAvg) {
      const avg = paidCount > 0 ? Math.round(totalCollected / paidCount) : 0;
      DOM.revAvg.textContent = formatCurrency(avg);
    }
  } catch (err) {
    console.error("Revenue summary error:", err);
    if (DOM.revTotal) DOM.revTotal.textContent = "—";
    if (DOM.revAvg) DOM.revAvg.textContent = "—";
  }
}

// =====================================================
// BOOKING SUMMARY (counts from bookings endpoint)
// =====================================================

async function loadBookingSummary() {
  try {
    const data = await apiFetch("/owner/booking-statistics");
    const stats = data.statistics || {};

    if (DOM.bookPending) DOM.bookPending.textContent = stats.pending || 0;
    if (DOM.bookConfirmed) DOM.bookConfirmed.textContent = stats.confirmed || 0;
    if (DOM.bookCheckedIn) DOM.bookCheckedIn.textContent = stats.checkedIn || 0;
    if (DOM.bookCheckedOut) DOM.bookCheckedOut.textContent = stats.checkedOut || 0;
    if (DOM.bookCancelled) DOM.bookCancelled.textContent = stats.cancelled || 0;
    if (DOM.bookTotal) DOM.bookTotal.textContent = stats.total || 0;
  } catch (err) {
    console.error("Booking summary error:", err);
  }
}

// =====================================================
// TOP PROPERTIES (property performance)
// =====================================================

async function loadTopProperties() {
  if (!DOM.topPropertiesList) return;
  try {
    const data = await apiFetch("/owner/top-properties");
    const props = data.properties || [];

    if (props.length === 0) {
      DOM.topPropertiesList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-building"></i><p>Add properties to see performance</p></div>`;
      return;
    }

    DOM.topPropertiesList.innerHTML = props.slice(0, 5).map((p, i) => {
      const metric = p.views || 0;
      const rating = p.averageRating || 0;
      return `
        <div class="od-top-prop">
          <div class="od-top-prop-rank">${i + 1}</div>
          <div class="od-top-prop-info">
            <strong>${p.propertyName || "Property"}</strong>
            <span>${p.city || ""}${p.propertyType ? " • " + p.propertyType : ""}</span>
          </div>
          <div class="od-top-prop-metric">
            <strong>${metric}</strong><span>views</span>
          </div>
          <div class="od-top-prop-metric" style="margin-left:12px">
            <strong style="color:#fbbf24">${rating ? rating.toFixed(1) : "—"}</strong><span>rating</span>
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    console.error("Top properties error:", err);
    DOM.topPropertiesList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-building"></i><p>Could not load property performance</p></div>`;
  }
}

// =====================================================
// MAINTENANCE OVERVIEW
// =====================================================

async function loadMaintenanceOverview() {
  if (!DOM.maintenanceOverview) return;
  try {
    const data = await apiFetch("/owner/maintenance/stats/summary");
    const stats = data.statistics || {};
    const open = stats.open || 0;
    const inProgress = (stats.inProgress || 0) + (stats.assigned || 0);
    const urgent = stats.urgent || 0;
    const resolved = stats.resolved || 0;

    DOM.maintenanceOverview.innerHTML = `
      <div class="od-maint-card mt-open"><strong>${open}</strong><span>Open</span></div>
      <div class="od-maint-card mt-progress"><strong>${inProgress}</strong><span>In progress</span></div>
      <div class="od-maint-card mt-urgent"><strong>${urgent}</strong><span>Urgent</span></div>
      <div class="od-maint-card mt-resolved"><strong>${resolved}</strong><span>Resolved</span></div>
    `;
  } catch (err) {
    console.error("Maintenance overview error:", err);
    DOM.maintenanceOverview.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-screwdriver-wrench"></i><p>No maintenance data</p></div>`;
  }
}

// =====================================================
// REVIEW SUMMARY
// =====================================================

function renderReviewSummary(reviews) {
  if (!DOM.reviewSummary) return;

  if (reviews.length === 0) {
    DOM.reviewSummary.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-star"></i><p>No reviews yet</p></div>`;
    return;
  }

  const total = reviews.length;
  const avg = (reviews.reduce((s, r) => s + (r.rating || 0), 0) / total).toFixed(1);
  const stars = "★".repeat(Math.round(avg)) + "☆".repeat(5 - Math.round(avg));

  const latest = reviews.slice(0, 2).map((r) => {
    const user = r.user || {};
    return `
      <div class="od-review-mini">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>${user.name || "Student"}</strong>
          <span style="color:#fbbf24;font-size:13px">${stars}</span>
        </div>
        <p>${r.comment || "No comment"}</p>
      </div>`;
  }).join("");

  DOM.reviewSummary.innerHTML = `
    <div class="od-review-overall">
      <div><div class="od-review-score">${avg}</div><div class="od-review-stars">${stars}</div></div>
      <div class="od-review-meta">Based on ${total} review(s)</div>
    </div>
    <div class="od-review-list">${latest}</div>
  `;
}

// =====================================================
// UNIFIED ACTIVITY TIMELINE
// =====================================================

function renderActivity(bookings, reviews, notifications) {
  if (!DOM.activityList) return;

  const items = [];

  (bookings || []).forEach((b) => {
    const prop = b.propertyId || {};
    const student = b.userId || {};
    items.push({
      type: "booking",
      icon: "fa-calendar-check",
      title: "New booking",
      desc: `${student.name || "Student"} booked ${prop.propertyName || "a property"}`,
      time: b.createdAt
    });
  });

  (reviews || []).forEach((r) => {
    const user = r.user || {};
    items.push({
      type: "review",
      icon: "fa-star",
      title: "New review",
      desc: `${user.name || "Student"} left a ${r.rating || 0}-star review`,
      time: r.createdAt
    });
  });

  (notifications || []).forEach((n) => {
    items.push({
      type: "notification",
      icon: "fa-bell",
      title: n.title || "Notification",
      desc: n.message || "",
      time: n.createdAt
    });
  });

  items.sort((a, b) => new Date(b.time || 0) - new Date(a.time || 0));

  if (items.length === 0) {
    DOM.activityList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-bolt"></i><p>No recent activity</p></div>`;
    return;
  }

  DOM.activityList.innerHTML = items.slice(0, 10).map((item) => `
    <div class="od-activity-item">
      <div class="od-activity-icon type-${item.type}"><i class="fa-solid ${item.icon}"></i></div>
      <div class="od-activity-content">
        <div class="od-activity-title">${item.title}</div>
        <div class="od-activity-desc">${item.desc}</div>
        <div class="od-activity-time">${timeAgo(item.time)}</div>
      </div>
    </div>
  `).join("");
}

// =====================================================
// RECENT STUDENT ACTIVITY
// =====================================================

function renderStudentActivity(bookings) {
  if (!DOM.studentActivityList) return;

  if (bookings.length === 0) {
    DOM.studentActivityList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-user-graduate"></i><p>No student activity yet</p></div>`;
    return;
  }

  DOM.studentActivityList.innerHTML = bookings.slice(0, 6).map((b) => {
    const student = b.userId || {};
    const prop = b.propertyId || {};
    const name = student.name || "Student";
    const status = b.bookingStatus || "pending";
    const statusColor = ["confirmed", "checked-in"].includes(status) ? "#22c55e" : ["cancelled", "checked-out"].includes(status) ? "#ef4444" : "#f59e0b";
    return `
      <div class="od-student-item">
        <div class="od-student-avatar">${name.charAt(0).toUpperCase()}</div>
        <div class="od-student-item-info">
          <strong>${name}</strong>
          <span>${prop.propertyName || ""}${prop.city ? " • " + prop.city : ""}</span>
        </div>
        <span class="v3-pill" style="background:${statusColor}22;color:${statusColor}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
      </div>`;
  }).join("");
}

// =====================================================
// CHART.JS RENDER
// =====================================================

function renderCharts(charts, stats) {
  const revenueSeries = charts.monthlyRevenueSeries || [];
  const bookingsSeries = charts.monthlyBookingsSeries || [];

  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const labels = Array.from({ length: 12 }, (_, i) => monthNames[i]);

  const revenueData = new Array(12).fill(0);
  revenueSeries.forEach((item) => {
    const idx = (item._id.month || 1) - 1;
    revenueData[idx] = item.revenue || 0;
  });

  const bookingsData = new Array(12).fill(0);
  bookingsSeries.forEach((item) => {
    const idx = (item._id.month || 1) - 1;
    bookingsData[idx] = item.bookings || 0;
  });

  if (window.Chart) {
    if (DOM.revenueChart) {
      new Chart(DOM.revenueChart, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Revenue (₹)",
            data: revenueData,
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
            data: bookingsData,
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

    // Occupancy trend chart (uses monthly bookings as proxy + derived occupancy)
    if (DOM.occupancyChart) {
      const occupancyData = bookingsData.map(() => stats.occupancy || 0);
      new Chart(DOM.occupancyChart, {
        type: "line",
        data: {
          labels,
          datasets: [{
            label: "Occupancy %",
            data: occupancyData,
            borderColor: "#06b6d4",
            backgroundColor: "rgba(6,182,212,.15)",
            fill: true,
            tension: 0.4,
          }],
        },
        options: {
          responsive: true,
          plugins: { legend: { display: false } },
          scales: {
            x: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#94a3b8" } },
            y: { grid: { color: "rgba(255,255,255,.05)" }, ticks: { color: "#94a3b8" }, min: 0, max: 100 },
          },
        },
      });
    }
  }
}

// =====================================================
// RECENT BOOKINGS
// =====================================================

function renderRecentBookings(bookings) {
  if (!DOM.recentBookingsBody) return;

  if (bookings.length === 0) {
    DOM.recentBookingsBody.innerHTML = `<tr><td colspan="5" class="v3-empty" style="padding:30px"><i class="fa-solid fa-calendar-check"></i><p>No bookings yet</p></td></tr>`;
    return;
  }

  DOM.recentBookingsBody.innerHTML = bookings.map((b) => {
    const prop = b.propertyId || {};
    const student = b.userId || {};
    const name = prop.propertyName || b.propertyName || "Property";
    const studentName = student.name || "Student";
    const date = b.createdAt ? new Date(b.createdAt).toLocaleDateString() : "";
    const price = b.price || 0;
    const status = b.bookingStatus || "pending";
    const statusColor = ["confirmed", "checked-in"].includes(status) ? "success" : ["cancelled", "checked-out"].includes(status) ? "danger" : "warning";
    return `
      <tr>
        <td style="font-weight:600">${name}</td>
        <td>${studentName}</td>
        <td>${date}</td>
        <td>${formatCurrency(price)}</td>
        <td><span class="v3-pill v3-pill-${statusColor}">${status.charAt(0).toUpperCase() + status.slice(1)}</span></td>
      </tr>`;
  }).join("");
}

// =====================================================
// RECENT REVIEWS
// =====================================================

function renderRecentReviews(reviews) {
  if (!DOM.recentReviewsList) return;

  if (reviews.length === 0) {
    DOM.recentReviewsList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-star"></i><p>No reviews yet</p></div>`;
    return;
  }

  DOM.recentReviewsList.innerHTML = reviews.map((r) => {
    const user = r.user || {};
    const prop = r.property || {};
    const stars = "★".repeat(Math.max(0, Math.min(5, r.rating || 0))) + "☆".repeat(Math.max(0, 5 - (r.rating || 0)));
    return `
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04);margin-bottom:10px">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong>${user.name || "Student"}</strong>
          <span style="color:#fbbf24;font-size:14px">${stars}</span>
        </div>
        <p style="color:var(--v3-muted);font-size:13px;margin-top:6px;line-height:1.5">${r.comment || ""}</p>
        <p style="color:var(--v3-muted);font-size:12px;margin-top:6px">${prop.propertyName || ""}</p>
      </div>`;
  }).join("");
}

// =====================================================
// RECENT NOTIFICATIONS
// =====================================================

function renderRecentNotifications(notifications) {
  if (!DOM.recentNotificationsList) return;

  if (notifications.length === 0) {
    DOM.recentNotificationsList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-bell"></i><p>No notifications</p></div>`;
    return;
  }

  DOM.recentNotificationsList.innerHTML = notifications.map((n) => {
    const time = n.createdAt ? timeAgo(n.createdAt) : "";
    return `
      <div style="padding:12px;border-radius:14px;background:rgba(255,255,255,.04);margin-bottom:10px;display:flex;gap:12px;align-items:flex-start">
        <i class="fa-solid fa-bell" style="color:#60a5fa;margin-top:3px"></i>
        <div>
          <strong style="font-size:14px">${n.title || "Notification"}</strong>
          <p style="color:var(--v3-muted);font-size:13px;margin-top:4px;line-height:1.5">${n.message || ""}</p>
          <span style="color:var(--v3-muted);font-size:12px">${time}</span>
        </div>
      </div>`;
  }).join("");
}

// =====================================================
// HELPER: populate pending bookings chart toggle (placeholder logic)
// =====================================================

function renderPendingBookingsChart(stats) {
  // Reserved for future drill-down; values already reflected in stat cards & approvals.
  void stats;
}

// =====================================================
// UNREAD COUNT
// =====================================================

async function loadUnreadCount() {
  try {
    const data = await apiFetch("/owner/messages/unread-count");
    if (DOM.unreadNotifications) {
      const count = data.unreadCount || 0;
      DOM.unreadNotifications.textContent = count;
      DOM.unreadNotifications.style.display = count > 0 ? "inline-flex" : "none";
    }
  } catch (err) {
    // silent
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Command Center V3 initialised");
