// =====================================================
// CAMPORA OWNER REVIEWS V3
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  reviewsList: $("reviewsList"),
  reviewSearch: $("reviewSearch"),
  filterBtns: document.querySelectorAll(".v3-filter-btn"),
  replyModal: $("replyModal"),
  closeReplyModal: $("closeReplyModal"),
  replyModalContent: $("replyModalContent"),
};

let reviews = [];
let currentFilter = "all";

// =====================================================
// INIT
// =====================================================

initShell("Reviews");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadReviews();
});

function setupListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderReviews();
    });
  });

  DOM.reviewSearch?.addEventListener("input", (e) => {
    const term = e.target.value.trim().toLowerCase();
    renderReviews(term);
  });

  DOM.closeReplyModal?.addEventListener("click", () => DOM.replyModal.classList.remove("active"));
  DOM.replyModal?.addEventListener("click", (e) => { if (e.target === DOM.replyModal) DOM.replyModal.classList.remove("active"); });
}

// =====================================================
// LOAD & RENDER
// =====================================================

async function loadReviews() {
  DOM.reviewsList.innerHTML = `<div class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading reviews...</div>`;

  try {
    const data = await apiFetch("/owner/reviews");
    reviews = data.reviews || [];
    renderReviews();
  } catch (err) {
    console.error("Reviews load error:", err);
    DOM.reviewsList.innerHTML = `<div class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load</h3><p>${err.message}</p></div>`;
  }
}

function renderReviews(searchTerm = "") {
  let filtered = reviews;
  if (currentFilter !== "all") filtered = filtered.filter((r) => (r.status || "approved") === currentFilter);
  if (searchTerm) {
    filtered = filtered.filter((r) => {
      const comment = (r.comment || "").toLowerCase();
      const user = (r.user?.name || "").toLowerCase();
      const prop = (r.property?.propertyName || "").toLowerCase();
      return comment.includes(searchTerm) || user.includes(searchTerm) || prop.includes(searchTerm);
    });
  }

  if (filtered.length === 0) {
    DOM.reviewsList.innerHTML = `<div class="v3-empty"><i class="fa-solid fa-star"></i><h3>No Reviews Found</h3><p>Reviews from students will appear here.</p></div>`;
    return;
  }

  DOM.reviewsList.innerHTML = filtered.map((r) => {
    const status = r.status || "approved";
    const statusColor = status === "approved" ? "success" : status === "hidden" ? "danger" : "warning";
    const stars = "★".repeat(Math.max(0, Math.min(5, r.rating || 0))) + "☆".repeat(Math.max(0, 5 - (r.rating || 0)));
    const date = r.createdAt ? new Date(r.createdAt).toLocaleDateString() : "";
    return `
      <div class="v3-card v3-animate" style="margin-bottom:16px">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:12px;flex-wrap:wrap">
          <div style="display:flex;gap:14px;align-items:flex-start">
            <div class="v3-avatar" style="width:46px;height:46px;font-size:18px">${(r.user?.name?.charAt(0) || "S").toUpperCase()}</div>
            <div>
              <div style="display:flex;align-items:center;gap:10px;flex-wrap:wrap">
                <strong>${r.user?.name || "Student"}</strong>
                <span style="color:#fbbf24">${stars}</span>
                <span class="v3-pill v3-pill-${statusColor}">${status.toUpperCase()}</span>
              </div>
              <p style="color:var(--v3-muted);font-size:13px;margin-top:4px">${r.property?.propertyName || ""} • ${date}</p>
            </div>
          </div>
        </div>
        <p style="margin-top:14px;line-height:1.7;font-size:14.5px">${r.comment || "No comment"}</p>
        ${r.ownerReply ? `<div style="margin-top:14px;padding:14px;border-radius:14px;background:rgba(37,99,235,.08);border-left:3px solid #2563eb">
          <strong style="font-size:13px;color:#60a5fa">Your Reply</strong>
          <p style="margin-top:6px;font-size:13.5px;line-height:1.6">${r.ownerReply}</p>
        </div>` : ""}
        <div style="display:flex;gap:8px;margin-top:16px;flex-wrap:wrap">
          <button class="v3-btn v3-btn-ghost v3-btn-sm" data-action="reply" data-id="${r._id}"><i class="fa-solid fa-reply"></i> Reply</button>
          ${status !== "hidden" ? `<button class="v3-btn v3-btn-danger v3-btn-sm" data-action="hide" data-id="${r._id}"><i class="fa-solid fa-eye-slash"></i> Hide</button>` : ""}
        </div>
      </div>`;
  }).join("");

  DOM.reviewsList.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "reply") openReplyModal(id);
      if (action === "hide") hideReview(id);
    });
  });
}

// =====================================================
// REPLY
// =====================================================

function openReplyModal(id) {
  const review = reviews.find((r) => r._id === id);
  if (!review) return;

  DOM.replyModalContent.innerHTML = `
    <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04);margin-bottom:16px">
      <div style="display:flex;align-items:center;gap:10px;color:#fbbf24">
        ${"★".repeat(Math.max(0, Math.min(5, review.rating || 0)))}
        <span style="color:var(--v3-muted);font-size:13px">${review.user?.name || "Student"}</span>
      </div>
      <p style="margin-top:10px;font-size:14px;line-height:1.6">${review.comment || ""}</p>
    </div>
    <div class="v3-form-group">
      <label for="replyText">Your Reply</label>
      <textarea id="replyText" rows="4" placeholder="Thank the student and address their feedback...">${review.ownerReply || ""}</textarea>
    </div>
    <button class="v3-btn v3-btn-primary" style="width:100%" id="saveReplyBtn"><i class="fa-solid fa-paper-plane"></i> Submit Reply</button>
  `;

  DOM.replyModalContent.querySelector("#saveReplyBtn").addEventListener("click", async () => {
    const text = DOM.replyModalContent.querySelector("#replyText").value.trim();
    if (!text) return showToast("Reply cannot be empty", "error");
    try {
      await apiFetch(`/owner/reviews/${id}/reply`, {
        method: "POST",
        body: JSON.stringify({ reply: text }),
      });
      showToast("Reply added successfully", "success");
      DOM.replyModal.classList.remove("active");
      loadReviews();
    } catch (err) {
      showToast("Failed to add reply: " + err.message, "error");
    }
  });

  DOM.replyModal.classList.add("active");
}

// =====================================================
// HIDE
// =====================================================

async function hideReview(id) {
  if (!confirm("Hide this review from public view?")) return;
  try {
    await apiFetch(`/owner/reviews/${id}/hide`, { method: "PATCH" });
    showToast("Review hidden", "success");
    loadReviews();
  } catch (err) {
    showToast("Failed to hide review: " + err.message, "error");
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Reviews V3 initialised");
