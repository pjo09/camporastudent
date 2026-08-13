// =====================================================
// CAMPORA OWNER ANNOUNCEMENTS JS
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  propertySelect: $("propertyId"),
  announcementForm: $("announcementForm"),
  titleInput: $("title"),
  messageInput: $("message"),
  expiresAtInput: $("expiresAt"),
  announcementsList: $("announcementsList"),
  emptyAnnouncements: $("emptyAnnouncements")
};

let ownerProperties = [];

// =====================================================
// INIT
// =====================================================
initShell("Announcements");

document.addEventListener("DOMContentLoaded", () => {
  setupForm();
  loadProperties();
  loadAnnouncements();
});

function setupForm() {
  DOM.announcementForm?.addEventListener("submit", handlePublish);
}

// =====================================================
// LOAD PROPERTIES
// =====================================================
async function loadProperties() {
  try {
    const data = await apiFetch("/owner/properties");
    ownerProperties = data.properties || [];
    
    // Clear select except first disabled item
    DOM.propertySelect.innerHTML = `<option value="" disabled selected>Select Property</option>`;
    
    ownerProperties.forEach(p => {
      const option = document.createElement("option");
      option.value = p._id;
      option.textContent = p.propertyName || "Property";
      DOM.propertySelect.appendChild(option);
    });
  } catch (err) {
    console.error("Properties loading error:", err);
    showToast("Failed to load properties list", "error");
  }
}

// =====================================================
// LOAD ANNOUNCEMENTS
// =====================================================
async function loadAnnouncements() {
  DOM.announcementsList.innerHTML = `<div class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading announcements...</div>`;
  
  try {
    const data = await apiFetch("/owner/announcements");
    const list = data.announcements || [];
    renderAnnouncements(list);
  } catch (err) {
    console.error("Announcements loading error:", err);
    DOM.announcementsList.innerHTML = `<div class="v3-error"><i class="fa-solid fa-triangle-exclamation"></i> Failed to load announcements.</div>`;
  }
}

// =====================================================
// RENDER ANNOUNCEMENTS
// =====================================================
function renderAnnouncements(list) {
  if (list.length === 0) {
    DOM.announcementsList.innerHTML = "";
    DOM.emptyAnnouncements.style.display = "block";
    return;
  }
  
  DOM.emptyAnnouncements.style.display = "none";
  DOM.announcementsList.innerHTML = "";

  list.forEach(a => {
    const card = document.createElement("div");
    card.className = "v3-item-card";
    card.style.padding = "16px";
    card.style.marginBottom = "12px";
    card.style.background = "rgba(255, 255, 255, 0.02)";
    card.style.border = "1px solid var(--v3-border)";
    card.style.borderRadius = "12px";
    
    const propName = a.property?.propertyName || "Property";
    const date = new Date(a.createdAt).toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit"
    });
    const expiry = a.expiresAt ? `Expires: ${new Date(a.expiresAt).toLocaleDateString("en-IN")}` : "No Expiry";

    card.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:start;margin-bottom:8px">
        <div>
          <span style="font-size:11px;font-weight:700;color:var(--v3-primary2);text-transform:uppercase;background:rgba(37,99,235,0.1);padding:2px 8px;border-radius:20px">${propName}</span>
          <h4 style="font-size:15px;font-weight:800;margin-top:6px">${a.title}</h4>
        </div>
        <span style="font-size:12px;color:var(--v3-muted)">${date}</span>
      </div>
      <p style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.5;margin-bottom:10px">${a.message}</p>
      <div style="font-size:11px;color:var(--v3-muted);display:flex;align-items:center;gap:6px">
        <i class="fa-regular fa-calendar"></i> ${expiry}
      </div>
    `;
    
    DOM.announcementsList.appendChild(card);
  });
}

// =====================================================
// PUBLISH ANNOUNCEMENT
// =====================================================
async function handlePublish(e) {
  e.preventDefault();
  
  const propertyId = DOM.propertySelect.value;
  const title = DOM.titleInput.value.trim();
  const message = DOM.messageInput.value.trim();
  const expiresAt = DOM.expiresAtInput.value;

  if (!propertyId || !title || !message) {
    showToast("Please fill all required fields", "error");
    return;
  }

  const btn = DOM.announcementForm.querySelector("button[type='submit']");
  btn.disabled = true;

  try {
    await apiFetch("/owner/announcements", {
      method: "POST",
      body: JSON.stringify({
        propertyId,
        title,
        message,
        expiresAt: expiresAt || null
      })
    });
    
    showToast("Announcement published successfully!", "success");
    DOM.announcementForm.reset();
    loadAnnouncements();
  } catch (err) {
    showToast("Failed to publish: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Announcements initialised");
