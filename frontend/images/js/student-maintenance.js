// =====================================================
// CAMPORA STUDENT V3 - MAINTENANCE
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, esc, timeAgo, showToast } from "./student-utils.js";

let allRequests = [];
let currentFilter = "all";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  setupTabs();
  loadRequests();
  loadMyProperties();
  setupModal();
});

function setupTabs() {
  document.querySelectorAll("#maintenanceTabs .sv3-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      currentFilter = tab.dataset.filter;
      document.querySelectorAll("#maintenanceTabs .sv3-tab").forEach((t) => t.classList.toggle("active", t === tab));
      renderList();
    });
  });
}

async function loadRequests() {
  const list = $("maintenanceList");
  if (!list) return;
  try {
const data = await apiFetch("/student/maintenance");
    allRequests = data.requests || [];
    renderList();
  } catch (err) {
    list.innerHTML = `<div class="sv3-error"><i class="fa-solid fa-triangle-exclamation"></i><h3>Failed to load requests</h3><p>${esc(err.message)}</p></div>`;
  }
}

// Populate the property dropdown from the student's active bookings
async function loadMyProperties() {
  const select = $("reqProperty");
  if (!select) return;
  try {
    const data = await apiFetch("/student/bookings");
    const bookings = data.bookings || [];
    const seen = new Set();
    bookings.forEach((b) => {
      const prop = b.propertyId || {};
      if (prop._id && !seen.has(prop._id)) {
        seen.add(prop._id);
        const opt = document.createElement("option");
        opt.value = prop._id;
        opt.textContent = prop.propertyName || "Property";
        select.appendChild(opt);
      }
    });
    if (seen.size === 0) {
      select.innerHTML = `<option value="">No booked properties</option>`;
    }
  } catch (err) {
    select.innerHTML = `<option value="">Unable to load properties</option>`;
  }
}

function renderList() {
  const list = $("maintenanceList");
  if (!list) return;
  const filtered = currentFilter === "all" ? allRequests : allRequests.filter((r) => r.status === currentFilter);

  if (filtered.length === 0) {
    list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-screwdriver-wrench"></i><h3>No maintenance requests</h3><p>${currentFilter === "all" ? "Report an issue and track it here." : "No " + currentFilter + " requests."}</p></div>`;
    return;
  }

  list.innerHTML = filtered.map((r) => {
    const prop = r.propertyId || {};
    const color = r.status === "resolved" ? "success" : ["cancelled", "rejected"].includes(r.status) ? "danger" : ["assigned", "in-progress"].includes(r.status) ? "warning" : "info";
    return `
      <div class="sv3-list-item">
        <div class="sv3-list-item-icon"><i class="fa-solid fa-wrench"></i></div>
        <div class="sv3-list-item-body">
          <div class="sv3-list-item-title">${esc(r.title || "Maintenance Request")}</div>
          <div class="sv3-list-item-sub">${esc(prop.propertyName || "")} · ${esc(r.category || "Other")} · Priority: ${esc(r.priority || "Medium")}</div>
          <div class="sv3-list-item-sub">${timeAgo(r.createdAt)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px">
          <span class="sv3-pill sv3-pill-${color}">${(r.status || "open").charAt(0).toUpperCase() + (r.status || "open").slice(1)}</span>
          <span class="sv3-pill sv3-pill-${r.priority === "Urgent" ? "danger" : r.priority === "High" ? "warning" : "info"}">${esc(r.priority || "Medium")}</span>
        </div>
      </div>`;
  }).join("");
}

// =====================================================
// MODAL
// =====================================================

function setupModal() {
  const modal = $("requestModal");
  const openBtn = $("newRequestBtn");
  const closeBtn = $("modalClose");
  if (!modal) return;

  openBtn?.addEventListener("click", () => {
    modal.classList.add("sv3-open");
    modal.setAttribute("aria-hidden", "false");
  });
  closeBtn?.addEventListener("click", closeModal);
  modal.addEventListener("click", (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeModal();
  });

  $("requestForm")?.addEventListener("submit", submitRequest);
}

function closeModal() {
  const modal = $("requestModal");
  if (modal) {
    modal.classList.remove("sv3-open");
    modal.setAttribute("aria-hidden", "true");
  }
}

async function submitRequest(e) {
  e.preventDefault();
  const btn = $("submitRequest");
  if (!btn) return;
  btn.disabled = true;
  try {
    const payload = {
      propertyId: $("reqProperty")?.value || null,
      category: $("reqCategory")?.value || "Other",
      title: $("reqTitle")?.value.trim(),
      description: $("reqDescription")?.value.trim(),
      priority: $("reqPriority")?.value || "Medium",
    };
    if (!payload.title) throw new Error("Title is required");
await apiFetch("/student/maintenance", { method: "POST", body: JSON.stringify(payload) });
    showToast("Maintenance request submitted", "success");
    closeModal();
    e.target.reset();
    loadRequests();
  } catch (err) {
    showToast(err.message || "Unable to submit request", "error");
  } finally {
    btn.disabled = false;
  }
}
