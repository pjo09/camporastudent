// =====================================================
// CAMPORA OWNER RESIDENTS JS
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  studentsBody: $("studentsBody"),
  emptyState: $("emptyState"),
  studentSearch: $("studentSearch"),
  studentModal: $("studentModal"),
  closeStudentModal: $("closeStudentModal"),
  studentProfileContent: $("studentProfileContent"),
  broadcastBtn: $("broadcastBtn"),
  broadcastModal: $("broadcastModal"),
  closeBroadcastModal: $("closeBroadcastModal"),
  broadcastForm: $("broadcastForm"),
  broadcastText: $("broadcastText"),
};

let allResidents = [];
let currentTab = "active";
let allRequests = [];
const esc = (str) => {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
};

// =====================================================
// INIT
// =====================================================
initShell("Residents");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadResidents();
  loadRequestsCountOnly();
});

async function loadRequestsCountOnly() {
  try {
    const data = await apiFetch("/owner/resident-requests");
    allRequests = data.requests || [];
    const badge = $("requestsCountBadge");
    const pendingCount = allRequests.filter(r => r.status === "PENDING").length;
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }
  } catch (e) {
    console.warn("Failed to prefetch requests count:", e);
  }
}

function setupListeners() {
  DOM.studentSearch?.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    if (currentTab === "active") {
      renderResidents(term);
    } else {
      renderRequests(term);
    }
  });

  DOM.closeStudentModal?.addEventListener("click", () => DOM.studentModal.classList.remove("active"));
  DOM.studentModal?.addEventListener("click", (e) => { if (e.target === DOM.studentModal) DOM.studentModal.classList.remove("active"); });

  DOM.broadcastBtn?.addEventListener("click", () => DOM.broadcastModal.classList.add("active"));
  DOM.closeBroadcastModal?.addEventListener("click", () => DOM.broadcastModal.classList.remove("active"));
  DOM.broadcastModal?.addEventListener("click", (e) => { if (e.target === DOM.broadcastModal) DOM.broadcastModal.classList.remove("active"); });

  DOM.broadcastForm?.addEventListener("submit", handleBroadcast);

  // Tab listeners
  const tabActive = $("tabActiveResidents");
  const tabReq = $("tabVerificationRequests");

  tabActive?.addEventListener("click", () => {
    currentTab = "active";
    tabActive.style.background = "var(--v3-primary)";
    tabActive.style.color = "#fff";
    tabActive.classList.remove("v3-btn-ghost");
    tabReq.style.background = "none";
    tabReq.style.color = "var(--v3-muted)";
    tabReq.classList.add("v3-btn-ghost");
    updateTableHeaders();
    renderResidents();
  });

  tabReq?.addEventListener("click", () => {
    currentTab = "requests";
    tabReq.style.background = "var(--v3-primary)";
    tabReq.style.color = "#fff";
    tabReq.classList.remove("v3-btn-ghost");
    tabActive.style.background = "none";
    tabActive.style.color = "var(--v3-muted)";
    tabActive.classList.add("v3-btn-ghost");
    updateTableHeaders();
    loadRequests();
  });

  // Request modal close
  $("closeRequestModal")?.addEventListener("click", () => {
    $("requestModal").style.display = "none";
  });
  $("requestModal")?.addEventListener("click", (e) => {
    if (e.target === $("requestModal")) {
      $("requestModal").style.display = "none";
    }
  });
}

// =====================================================
// LOAD RESIDENTS
// =====================================================
async function loadResidents() {
  DOM.studentsBody.innerHTML = `<tr><td colspan="8" class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading residents...</td></tr>`;

  try {
    const data = await apiFetch("/owner/residents?limit=100");
    allResidents = data.students || [];
    renderResidents();
  } catch (err) {
    console.error("Residents load error:", err);
    DOM.studentsBody.innerHTML = `<tr><td colspan="8" class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load Residents</h3><p>${err.message}</p></td></tr>`;
  }
}

// =====================================================
// RENDER RESIDENTS
// =====================================================
function renderResidents(searchTerm = "") {
  let filtered = allResidents;
  if (searchTerm) {
    filtered = allResidents.filter((s) => {
      const name = (s.student?.name || s.userId?.name || "").toLowerCase();
      const phone = (s.student?.phone || s.userId?.phone || "").toLowerCase();
      const email = (s.student?.email || s.userId?.email || "").toLowerCase();
      const college = (s.student?.college || s.userId?.college || "").toLowerCase();
      return name.includes(searchTerm) || phone.includes(searchTerm) || email.includes(searchTerm) || college.includes(searchTerm);
    });
  }

  if (filtered.length === 0) {
    DOM.studentsBody.innerHTML = "";
    DOM.emptyState.style.display = "block";
    return;
  }

  DOM.emptyState.style.display = "none";
  DOM.studentsBody.innerHTML = "";

  filtered.forEach((s) => {
    const student = s.student || s.userId || {};
    const property = s.property || s.propertyId || {};
    const booking = s.booking || {};
    const name = student.name || "Student";
    const phone = student.phone || "";
    const email = student.email || "";
    const college = student.college || "";
    const propertyName = property.propertyName || booking.propertyName || "";
    const moveIn = booking.checkIn ? new Date(booking.checkIn).toLocaleDateString("en-IN") : "—";
    const rent = booking.price || 0;
    const status = booking.bookingStatus || "confirmed";
    const statusColor = ["confirmed", "checked-in"].includes(status) ? "success" : "warning";
    const avatar = (name.charAt(0) || "S").toUpperCase();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="v3-avatar" style="width:40px;height:40px;font-size:16px">${avatar}</div>
          <div>
            <strong style="font-size:14px">${name}</strong>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size:13px">${phone || "—"}</div>
        <div style="font-size:12px;color:var(--v3-muted)">${email || ""}</div>
      </td>
      <td style="font-size:13px">${college || "—"}</td>
      <td style="font-size:13px">${propertyName || "—"}</td>
      <td style="font-size:13px">${moveIn}</td>
      <td style="font-weight:700">₹${rent.toLocaleString("en-IN")}</td>
      <td><span class="v3-pill v3-pill-${statusColor}">${(status.charAt(0).toUpperCase() + status.slice(1)).replace("-", " ")}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="profile" data-id="${booking._id}"><i class="fa-solid fa-user-gear"></i></button>
          ${phone ? `<a class="v3-btn v3-btn-success v3-btn-sm" href="tel:${phone}" aria-label="Call ${name}"><i class="fa-solid fa-phone"></i></a>
          <a class="v3-btn v3-btn-ghost v3-btn-sm" href="mailto:${email}" aria-label="Email ${name}"><i class="fa-solid fa-envelope"></i></a>` : ""}
        </div>
      </td>
    `;

    tr.querySelector("[data-action='profile']")?.addEventListener("click", () => openProfile(s));

    DOM.studentsBody.appendChild(tr);
  });
}

// =====================================================
// RESIDENT DETAIL & COORDINATION MODAL
// =====================================================
function openProfile(entry) {
  const student = entry.student || entry.userId || {};
  const booking = entry.booking || {};
  const property = entry.property || entry.propertyId || {};
  const name = student.name || "Student";
  const avatar = (name.charAt(0) || "S").toUpperCase();

  // Create list of submitted/required documents
  const docsListHTML = (booking.requiredDocuments || []).map((d, index) => {
    const statusText = d.submitted ? `<span style="color:#22c55e"><i class="fa-solid fa-circle-check"></i> Submitted</span>` : `<span style="color:#ef4444"><i class="fa-solid fa-circle-xmark"></i> Pending</span>`;
    const actionHTML = d.submitted
      ? `<a href="${d.documentUrl}" target="_blank" class="v3-btn v3-btn-ghost v3-btn-sm" style="padding:4px 8px;font-size:12px"><i class="fa-solid fa-eye"></i> View</a>`
      : "";
    return `
      <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid rgba(255,255,255,.04)">
        <span style="font-size:13px;font-weight:500">${d.name} ${d.required ? "*" : ""}</span>
        <div style="display:flex;align-items:center;gap:12px">
          ${statusText}
          ${actionHTML}
        </div>
      </div>
    `;
  }).join("") || `<p style="color:var(--v3-muted);font-size:13px">No documents required for this booking.</p>`;

  // Comma-separated names of current required documents
  const requiredDocsCSV = (booking.requiredDocuments || []).map(d => d.name).join(", ");

  DOM.studentProfileContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
      <div class="v3-avatar" style="width:54px;height:54px;font-size:22px">${avatar}</div>
      <div>
        <h3 style="font-size:18px;font-weight:800">${name}</h3>
        <p style="color:var(--v3-muted);font-size:13px">${student.email || "No email"}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">Phone</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px">${student.phone || "—"}</div>
      </div>
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">Property</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px">${property.propertyName || booking.propertyName || "—"}</div>
      </div>
    </div>

    <!-- Documents Section -->
    <div style="margin-bottom:24px">
      <h4 style="font-size:14px;font-weight:700;margin-bottom:10px;text-transform:uppercase;color:var(--v3-primary2)">Required Documents</h4>
      <div style="padding:12px 16px;border-radius:14px;background:rgba(255,255,255,.02);border:1px solid var(--v3-border)">
        ${docsListHTML}
      </div>
    </div>

    <!-- Check-In Coordination Form -->
    <form id="coordinationForm" style="margin-top:20px">
      <h4 style="font-size:14px;font-weight:700;margin-bottom:14px;text-transform:uppercase;color:var(--v3-secondary)">Check-In Coordination</h4>
      
      <div class="v3-form-group" style="margin-bottom:12px">
        <label for="checkInWindow" style="font-size:12px">Check-In Window (e.g. 10:00 AM - 06:00 PM)</label>
        <input type="text" id="checkInWindow" class="v3-input" value="${booking.checkInWindow || ""}" placeholder="Enter hours or time window">
      </div>

      <div class="v3-form-group" style="margin-bottom:12px">
        <label for="checkInInstructions" style="font-size:12px">Check-In Instructions</label>
        <textarea id="checkInInstructions" class="v3-input" rows="2" placeholder="Where to go, who to meet...">${booking.checkInInstructions || ""}</textarea>
      </div>

      <div class="v3-form-group" style="margin-bottom:12px">
        <label for="meetingInstructions" style="font-size:12px">Meeting Instructions</label>
        <textarea id="meetingInstructions" class="v3-input" rows="2" placeholder="Where is the meeting point...">${booking.meetingInstructions || ""}</textarea>
      </div>

      <div class="v3-form-group" style="margin-bottom:12px">
        <label for="specialInstructions" style="font-size:12px">Special Instructions / Rules</label>
        <textarea id="specialInstructions" class="v3-input" rows="2" placeholder="Any details student must know...">${booking.specialInstructions || ""}</textarea>
      </div>

      <div class="v3-form-group" style="margin-bottom:16px">
        <label for="requiredDocsCsv" style="font-size:12px">Configure Required Document Names (comma-separated)</label>
        <input type="text" id="requiredDocsCsv" class="v3-input" value="${requiredDocsCSV}" placeholder="Aadhaar Card, College ID, Passport Photo">
      </div>

      <div style="display:flex;gap:10px;margin-top:20px">
        <button type="submit" class="v3-btn v3-btn-primary" style="flex:1"><i class="fa-solid fa-floppy-disk"></i> Save Coordination</button>
        <a class="v3-btn v3-btn-ghost" href="/pages/owner/messages.html?student=${student._id || ""}"><i class="fa-solid fa-comments"></i> Chat</a>
      </div>
    </form>
  `;

  // Handle coordination submission
  const coordForm = $("coordinationForm");
  coordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = coordForm.querySelector("button[type='submit']");
    btn.disabled = true;

    // Parse required documents list
    const docsCSV = $("requiredDocsCsv").value.trim();
    const requiredDocuments = docsCSV ? docsCSV.split(",").map(name => name.trim()).filter(Boolean) : [];

    const body = {
      checkInInstructions: $("checkInInstructions").value.trim(),
      checkInWindow: $("checkInWindow").value.trim(),
      meetingInstructions: $("meetingInstructions").value.trim(),
      specialInstructions: $("specialInstructions").value.trim(),
      requiredDocuments
    };

    try {
      await apiFetch(`/owner/bookings/${booking._id}/check-in`, {
        method: "PUT",
        body: JSON.stringify(body)
      });
      showToast("Check-in coordination updated successfully!", "success");
      DOM.studentModal.classList.remove("active");
      loadResidents();
    } catch (err) {
      showToast("Failed to save: " + err.message, "error");
    } finally {
      btn.disabled = false;
    }
  });

  DOM.studentModal.classList.add("active");
}

// =====================================================
// BROADCAST
// =====================================================
async function handleBroadcast(e) {
  e.preventDefault();
  const message = DOM.broadcastText?.value.trim();
  if (!message) {
    showToast("Please enter a message", "error");
    return;
  }

  const btn = DOM.broadcastForm.querySelector("button[type='submit']");
  btn.disabled = true;

  try {
    await apiFetch("/owner/messages/broadcast", {
      method: "POST",
      body: JSON.stringify({ text: message, audience: "all", broadcastType: "Announcement" }),
    });
    showToast("Broadcast sent to all active residents", "success");
    DOM.broadcastForm.reset();
    DOM.broadcastModal.classList.remove("active");
  } catch (err) {
    showToast("Failed to send broadcast: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

window.showToast = (...args) => showToast(...args);

function updateTableHeaders() {
  const thead = document.querySelector(".v3-table thead tr");
  if (!thead) return;
  if (currentTab === "active") {
    thead.innerHTML = `
      <th>Resident</th>
      <th>Contact</th>
      <th>College</th>
      <th>Property</th>
      <th>Move In</th>
      <th>Rent</th>
      <th>Status</th>
      <th>Actions</th>
    `;
  } else {
    thead.innerHTML = `
      <th>Student</th>
      <th>Contact</th>
      <th>Property</th>
      <th>Room</th>
      <th>Move-in Date</th>
      <th>Source</th>
      <th>Status</th>
      <th>Actions</th>
    `;
  }
}

async function loadRequests() {
  DOM.studentsBody.innerHTML = `<tr><td colspan="8" class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading requests...</td></tr>`;
  try {
    const data = await apiFetch("/owner/resident-requests");
    allRequests = data.requests || [];
    
    // Update badge count
    const badge = $("requestsCountBadge");
    const pendingCount = allRequests.filter(r => r.status === "PENDING").length;
    if (badge) {
      if (pendingCount > 0) {
        badge.textContent = pendingCount;
        badge.style.display = "inline-flex";
      } else {
        badge.style.display = "none";
      }
    }
    
    renderRequests();
  } catch (err) {
    console.error("Requests load error:", err);
    DOM.studentsBody.innerHTML = `<tr><td colspan="8" class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load Requests</h3><p>${err.message}</p></td></tr>`;
  }
}

function renderRequests(searchTerm = "") {
  if (currentTab !== "requests") return;

  let filtered = allRequests;
  if (searchTerm) {
    filtered = allRequests.filter((r) => {
      const student = r.student || {};
      const name = (student.name || "").toLowerCase();
      const phone = (student.phone || "").toLowerCase();
      const email = (student.email || "").toLowerCase();
      const college = (student.college || "").toLowerCase();
      return name.includes(searchTerm) || phone.includes(searchTerm) || email.includes(searchTerm) || college.includes(searchTerm);
    });
  }

  if (filtered.length === 0) {
    DOM.studentsBody.innerHTML = "";
    DOM.emptyState.innerHTML = `
      <i class="fa-solid fa-user-clock"></i>
      <h3>No Verification Requests</h3>
      <p>Requests from existing residents will appear here.</p>
    `;
    DOM.emptyState.style.display = "block";
    return;
  }

  DOM.emptyState.style.display = "none";
  DOM.studentsBody.innerHTML = "";

  filtered.forEach((r) => {
    const student = r.student || {};
    const property = r.property || {};
    const name = student.name || "Student";
    const phone = student.phone || "";
    const email = student.email || "";
    const propertyName = property.propertyName || "";
    const room = r.room || "";
    const bed = r.bed ? `, ${r.bed}` : "";
    const moveIn = new Date(r.moveInDate).toLocaleDateString("en-IN");
    const source = r.residenceSource.replace("_", " ");
    const status = r.status;
    const statusColor = status === "PENDING" ? "warning" : status === "APPROVED" ? "success" : "danger";
    const avatar = (name.charAt(0) || "S").toUpperCase();

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>
        <div style="display:flex;align-items:center;gap:12px">
          <div class="v3-avatar" style="width:40px;height:40px;font-size:16px">${avatar}</div>
          <div>
            <strong style="font-size:14px">${name}</strong>
          </div>
        </div>
      </td>
      <td>
        <div style="font-size:13px">${phone || "—"}</div>
        <div style="font-size:12px;color:var(--v3-muted)">${email || ""}</div>
      </td>
      <td style="font-size:13px">${propertyName}</td>
      <td style="font-size:13px">${room}${bed}</td>
      <td style="font-size:13px">${moveIn}</td>
      <td style="font-size:13px; text-transform:capitalize">${source.toLowerCase()}</td>
      <td><span class="v3-pill v3-pill-${statusColor}">${status}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="v3-btn v3-btn-primary v3-btn-sm" data-action="view" data-id="${r._id}"><i class="fa-solid fa-eye"></i> View</button>
        </div>
      </td>
    `;

    tr.querySelector("[data-action='view']")?.addEventListener("click", () => openRequestDetails(r));

    DOM.studentsBody.appendChild(tr);
  });
}

function openRequestDetails(r) {
  const modal = $("requestModal");
  const content = $("requestModalContent");
  if (!modal || !content) return;

  const student = r.student || {};
  const property = r.property || {};
  const name = student.name || "Student";
  const avatar = (name.charAt(0) || "S").toUpperCase();

  let actionsHTML = "";
  if (r.status === "PENDING") {
    actionsHTML = `
      <div style="display:flex; gap:12px; margin-top:24px">
        <button id="approveReqBtn" class="v3-btn v3-btn-success" style="flex:1"><i class="fa-solid fa-check"></i> Approve Resident</button>
        <button id="rejectReqBtn" class="v3-btn v3-btn-danger" style="flex:1"><i class="fa-solid fa-xmark"></i> Reject</button>
      </div>
    `;
  }

  let docHTML = `<p style="color:var(--v3-muted); font-size:13px">No proof document supplied.</p>`;
  if (r.proofDocument) {
    docHTML = `
      <a href="${r.proofDocument}" target="_blank" style="display:inline-flex; align-items:center; gap:8px; color:var(--v3-primary2); font-weight:600; font-size:14px; text-decoration:none; margin-top:4px">
        <i class="fa-solid fa-file-invoice"></i> View Proof Document <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:11px"></i>
      </a>
    `;
  }

  content.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:20px">
      <div class="v3-avatar" style="width:54px;height:54px;font-size:22px">${avatar}</div>
      <div>
        <h3 style="font-size:18px;font-weight:800;color:#fff">${name}</h3>
        <p style="color:var(--v3-muted);font-size:13px">${student.email || "No email"}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:20px">
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">Phone</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px;color:#fff">${student.phone || "—"}</div>
      </div>
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">College</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px;color:#fff">${student.college || "—"}</div>
      </div>
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">Property</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px;color:#fff">${property.propertyName || "—"}</div>
      </div>
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">Room / Bed</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px;color:#fff">${r.room || "—"}${r.bed ? ", " + r.bed : ""}</div>
      </div>
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">Move-in Date</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px;color:#fff">${new Date(r.moveInDate).toLocaleDateString("en-IN")}</div>
      </div>
      <div style="padding:10px 14px;border-radius:12px;background:rgba(255,255,255,.04)">
        <div style="font-size:11px;color:var(--v3-muted)">Source</div>
        <div style="font-weight:700;margin-top:2px;font-size:13px;color:#fff;text-transform:capitalize">${r.residenceSource.toLowerCase().replace("_", " ")}</div>
      </div>
    </div>

    <div style="margin-bottom:16px; text-align:left">
      <h4 style="font-size:12px; font-weight:700; color:var(--v3-muted); text-transform:uppercase; margin-bottom:6px">Residence Proof</h4>
      <div style="padding:12px; border-radius:10px; background:rgba(255,255,255,0.02); border:1px solid var(--v3-border)">
        ${docHTML}
      </div>
    </div>

    ${r.message ? `
    <div style="margin-bottom:20px; text-align:left">
      <h4 style="font-size:12px; font-weight:700; color:var(--v3-muted); text-transform:uppercase; margin-bottom:6px">Student Message</h4>
      <p style="font-size:13.5px; color:#fff; line-height:1.5; padding:12px; border-radius:10px; background:rgba(255,255,255,0.02); border:1px solid var(--v3-border)">${esc(r.message)}</p>
    </div>
    ` : ""}

    ${actionsHTML}
  `;

  if (r.status === "PENDING") {
    $("approveReqBtn")?.addEventListener("click", () => handleApproveRequest(r._id));
    $("rejectReqBtn")?.addEventListener("click", () => handleRejectRequest(r._id));
  }

  modal.style.display = "flex";
}

async function handleApproveRequest(requestId) {
  if (!confirm("Are you sure you want to approve this student as an existing resident? This will create an active stay tenancy.")) return;
  
  const modal = $("requestModal");
  try {
    await apiFetch(`/owner/resident-requests/${requestId}/approve`, {
      method: "POST"
    });
    showToast("Resident approved successfully!", "success");
    modal.style.display = "none";
    loadRequests();
  } catch (err) {
    showToast("Approval failed: " + err.message, "error");
  }
}

async function handleRejectRequest(requestId) {
  const reason = prompt("Please enter a reason for rejection (optional):");
  if (reason === null) return;

  const modal = $("requestModal");
  try {
    await apiFetch(`/owner/resident-requests/${requestId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reason })
    });
    showToast("Request rejected.", "info");
    modal.style.display = "none";
    loadRequests();
  } catch (err) {
    showToast("Rejection failed: " + err.message, "error");
  }
}

console.log("✅ Campora Owner Residents V3 initialised");
