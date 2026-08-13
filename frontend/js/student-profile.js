// =====================================================
// CAMPORA STUDENT V3 - PROFILE
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, showToast } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  loadProfile();
  $("saveProfileBtn")?.addEventListener("click", saveProfile);
});

async function loadProfile() {
  try {
    const data = await apiFetch("/student/profile");
    const u = data.user || {};
    if ($("pName")) $("pName").value = u.name || "";
    if ($("pEmail")) $("pEmail").value = u.email || "";
    if ($("pPhone")) $("pPhone").value = u.phone || "";
    if ($("pBio")) $("pBio").value = u.bio || "";
    if ($("pCollege")) $("pCollege").value = u.college || "";
    if ($("pCourse")) $("pCourse").value = u.course || "";
    if ($("pYear")) $("pYear").value = u.year || "";
    if (u.emergencyContact) {
      if ($("pEmergency")) $("pEmergency").value = typeof u.emergencyContact === "object" ? u.emergencyContact.phone || "" : u.emergencyContact;
    }
  } catch (err) {
    showToast(err.message || "Unable to load profile", "error");
  }
}

async function saveProfile() {
  const btn = $("saveProfileBtn");
  if (!btn) return;
  btn.disabled = true;
  try {
    const payload = {
      name: $("pName")?.value.trim(),
      phone: $("pPhone")?.value.trim(),
      bio: $("pBio")?.value.trim(),
      college: $("pCollege")?.value.trim(),
      course: $("pCourse")?.value.trim(),
      year: $("pYear")?.value,
      emergencyContact: $("pEmergency")?.value.trim(),
    };
    const data = await apiFetch("/student/profile", { method: "PUT", body: JSON.stringify(payload) });
    if (data.user?.name) {
      const el = $("navbarName");
      if (el) el.textContent = data.user.name;
      const init = $("studentInitials");
      if (init) init.textContent = data.user.name.charAt(0).toUpperCase();
    }
    showToast("Profile updated successfully", "success");
  } catch (err) {
    showToast(err.message || "Unable to save profile", "error");
  } finally {
    btn.disabled = false;
  }
}
