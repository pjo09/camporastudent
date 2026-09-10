// =====================================================
// CAMPORA STUDENT V3 - RESIDENT PROFILE
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, showToast } from "./student-utils.js";
import { supabaseAPI } from "./supabase-api.js";

const params = new URLSearchParams(window.location.search);
const returnTo = params.get("returnTo");

let currentProfilePhoto = "";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();

  if (returnTo) {
    const banner = $("bookingBanner");
    if (banner) banner.style.display = "flex";
  }

  loadProfile();

  $("saveProfileBtn")?.addEventListener("click", saveProfile);
  $("uploadAvatarBtn")?.addEventListener("click", () => $("avatarFileInput")?.click());
  $("avatarFileInput")?.addEventListener("change", handleAvatarFileSelect);
  $("removeAvatarBtn")?.addEventListener("click", handleRemoveAvatar);
});

async function loadProfile() {
  try {
    const data = await supabaseAPI.getStudentProfile();
    const u = data.user || {};
    currentProfilePhoto = u.profileImage || u.avatar || "";

    if ($("pName")) $("pName").value = u.name || "";
    if ($("pEmail")) $("pEmail").value = u.email || "";
    if ($("pPhone")) $("pPhone").value = u.phone || "";
    if ($("pBio")) $("pBio").value = u.bio || "";
    if ($("pDob") && u.dob) $("pDob").value = new Date(u.dob).toISOString().split("T")[0];
    if ($("pGender")) $("pGender").value = u.gender || "";

    if ($("pCollege")) $("pCollege").value = u.college || "";
    if ($("pCourse")) $("pCourse").value = u.course || "";
    if ($("pBranch")) $("pBranch").value = u.branch || "";
    if ($("pYear")) $("pYear").value = u.year || "";
    if ($("pStudentId")) $("pStudentId").value = u.studentId || "";

    if ($("pPrefMoveIn") && u.preferredMoveInDate) $("pPrefMoveIn").value = new Date(u.preferredMoveInDate).toISOString().split("T")[0];
    if ($("pDuration")) $("pDuration").value = u.expectedDuration || "";
    if ($("pPrefRoom")) $("pPrefRoom").value = u.preferredRoomType || "";
    if ($("pBudget")) $("pBudget").value = u.budgetRange || "";

    if (u.emergencyContact) {
      if ($("pGuardianName")) $("pGuardianName").value = u.emergencyContact.name || "";
      if ($("pRelationship")) $("pRelationship").value = u.emergencyContact.relationship || "Parent";
      if ($("pEmergency")) $("pEmergency").value = u.emergencyContact.phone || "";
    }

    renderAvatarPreview(currentProfilePhoto);
    updateCompletionBar(u.completionPercentage || 0, u.isProfileComplete);
    updatePhoneBadge(u.phoneVerified, u.phone);

  } catch (err) {
    showToast(err.message || "Unable to load profile", "error");
  }
}

function updateCompletionBar(percentage, isComplete) {
  const bar = $("completionBar");
  const txt = $("completionText");
  const badge = $("completionStatusBadge");

  if (bar) bar.style.width = `${percentage}%`;
  if (txt) txt.textContent = `Profile ${percentage}% Complete`;

  if (badge) {
    if (isComplete) {
      badge.className = "sv3-badge";
      badge.style.cssText = "background:rgba(16,185,129,0.15);color:#34d399;padding:4px 10px;border-radius:12px;font-size:12px";
      badge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Complete for Booking';
    } else {
      badge.className = "sv3-badge";
      badge.style.cssText = "background:rgba(245,158,11,0.15);color:#fbbf24;padding:4px 10px;border-radius:12px;font-size:12px";
      badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Action Required';
    }
  }
}

function updatePhoneBadge(verified, phone) {
  const phoneBadge = $("phoneBadge");
  if (!phoneBadge) return;
  if (verified) {
    phoneBadge.style.background = "rgba(16,185,129,0.15)";
    phoneBadge.style.color = "#34d399";
    phoneBadge.style.border = "1px solid rgba(16,185,129,0.3)";
    phoneBadge.innerHTML = '<i class="fa-solid fa-circle-check"></i> Phone Verified';
  } else if (phone) {
    phoneBadge.style.background = "rgba(234,179,8,0.15)";
    phoneBadge.style.color = "#facc15";
    phoneBadge.style.border = "1px solid rgba(234,179,8,0.3)";
    phoneBadge.innerHTML = '<i class="fa-solid fa-check"></i> Phone Provided';
  }
}

function renderAvatarPreview(url) {
  const preview = $("avatarPreview");
  const removeBtn = $("removeAvatarBtn");
  if (!preview) return;

  if (url && url.trim() !== "") {
    preview.src = url;
    if (removeBtn) removeBtn.style.display = "inline-flex";
  } else {
    preview.src = "/assets/images/avatar-placeholder.jpg";
    if (removeBtn) removeBtn.style.display = "none";
  }
}

async function handleAvatarFileSelect(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    showToast("Profile image size must be less than 5 MB", "error");
    return;
  }

  const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/webp"];
  if (!allowedTypes.includes(file.type)) {
    showToast("Invalid image format. Only JPG, PNG, and WebP images are allowed.", "error");
    return;
  }

  const spinner = $("avatarSpinner");
  if (spinner) spinner.style.display = "flex";

  try {
    const res = await supabaseAPI.uploadProfileAvatar(file);
    if (res.url) {
      currentProfilePhoto = res.url;
      renderAvatarPreview(res.url);
      showToast("Profile photo updated successfully", "success");
      await loadProfile();
    }
  } catch (err) {
    showToast(err.message || "Failed to upload image", "error");
  } finally {
    if (spinner) spinner.style.display = "none";
    e.target.value = "";
  }
}

async function handleRemoveAvatar() {
  currentProfilePhoto = "";
  renderAvatarPreview("");
  try {
    await supabaseAPI.updateStudentProfile({ profileImage: "", avatar: "" });
    showToast("Profile photo removed", "info");
    await loadProfile();
  } catch (err) {
    showToast(err.message || "Failed to remove photo", "error");
  }
}

async function saveProfile() {
  const name = $("pName")?.value.trim();
  const phone = $("pPhone")?.value.trim();
  const college = $("pCollege")?.value.trim();
  const course = $("pCourse")?.value.trim();
  const year = $("pYear")?.value;
  const gender = $("pGender")?.value;
  const guardianPhone = $("pEmergency")?.value.trim();

  if (!name) {
    showToast("Full name is required", "error");
    return;
  }
  if (!phone) {
    showToast("Phone number is required", "error");
    return;
  }
  if (!gender) {
    showToast("Please select gender", "error");
    return;
  }
  if (!college) {
    showToast("College/University is required", "error");
    return;
  }
  if (!course) {
    showToast("Course is required", "error");
    return;
  }
  if (!year) {
    showToast("Current year is required", "error");
    return;
  }
  if (!guardianPhone) {
    showToast("Emergency contact phone number is required", "error");
    return;
  }

  const btn = $("saveProfileBtn");
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
  }

  try {
    const payload = {
      name,
      phone,
      gender,
      bio: $("pBio")?.value.trim(),
      dob: $("pDob")?.value || null,
      college,
      course,
      branch: $("pBranch")?.value.trim(),
      year,
      studentId: $("pStudentId")?.value.trim(),
      preferredMoveInDate: $("pPrefMoveIn")?.value || null,
      expectedDuration: $("pDuration")?.value || "",
      preferredRoomType: $("pPrefRoom")?.value || "",
      budgetRange: $("pBudget")?.value.trim(),
      emergencyContact: {
        name: $("pGuardianName")?.value.trim() || "",
        relationship: $("pRelationship")?.value || "Parent",
        phone: guardianPhone
      },
      profileImage: currentProfilePhoto
    };

    const res = await supabaseAPI.updateStudentProfile(payload);
    showToast("Resident profile saved successfully!", "success");

    if (res.user?.name) {
      const navName = $("navbarName");
      if (navName) navName.textContent = res.user.name;
      const init = $("studentInitials");
      if (init) init.textContent = res.user.name.charAt(0).toUpperCase();
    }

    await loadProfile();

    // Auto-return to property booking if returnTo param exists
    if (returnTo && res.user?.isProfileComplete) {
      showToast("Profile complete! Returning to booking...", "success");
      setTimeout(() => {
        window.location.href = decodeURIComponent(returnTo);
      }, 1200);
    }

  } catch (err) {
    showToast(err.message || "Unable to save profile", "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Save Profile';
    }
  }
}
