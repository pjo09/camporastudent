// =====================================================
// CAMPORA OWNER MAINTENANCE V3
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  requestsBody: $("requestsBody"),
  emptyState: $("emptyState"),
  maintenanceSearch: $("maintenanceSearch"),
  filterBtns: document.querySelectorAll(".v3-filter-btn"),
  openCount: $("openCount"),
  assignedCount: $("assignedCount"),
  inProgressCount: $("inProgressCount"),
  resolvedCount: $("resolvedCount"),
  urgentCount: $("urgentCount"),
  rejectedCount: $("rejectedCount"),
  newRequestBtn: $("newRequestBtn"),
  newRequestModal: $("newRequestModal"),
  closeNewRequestModal: $("closeNewRequestModal"),
  newRequestForm: $("newRequestForm"),
  reqProperty: $("reqProperty"),
  reqTitle: $("reqTitle"),
  reqCategory: $("reqCategory"),
  reqPriority: $("reqPriority"),
  reqDesc: $("reqDesc"),
  reqAssignedTo: $("reqAssignedTo"),
  statusModal: $("statusModal"),
  closeStatusModal: $("closeStatusModal"),
  statusModalContent: $("statusModalContent"),
};

let requests = [];
let currentFilter = "all";
let properties = [];

// =====================================================
// INIT
// =====================================================

initShell("Maintenance");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadRequests();
  loadStats();
  loadProperties();
});

function setupListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderRequests();
    });
  });

  DOM.maintenanceSearch?.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    renderRequests(term);
  });

  DOM.newRequestBtn?.addEventListener("click", () => DOM.newRequestModal.classList.add("active"));
  DOM.closeNewRequestModal?.addEventListener("click", () => DOM.newRequestModal.classList.remove("active"));
  DOM.newRequestModal?.addEventListener("click", (e) => { if (e.target === DOM.newRequestModal) DOM.newRequestModal.classList.remove("active"); });
  DOM.newRequestForm?.addEventListener("submit", handleNewRequest);

  DOM.closeStatusModal?.addEventListener("click", () => DOM.statusModal.classList.remove("active"));
  DOM.statusModal?.addEventListener("click", (e) => { if (e.target === DOM.statusModal) DOM.statusModal.classList.remove("active"); });
}

// =====================================================
// LOAD
// =====================================================

async function loadRequests() {
  DOM.requestsBody.innerHTML = `<tr><td colspan="8" class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading requests...</td></tr>`;

  try {
    const data = await apiFetch("/owner/maintenance");
    requests = data.requests || [];
    renderRequests();
  } catch (err) {
    console.error("Maintenance load error:", err);
    DOM.requestsBody.innerHTML = `<tr><td colspan="8" class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load</h3><p>${err.message}</p></td></tr>`;
  }
}

async function loadStats() {
  try {
    const data = await apiFetch("/owner/maintenance/stats/summary");
    const s = data.statistics || {};
    if (DOM.openCount) DOM.openCount.textContent = s.open || 0;
    if (DOM.assignedCount) DOM.assignedCount.textContent = s.assigned || 0;
    if (DOM.inProgressCount) DOM.inProgressCount.textContent = s.inProgress || 0;
    if (DOM.resolvedCount) DOM.resolvedCount.textContent = s.resolved || 0;
    if (DOM.urgentCount) DOM.urgentCount.textContent = s.urgent || 0;
    if (DOM.rejectedCount) DOM.rejectedCount.textContent = s.rejected || 0;
  } catch (err) { /* silent */ }
}

async function loadProperties() {
  try {
    const data = await apiFetch("/owner/properties?limit=100");
    properties = data.properties || [];
    if (DOM.reqProperty) {
      DOM.reqProperty.innerHTML = properties.map((p) => `<option value="${p._id}">${p.propertyName || "Property"}</option>`).join("");
    }
  } catch (err) { /* silent */ }
}

// =====================================================
// RENDER
// =====================================================

function renderRequests(searchTerm = "") {
  let filtered = requests;
  if (currentFilter !== "all") filtered = filtered.filter((r) => r.status === currentFilter);
  if (searchTerm) {
    filtered = filtered.filter((r) => {
      const title = (r.title || "").toLowerCase();
      const prop = (r.propertyId?.propertyName || "").toLowerCase();
      return title.includes(searchTerm) || prop.includes(searchTerm);
    });
  }

  if (filtered.length === 0) {
    DOM.requestsBody.innerHTML = "";
    DOM.emptyState.style.display = "block";
    return;
  }

  DOM.emptyState.style.display = "none";
  DOM.requestsBody.innerHTML = "";

  filtered.forEach((r) => {
    const property = r.propertyId || {};
    const student = r.studentId || {};
    const statusColor = r.status === "resolved" ? "success" : r.status === "rejected" ? "danger" : r.status === "in-progress" ? "info" : r.status === "assigned" ? "purple" : "warning";
    const priorityColor = r.priority === "Urgent" ? "danger" : r.priority === "High" ? "warning" : "info";

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td style="font-weight:600">${r.title || "Request"}</td>
      <td style="font-size:13px">${property.propertyName || "—"}</td>
      <td style="font-size:13px">${r.category || "Other"}</td>
      <td><span class="v3-pill v3-pill-${priorityColor}">${r.priority || "Medium"}</span></td>
      <td><span class="v3-pill v3-pill-${statusColor}">${(r.status || "open").replace("-", " ")}</span></td>
      <td style="font-size:13px">${student.name || "—"}</td>
      <td style="font-size:13px">${r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "—"}</td>
      <td>
        <div style="display:flex;gap:6px">
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="status" data-id="${r._id}" title="Update Status"><i class="fa-solid fa-arrow-right-arrow-left"></i></button>
          <button class="v3-btn v3-btn-success v3-btn-sm" data-action="resolve" data-id="${r._id}" title="Mark Resolved"><i class="fa-solid fa-check"></i></button>
        </div>
      </td>
    `;

    tr.querySelector("[data-action='status']")?.addEventListener("click", () => openStatusModal(r));
    tr.querySelector("[data-action='resolve']")?.addEventListener("click", () => updateStatus(r._id, "resolved"));

    DOM.requestsBody.appendChild(tr);
  });
}

// =====================================================
// STATUS MODAL
// =====================================================

function openStatusModal(req) {
  DOM.statusModalContent.innerHTML = `
    <p style="color:var(--v3-muted);margin-bottom:16px"><strong>${req.title}</strong> — ${req.propertyId?.propertyName || ""}</p>
    <div class="v3-form-group">
      <label>Status</label>
      <select id="statusSelect">
        <option value="open" ${req.status === "open" ? "selected" : ""}>Open</option>
        <option value="assigned" ${req.status === "assigned" ? "selected" : ""}>Assigned</option>
        <option value="in-progress" ${req.status === "in-progress" ? "selected" : ""}>In Progress</option>
        <option value="resolved" ${req.status === "resolved" ? "selected" : ""}>Resolved</option>
        <option value="rejected" ${req.status === "rejected" ? "selected" : ""}>Rejected</option>
      </select>
    </div>
    <div class="v3-form-group">
      <label>Assigned To</label>
      <input type="text" id="assignedToInput" value="${req.assignedTo || ""}" placeholder="Technician name">
    </div>
    <div class="v3-form-group" id="rejectReasonGroup" style="display:none">
      <label>Rejection Reason</label>
      <textarea id="rejectReason" rows="2" placeholder="Why rejected?"></textarea>
    </div>
    <button class="v3-btn v3-btn-primary" style="width:100%" id="saveStatusBtn">Save Status</button>
  `;

  const statusSelect = DOM.statusModalContent.querySelector("#statusSelect");
  const rejectReasonGroup = DOM.statusModalContent.querySelector("#rejectReasonGroup");
  statusSelect.addEventListener("change", () => {
    rejectReasonGroup.style.display = statusSelect.value === "rejected" ? "block" : "none";
  });

  DOM.statusModalContent.querySelector("#saveStatusBtn").addEventListener("click", () => {
    const status = statusSelect.value;
    const assignedTo = DOM.statusModalContent.querySelector("#assignedToInput").value;
    const reason = DOM.statusModalContent.querySelector("#rejectReason").value;
    updateStatus(req._id, status, assignedTo, reason);
  });

  DOM.statusModal.classList.add("active");
}

async function updateStatus(id, status, assignedTo, reason) {
  try {
    await apiFetch(`/owner/maintenance/${id}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status, assignedTo, reason }),
    });
    showToast("Request updated successfully", "success");
    DOM.statusModal.classList.remove("active");
    loadRequests();
    loadStats();
  } catch (err) {
    showToast("Failed to update: " + err.message, "error");
  }
}

// =====================================================
// NEW REQUEST
// =====================================================

async function handleNewRequest(e) {
  e.preventDefault();
  const btn = DOM.newRequestForm.querySelector("button[type='submit']");
  btn.disabled = true;

  try {
    await apiFetch("/owner/maintenance", {
      method: "POST",
      body: JSON.stringify({
        propertyId: DOM.reqProperty.value,
        title: DOM.reqTitle.value,
        category: DOM.reqCategory.value,
        priority: DOM.reqPriority.value,
        description: DOM.reqDesc.value,
        assignedTo: DOM.reqAssignedTo.value,
      }),
    });
    showToast("Maintenance request created", "success");
    DOM.newRequestForm.reset();
    DOM.newRequestModal.classList.remove("active");
    loadRequests();
    loadStats();
  } catch (err) {
    showToast("Failed to create request: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Maintenance V3 initialised");
