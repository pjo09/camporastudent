// =====================================================
// CAMPORA OWNER STUDENTS V3
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

let allStudents = [];

// =====================================================
// INIT
// =====================================================

initShell("Students");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadStudents();
});

function setupListeners() {
  DOM.studentSearch?.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    renderStudents(term);
  });

  DOM.closeStudentModal?.addEventListener("click", () => DOM.studentModal.classList.remove("active"));
  DOM.studentModal?.addEventListener("click", (e) => { if (e.target === DOM.studentModal) DOM.studentModal.classList.remove("active"); });

  DOM.broadcastBtn?.addEventListener("click", () => DOM.broadcastModal.classList.add("active"));
  DOM.closeBroadcastModal?.addEventListener("click", () => DOM.broadcastModal.classList.remove("active"));
  DOM.broadcastModal?.addEventListener("click", (e) => { if (e.target === DOM.broadcastModal) DOM.broadcastModal.classList.remove("active"); });

  DOM.broadcastForm?.addEventListener("submit", handleBroadcast);
}

// =====================================================
// LOAD STUDENTS
// =====================================================

async function loadStudents() {
  DOM.studentsBody.innerHTML = `<tr><td colspan="8" class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading students...</td></tr>`;

  try {
    const data = await apiFetch("/owner/students?limit=100");
    allStudents = data.students || [];
    renderStudents();
  } catch (err) {
    console.error("Students load error:", err);
    DOM.studentsBody.innerHTML = `<tr><td colspan="8" class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load Students</h3><p>${err.message}</p></td></tr>`;
  }
}

// =====================================================
// RENDER
// =====================================================

function renderStudents(searchTerm = "") {
  let filtered = allStudents;
  if (searchTerm) {
    filtered = allStudents.filter((s) => {
      const name = (s.name || "").toLowerCase();
      const phone = (s.phone || "").toLowerCase();
      const email = (s.email || "").toLowerCase();
      const college = (s.college || "").toLowerCase();
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
    const student = s.student || s.userId || s;
    const property = s.property || s.propertyId || {};
    const booking = s.booking || s;
    const name = student.name || "Student";
    const phone = student.phone || "";
    const email = student.email || "";
    const college = student.college || student.university || "";
    const propertyName = property.propertyName || "";
    const moveIn = booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : "—";
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
      <td style="font-weight:700">₹${rent.toLocaleString()}</td>
      <td><span class="v3-pill v3-pill-${statusColor}">${(status.charAt(0).toUpperCase() + status.slice(1)).replace("-", " ")}</span></td>
      <td>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="profile" data-id="${s._id}"><i class="fa-solid fa-user"></i></button>
          ${phone ? `<a class="v3-btn v3-btn-success v3-btn-sm" href="tel:${phone}" aria-label="Call ${name}"><i class="fa-solid fa-phone"></i></a>
          <a class="v3-btn v3-btn-ghost v3-btn-sm" href="https://wa.me/${phone.replace(/[^0-9]/g, "")}" target="_blank" rel="noopener" aria-label="WhatsApp ${name}"><i class="fa-brands fa-whatsapp"></i></a>
          <a class="v3-btn v3-btn-ghost v3-btn-sm" href="mailto:${email}" aria-label="Email ${name}"><i class="fa-solid fa-envelope"></i></a>` : ""}
        </div>
      </td>
    `;

    tr.querySelector("[data-action='profile']")?.addEventListener("click", () => openProfile(s));

    DOM.studentsBody.appendChild(tr);
  });
}

// =====================================================
// PROFILE MODAL
// =====================================================

function openProfile(entry) {
  const student = entry.student || entry.userId || entry;
  const booking = entry.booking || entry;
  const property = entry.property || entry.propertyId || {};
  const name = student.name || "Student";
  const avatar = (name.charAt(0) || "S").toUpperCase();

  DOM.studentProfileContent.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;margin-bottom:24px">
      <div class="v3-avatar" style="width:64px;height:64px;font-size:26px">${avatar}</div>
      <div>
        <h3 style="font-size:22px;font-weight:800">${name}</h3>
        <p style="color:var(--v3-muted);font-size:14px">${student.email || "No email"}</p>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:20px">
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04)">
        <div style="font-size:12px;color:var(--v3-muted)">Phone</div>
        <div style="font-weight:700;margin-top:4px">${student.phone || "—"}</div>
      </div>
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04)">
        <div style="font-size:12px;color:var(--v3-muted)">College</div>
        <div style="font-weight:700;margin-top:4px">${student.college || student.university || "—"}</div>
      </div>
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04)">
        <div style="font-size:12px;color:var(--v3-muted)">Property</div>
        <div style="font-weight:700;margin-top:4px">${property.propertyName || booking.propertyName || "—"}</div>
      </div>
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04)">
        <div style="font-size:12px;color:var(--v3-muted)">Move In</div>
        <div style="font-weight:700;margin-top:4px">${booking.checkIn ? new Date(booking.checkIn).toLocaleDateString() : "—"}</div>
      </div>
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04)">
        <div style="font-size:12px;color:var(--v3-muted)">Monthly Rent</div>
        <div style="font-weight:700;margin-top:4px;color:#60a5fa">₹${(booking.price || 0).toLocaleString()}</div>
      </div>
      <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04)">
        <div style="font-size:12px;color:var(--v3-muted)">Status</div>
        <div style="font-weight:700;margin-top:4px">${(booking.bookingStatus || "confirmed").toUpperCase()}</div>
      </div>
    </div>

    <div style="display:flex;gap:10px;flex-wrap:wrap">
      <a class="v3-btn v3-btn-primary" href="/pages/owner/messages.html?student=${student._id || ""}"><i class="fa-solid fa-comments"></i> Message</a>
      ${student.phone ? `<a class="v3-btn v3-btn-success" href="tel:${student.phone}"><i class="fa-solid fa-phone"></i> Call</a>
      <a class="v3-btn v3-btn-ghost" href="https://wa.me/${student.phone.replace(/[^0-9]/g, "")}" target="_blank" rel="noopener"><i class="fa-brands fa-whatsapp"></i> WhatsApp</a>` : ""}
    </div>
  `;

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
    showToast("Broadcast sent to all active students", "success");
    DOM.broadcastForm.reset();
    DOM.broadcastModal.classList.remove("active");
  } catch (err) {
    showToast("Failed to send broadcast: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Students V3 initialised");
