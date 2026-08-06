// =====================================================
// CAMPORA ADD / EDIT PROPERTY — V3 WIZARD
// Multi-step wizard, per-step validation, draft autosave,
// preview, publish with success overlay.
// Uses existing backend APIs only (no new endpoints).
// 1. POST /api/properties/create (images + basic fields)
// 2. PUT  /api/owner/properties/:id (remaining fields)
// =====================================================

import { initShell, apiFetch, showToast, formatImage, formatCurrency, $ } from "./owner-shell.js";

const API_BASE = (await import("./config.js")).API;
const APP_BASE_URL = API_BASE.replace(/\/api$/, "");

// =====================================================
// CONSTANTS
// =====================================================

const TOTAL_STEPS = 8;
const STEP_NAMES = [
  "Basic Information", "Location", "Rooms & Beds", "Pricing",
  "Amenities", "Images", "House Rules", "Preview & Publish",
];
const DRAFT_KEY = "camporaAddPropertyDraft";

// Fields with validation groups per step
const STEP_FIELDS = {
  1: ["propName", "propType", "description"],
  2: ["address", "city", "state"],
  3: ["sharing", "gender", "totalBeds", "availableBeds"],
  4: ["rent", "deposit"],
  // step 5 amenities, step 6 images, step 7 rules — custom validation
};

const DOM = {
  form: $("propertyForm"),
  editBanner: $("editBanner"),
  currentStepDisplay: $("currentStepDisplay"),
  stepNameDisplay: $("stepNameDisplay"),
  progressPct: $("progressPct"),
  prevBtn: $("prevBtn"),
  nextBtn: $("nextBtn"),
  saveDraftBtn: $("saveDraftBtn"),
  publishBtn: $("publishBtn"),
  cancelBtn: $("cancelBtn"),
  imageUploadArea: $("imageUploadArea"),
  imageInput: $("imageInput"),
  imagePreviewGrid: $("imagePreviewGrid"),
  imageError: $("imageError"),
  uploadProgress: $("uploadProgress"),
  progressFill: $("progressFill"),
  progressText: $("progressText"),
  descCount: $("descCount"),
  previewContent: $("previewContent"),
  successOverlay: $("successOverlay"),
  successTitle: $("successTitle"),
  successDesc: $("successDesc"),
  successBtn: $("successBtn"),
  wizardSteps: document.querySelectorAll(".v3-wizard-step"),
  connectors: document.querySelectorAll(".v3-wizard-connector"),
  stepPanels: document.querySelectorAll(".v3-wizard-step-panel"),
};

// =====================================================
// STATE
// =====================================================

const state = {
  currentStep: 1,
  uploadedImages: [],
  editPropertyId: null,
  isSubmitting: false,
};

// =====================================================
// INIT
// =====================================================

initShell("Add Property");

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
} else {
    init();
}

function init() {
    setupListeners();
    restoreDraft();
    checkEditMode();
    showStep(1);
}

// =====================================================
// EDIT MODE
// =====================================================

async function checkEditMode() {
  const params = new URLSearchParams(window.location.search);
  const editId = params.get("id");
  if (editId) {
    state.editPropertyId = editId;
    if (DOM.editBanner) DOM.editBanner.style.display = "block";
    await loadPropertyForEdit(editId);
  } else {
    // New property — default visitors allowed on
    if ($("ruleVisitors")) $("ruleVisitors").checked = true;
  }
  renderPreview();
}

async function loadPropertyForEdit(id) {
  try {
    const data = await apiFetch(`/owner/properties/${id}`);
    const p = data.property || {};
    populateForm(p);
    renderPreview();
  } catch (err) {
    console.error("Edit load error:", err);
    showToast("Failed to load property for editing", "error");
  }
}

function populateForm(p) {
  if (!$("propName")) return;
  $("propName").value = p.propertyName || "";
  $("propType").value = p.propertyType || "";
  $("description").value = p.description || "";
  $("address").value = p.address || "";
  $("city").value = p.city || "";
  $("state").value = p.state || "";
  $("college").value = p.college || "";
  $("latitude").value = p.latitude || "";
  $("longitude").value = p.longitude || "";
  $("rent").value = p.rent || "";
  $("deposit").value = p.deposit || "";
  $("maintenance").value = p.maintenanceCharge || "";
  $("sharing").value = p.sharing || "";
  $("gender").value = p.gender || "";
  $("totalBeds").value = p.totalBeds || "";
  $("availableBeds").value = p.availableBeds || "";

  const amenities = (p.amenities || []).map((a) => a.toLowerCase());
  document.querySelectorAll("#amenitiesGrid input[type=checkbox]").forEach((cb) => {
    cb.checked = amenities.includes(cb.value.toLowerCase());
  });

  const rules = p.houseRules || {};
  if ($("ruleSmoking")) $("ruleSmoking").checked = rules.smoking || false;
  if ($("ruleDrinking")) $("ruleDrinking").checked = rules.drinking || false;
  if ($("rulePets")) $("rulePets").checked = rules.pets || false;
  if ($("ruleVisitors")) $("ruleVisitors").checked = rules.visitors !== false;

  if (p.images && p.images.length) {
    state.uploadedImages = p.images.map((img) => ({
      url: img.startsWith("http") ? img : `${APP_BASE_URL}/uploads/${img.replace(/^\//, "")}`,
      existing: true,
      filename: img,
    }));
    renderImagePreviews();
  }
}

// =====================================================
// EVENT LISTENERS
// =====================================================

function setupListeners() {
  DOM.imageInput?.addEventListener("change", handleImageSelect);
  DOM.imageUploadArea?.addEventListener("dragover", (e) => { e.preventDefault(); DOM.imageUploadArea.style.borderColor = "var(--v3-primary)"; });
  DOM.imageUploadArea?.addEventListener("dragleave", () => { DOM.imageUploadArea.style.borderColor = ""; });
  DOM.imageUploadArea?.addEventListener("drop", (e) => {
    e.preventDefault();
    DOM.imageUploadArea.style.borderColor = "";
    if (e.dataTransfer.files.length) handleFiles(e.dataTransfer.files);
  });

  $("description")?.addEventListener("input", () => {
    if (DOM.descCount) DOM.descCount.textContent = $("description").value.length;
  });

  DOM.form?.addEventListener("submit", handlePublish);
  DOM.saveDraftBtn?.addEventListener("click", saveDraft);
  DOM.cancelBtn?.addEventListener("click", () => {
    if (confirm("Discard changes and go back?")) window.location.href = "owner-dashboard.html";
  });

  DOM.prevBtn?.addEventListener("click", () => showStep(state.currentStep - 1));
  DOM.nextBtn?.addEventListener("click", () => {
    if (validateStep(state.currentStep)) showStep(state.currentStep + 1);
  });

  DOM.successBtn?.addEventListener("click", () => {
    window.location.href = "owner-dashboard.html";
  });

  // Live validation on blur
  document.querySelectorAll(".v3-field input, .v3-field select, .v3-field textarea").forEach((el) => {
    el.addEventListener("change", () => {
      const field = el.closest(".v3-field");
      if (field && field.classList.contains("invalid")) {
        validateField(field);
      }
    });
  });

  // Autosave on input
  document.querySelectorAll("#propertyForm input, #propertyForm select, #propertyForm textarea").forEach((el) => {
    el.addEventListener("input", () => {
      if (!state.editPropertyId) scheduleDraftSave();
    });
  });
}

let draftTimer = null;
function scheduleDraftSave() {
  clearTimeout(draftTimer);
  draftTimer = setTimeout(saveDraftSilent, 800);
}

// =====================================================
// WIZARD NAVIGATION
// =====================================================

function showStep(step) {
  state.currentStep = Math.max(1, Math.min(step, TOTAL_STEPS));

  DOM.stepPanels.forEach((el, i) => {
    el.classList.toggle("active", i + 1 === state.currentStep);
  });
  DOM.wizardSteps.forEach((el, i) => {
    const idx = i + 1;
    el.classList.toggle("active", idx === state.currentStep);
    el.classList.toggle("completed", idx < state.currentStep);
  });
  DOM.connectors.forEach((el, i) => {
    el.classList.toggle("completed", i + 1 < state.currentStep);
  });

  const pct = Math.round(((state.currentStep - 1) / (TOTAL_STEPS - 1)) * 100);
  if (DOM.currentStepDisplay) DOM.currentStepDisplay.textContent = state.currentStep;
  if (DOM.stepNameDisplay) DOM.stepNameDisplay.textContent = STEP_NAMES[state.currentStep - 1];
  if (DOM.progressPct) DOM.progressPct.textContent = pct + "%";
  if (DOM.prevBtn) DOM.prevBtn.disabled = state.currentStep === 1;
  if (DOM.nextBtn) DOM.nextBtn.style.display = state.currentStep === TOTAL_STEPS ? "none" : "";

  // Render preview when reaching step 8
  if (state.currentStep === 8) renderPreview();

  window.scrollTo({ top: 0, behavior: "smooth" });
}

// =====================================================
// PER-STEP VALIDATION
// =====================================================

function validateField(field) {
  const id = field.querySelector("input, select, textarea")?.id;
  let valid = true;

  switch (id) {
    case "propName": valid = !!field.querySelector("input").value.trim(); break;
    case "propType": valid = !!field.querySelector("select").value; break;
    case "description": {
      const v = field.querySelector("textarea").value.trim();
      valid = v.length >= 20;
      break;
    }
    case "address": valid = !!field.querySelector("input").value.trim(); break;
    case "city": valid = !!field.querySelector("input").value.trim(); break;
    case "state": valid = !!field.querySelector("input").value.trim(); break;
    case "sharing": valid = !!field.querySelector("select").value; break;
    case "gender": valid = !!field.querySelector("select").value; break;
    case "totalBeds": valid = parseInt(field.querySelector("input").value) >= 1; break;
    case "availableBeds": valid = parseInt(field.querySelector("input").value) >= 0; break;
    case "rent": valid = parseInt(field.querySelector("input").value) > 0; break;
    case "deposit": {
      const v = parseInt(field.querySelector("input").value);
      valid = !isNaN(v) && v >= 0;
      break;
    }
    default: valid = true;
  }

  field.classList.toggle("invalid", !valid);
  return valid;
}

function validateStep(step) {
  const fieldIds = STEP_FIELDS[step];
  if (!fieldIds) return true;

  let valid = true;
  fieldIds.forEach((id) => {
    const field = $(`fg-${id}`);
    if (field && !validateField(field)) valid = false;
  });

  // Amenities (step 5) — optional
  // Images (step 6) — required for new properties
  if (step === 6 && state.uploadedImages.length === 0 && !state.editPropertyId) {
    if (DOM.imageError) DOM.imageError.style.display = "block";
    valid = false;
    showToast("Please upload at least one image", "warning");
  } else if (DOM.imageError) {
    DOM.imageError.style.display = "none";
  }

  if (!valid) {
    const firstInvalid = document.querySelector(".v3-field.invalid");
    if (firstInvalid) firstInvalid.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return valid;
}

// =====================================================
// IMAGE HANDLING
// =====================================================

function handleImageSelect(e) { handleFiles(e.target.files); }

function handleFiles(files) {
  const remaining = 10 - state.uploadedImages.length;
  if (files.length > remaining) {
    showToast(`You can only upload ${remaining} more image(s)`, "error");
    return;
  }
  Array.from(files).forEach((file) => {
    if (!["image/jpeg", "image/jpg", "image/png", "image/webp"].includes(file.type)) {
      showToast(`${file.name} is not a supported format`, "error");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast(`${file.name} exceeds 10MB limit`, "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      state.uploadedImages.push({ url: e.target.result, file, existing: false });
      renderImagePreviews();
    };
    reader.readAsDataURL(file);
  });
  if (DOM.imageInput) DOM.imageInput.value = "";
}

function renderImagePreviews() {
  if (!DOM.imagePreviewGrid) return;
  DOM.imagePreviewGrid.innerHTML = "";
  state.uploadedImages.forEach((img, i) => {
    const div = document.createElement("div");
    div.className = "v3-image-preview-item";
    div.innerHTML = `
      <img src="${img.url}" alt="Property image ${i + 1}" loading="lazy" />
      <button type="button" class="remove-img" data-index="${i}" aria-label="Remove image"><i class="fa-solid fa-xmark"></i></button>`;
    div.querySelector(".remove-img").addEventListener("click", () => {
      state.uploadedImages.splice(i, 1);
      renderImagePreviews();
    });
    DOM.imagePreviewGrid.appendChild(div);
  });
  if (DOM.imageError) DOM.imageError.style.display = state.uploadedImages.length === 0 ? "block" : "none";
}

// =====================================================
// HELPERS
// =====================================================

function getVal(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function getIntVal(id) {
  return parseInt(getVal(id)) || 0;
}

function getCheckedAmenities() {
  const amenities = [];
  document.querySelectorAll("#amenitiesGrid input[type=checkbox]:checked").forEach((cb) => amenities.push(cb.value));
  return amenities;
}

function getHouseRules() {
  return {
    smoking: $("ruleSmoking")?.checked || false,
    drinking: $("ruleDrinking")?.checked || false,
    pets: $("rulePets")?.checked || false,
    visitors: $("ruleVisitors")?.checked !== false,
  };
}

// =====================================================
// PREVIEW
// =====================================================

function renderPreview() {
  if (!DOM.previewContent) return;

  const name = getVal("propName") || "Untitled Property";
  const type = getVal("propType") || "PG";
  const city = getVal("city");
  const stateN = getVal("state");
  const location = [city, stateN].filter(Boolean).join(", ");
  const rent = getIntVal("rent");
  const deposit = getIntVal("deposit");
  const sharing = getVal("sharing") || "—";
  const gender = getVal("gender") || "—";
  const totalBeds = getIntVal("totalBeds");
  const availableBeds = getIntVal("availableBeds");
  const description = getVal("description") || "No description provided.";
  const amenities = getCheckedAmenities();
  const rules = getHouseRules();

  const hero = state.uploadedImages[0]?.url
    ? `<img class="v3-preview-hero" src="${state.uploadedImages[0].url}" alt="${name}">`
    : "";

  const imagesHtml = state.uploadedImages.length > 1
    ? `<div class="v3-preview-section-title">Images (${state.uploadedImages.length})</div>
       <div class="v3-preview-images">${state.uploadedImages.map((i) => `<img src="${i.url}" alt="">`).join("")}</div>`
    : "";

  const amenitiesHtml = amenities.length
    ? `<div class="v3-preview-section-title">Amenities</div>
       <div class="v3-preview-tags">${amenities.map((a) => `<span class="v3-preview-tag">${a}</span>`).join("")}</div>`
    : "";

  const rulesHtml = `
    <div class="v3-preview-section-title">House Rules</div>
    <div class="v3-preview-rules">
      <span class="v3-preview-rule ${rules.smoking ? "" : "off"}">Smoking ${rules.smoking ? "Allowed" : "Not Allowed"}</span>
      <span class="v3-preview-rule ${rules.drinking ? "" : "off"}">Drinking ${rules.drinking ? "Allowed" : "Not Allowed"}</span>
      <span class="v3-preview-rule ${rules.pets ? "" : "off"}">Pets ${rules.pets ? "Allowed" : "Not Allowed"}</span>
      <span class="v3-preview-rule ${rules.visitors ? "" : "off"}">Visitors ${rules.visitors ? "Allowed" : "Not Allowed"}</span>
    </div>`;

  DOM.previewContent.innerHTML = `
    <div class="v3-preview-box">
      ${hero}
      <div class="v3-preview-title">${name}</div>
      <div class="v3-preview-loc">${location ? `<i class="fa-solid fa-location-dot"></i> ${location}` : ""} • ${type}</div>
      <div class="v3-preview-meta">
        <div class="v3-detail-item"><div class="d-label">Rent / month</div><div class="d-value">${formatCurrency(rent)}</div></div>
        <div class="v3-detail-item"><div class="d-label">Deposit</div><div class="d-value">${formatCurrency(deposit)}</div></div>
        <div class="v3-detail-item"><div class="d-label">Sharing</div><div class="d-value">${sharing}</div></div>
        <div class="v3-detail-item"><div class="d-label">Gender</div><div class="d-value">${gender}</div></div>
        <div class="v3-detail-item"><div class="d-label">Beds</div><div class="d-value">${availableBeds} / ${totalBeds} available</div></div>
        <div class="v3-detail-item"><div class="d-label">Maintenance</div><div class="d-value">${formatCurrency(getIntVal("maintenance"))}/mo</div></div>
      </div>
      <div class="v3-preview-desc">${description}</div>
      ${amenitiesHtml}
      ${rulesHtml}
      ${imagesHtml}
    </div>`;
}

// =====================================================
// DRAFT AUTOSAVE
// =====================================================

function getDraftData() {
  return {
    propName: getVal("propName"),
    propType: getVal("propType"),
    description: getVal("description"),
    address: getVal("address"),
    city: getVal("city"),
    state: getVal("state"),
    college: getVal("college"),
    pincode: getVal("pincode"),
    latitude: getVal("latitude"),
    longitude: getVal("longitude"),
    sharing: getVal("sharing"),
    gender: getVal("gender"),
    totalBeds: getVal("totalBeds"),
    availableBeds: getVal("availableBeds"),
    rent: getVal("rent"),
    deposit: getVal("deposit"),
    maintenance: getVal("maintenance"),
  };
}

function saveDraftSilent() {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({ ...getDraftData(), images: state.uploadedImages.map((i) => i.url) }));
  } catch { /* quota */ }
}

function saveDraft() {
  if (state.isSubmitting) return;
  saveDraftSilent();
  showToast("Draft saved locally", "success");
}

function restoreDraft() {
  if (state.editPropertyId) return; // don't restore over edit data
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    const map = {
      propName: "propName", propType: "propType", description: "description",
      address: "address", city: "city", state: "state", college: "college",
      pincode: "pincode", latitude: "latitude", longitude: "longitude",
      sharing: "sharing", gender: "gender", totalBeds: "totalBeds",
      availableBeds: "availableBeds", rent: "rent", deposit: "deposit", maintenance: "maintenance",
    };
    Object.entries(map).forEach(([k, id]) => {
      const el = document.getElementById(id);
      if (el && d[k]) el.value = d[k];
    });
    if (Array.isArray(d.images) && d.images.length) {
      state.uploadedImages = d.images.map((url) => ({ url, existing: false }));
      renderImagePreviews();
    }
  } catch { /* ignore */ }
}

// =====================================================
// PUBLISH
// =====================================================

async function handlePublish(e) {
  e.preventDefault();
  if (state.isSubmitting) return;

  // Validate all steps
  for (let s = 1; s <= TOTAL_STEPS; s++) {
    if (!validateStep(s)) {
      showStep(s);
      showToast("Please fix the highlighted fields", "warning");
      return;
    }
  }

  state.isSubmitting = true;
  showLoadingOverlay("Publishing Property...", "Please wait while we upload your property.");

  try {
    let propertyId = state.editPropertyId;

    const newFiles = state.uploadedImages.filter((img) => !img.existing);
    const existingImages = state.uploadedImages.filter((img) => img.existing);
    const isEditMode = !!state.editPropertyId;

    let uploadedImageUrls = [];

    if (isEditMode && newFiles.length > 0) {
      const formData = new FormData();
      newFiles.forEach((img) => formData.append("images", img.file));
      const uploadRes = await fetch(`${API_BASE}/upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await getToken()}` },
        body: formData,
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.message || "Image upload failed");
      uploadedImageUrls = uploadData.images.map((img) => img.url);
    }

    const allImageUrls = [
      ...existingImages.map((img) => (img.filename ? img.filename : img.url)),
      ...uploadedImageUrls,
    ];

    if (propertyId) {
      // EDIT MODE
      const body = buildPropertyBody(allImageUrls, false);
      await apiFetch(`/properties/${propertyId}`, {
        method: "PUT",
        body: JSON.stringify(body),
      });
    } else {
      // CREATE MODE
      const formData = new FormData();
      state.uploadedImages.forEach((img) => { if (img.file) formData.append("images", img.file); });
      formData.append("propertyName", getVal("propName"));
      formData.append("propertyType", getVal("propType"));
      formData.append("description", getVal("description"));
      formData.append("address", getVal("address"));
      formData.append("city", getVal("city"));
      formData.append("state", getVal("state"));
      if (getVal("college")) formData.append("college", getVal("college"));
      formData.append("rent", getVal("rent"));
      formData.append("deposit", getVal("deposit") || "0");
      formData.append("sharing", getVal("sharing"));
      formData.append("gender", getVal("gender"));
      if (getVal("latitude")) formData.append("latitude", getVal("latitude"));
      if (getVal("longitude")) formData.append("longitude", getVal("longitude"));

      const createRes = await fetch(`${API_BASE}/properties/create`, {
        method: "POST",
        headers: { Authorization: `Bearer ${await getToken()}` },
        body: formData,
      });
      const createData = await createRes.json();
      if (!createData.success) throw new Error(createData.message || "Property creation failed");
      propertyId = createData.property?._id || createData.property?.id;
    }

    // Update extra fields for both create & edit
    if (propertyId) {
      const extraBody = {
        totalBeds: getIntVal("totalBeds"),
        availableBeds: getIntVal("availableBeds"),
        maintenanceCharge: getIntVal("maintenance"),
        amenities: getCheckedAmenities(),
        houseRules: getHouseRules(),
      };
      await apiFetch(`/owner/properties/${propertyId}`, {
        method: "PUT",
        body: JSON.stringify(extraBody),
      });
    }

    // Clear draft
    localStorage.removeItem(DRAFT_KEY);

    showSuccess(state.editPropertyId ? "Property Updated!" : "Property Published!");
  } catch (err) {
    console.error("Publish error:", err);
    hideLoadingOverlay();
    showToast(err.message || "Failed to save property", "error");
    state.isSubmitting = false;
  }
}

function buildPropertyBody(images, isDraft) {
  const body = {
    propertyName: getVal("propName"),
    propertyType: getVal("propType"),
    description: getVal("description"),
    address: getVal("address"),
    city: getVal("city"),
    state: getVal("state"),
    college: getVal("college") || "",
    rent: getIntVal("rent"),
    deposit: getIntVal("deposit"),
    sharing: getVal("sharing"),
    gender: getVal("gender"),
    totalBeds: getIntVal("totalBeds"),
    availableBeds: getIntVal("availableBeds"),
    maintenanceCharge: getIntVal("maintenance"),
    houseRules: getHouseRules(),
    amenities: getCheckedAmenities(),
  };

  const lat = parseFloat(getVal("latitude"));
  const lng = parseFloat(getVal("longitude"));
  if (!isNaN(lat)) body.latitude = lat;
  if (!isNaN(lng)) body.longitude = lng;

  if (images && images.length > 0) body.images = images;
  body.published = !isDraft;

  return body;
}

// =====================================================
// OVERLAY (loading + success)
// =====================================================

function showLoadingOverlay(title, desc) {
  const overlay = $("successOverlay");
  if (!overlay) return;
  overlay.querySelector(".v3-success-icon").innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
  overlay.querySelector(".v3-success-icon i").style.fontSize = "30px";
  $("successTitle").textContent = title;
  $("successDesc").textContent = desc;
  overlay.classList.add("show");
}

function hideLoadingOverlay() {
  const overlay = $("successOverlay");
  if (overlay) overlay.classList.remove("show");
}

function showSuccess(title) {
  const overlay = $("successOverlay");
  if (!overlay) return;
  overlay.querySelector(".v3-success-icon").innerHTML = '<i class="fa-solid fa-check"></i>';
  overlay.querySelector(".v3-success-icon").style.background = "linear-gradient(135deg,#16a34a,#22c55e)";
  overlay.querySelector(".v3-success-icon i").style.fontSize = "40px";
  $("successTitle").textContent = title;
  $("successDesc").textContent = "Your property is now live on Campora.";
  overlay.classList.add("show");
  state.isSubmitting = false;
}

// getToken helper (imported lazily)
async function getToken() {
  const mod = await import("./session.js");
  return mod.getToken();
}

console.log("✅ Campora Add Property V3 initialised");
