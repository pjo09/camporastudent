// =====================================================
// CAMPORA STUDENT V3 - SUPPORT
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, showToast, esc } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  prefill();
  $("supportForm")?.addEventListener("submit", submitSupport);
});

async function prefill() {
  try {
    const data = await apiFetch("/student/profile");
    const u = data.user || {};
    if ($("supName")) $("supName").value = u.name || "";
    if ($("supEmail")) $("supEmail").value = u.email || "";
  } catch (err) {
    // silent
  }
}

async function submitSupport(e) {
  e.preventDefault();
  const btn = $("supSubmit");
  if (!btn) return;
  btn.disabled = true;
  try {
    const payload = {
      name: $("supName")?.value.trim(),
      email: $("supEmail")?.value.trim(),
      subject: $("supSubject")?.value.trim(),
      message: $("supMessage")?.value.trim(),
    };
    if (!payload.subject) throw new Error("Please enter a subject");
    if (!payload.message) throw new Error("Please describe your issue");

    await apiFetch("/contact", { method: "POST", body: JSON.stringify(payload) });
    showToast("Support request sent! We'll get back to you soon.", "success");
    e.target.reset();
  } catch (err) {
    showToast(err.message || "Unable to send support request", "error");
  } finally {
    btn.disabled = false;
  }
}
