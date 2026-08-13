// =====================================================
// CAMPORA STUDENT V3 - DOCUMENTS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, esc, inr, imageUrl } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  loadDocuments();
});

async function loadDocuments() {
  try {
    const data = await apiFetch("/student/documents");
    const docs = data.documents || {};
    renderAgreements(docs.agreements || []);
    renderReceipts(docs.receipts || []);
    renderIdProofs(docs.idProofs || []);
  } catch (err) {
    ["agreementsList", "receiptsList", "idList"].forEach((id) => {
      const el = $(id);
      if (el) el.innerHTML = `<div class="sv3-error"><p>${esc(err.message)}</p></div>`;
    });
  }
}

function renderAgreements(agreements) {
  const list = $("agreementsList");
  if (!list) return;
  if (agreements.length === 0) {
    list.innerHTML = `<div class="sv3-empty" style="padding:30px"><i class="fa-solid fa-file-signature"></i><p>No rental agreements yet. Confirm a booking to generate one.</p></div>`;
    return;
  }
  list.innerHTML = agreements.map((a) => `
    <div class="sv3-list-item">
      <div class="sv3-list-item-icon"><i class="fa-solid fa-file-signature"></i></div>
      <div class="sv3-list-item-body">
        <div class="sv3-list-item-title">${esc(a.title)}</div>
        <div class="sv3-list-item-sub">${esc(a.property)} · ${a.date ? new Date(a.date).toLocaleDateString() : ""}</div>
      </div>
      <button class="sv3-btn sv3-btn-ghost" onclick="window.open('/pages/student/booking-details.html?id=${a.bookingId}','_blank')"><i class="fa-solid fa-eye"></i> View</button>
    </div>`).join("");
}

function renderReceipts(receipts) {
  const list = $("receiptsList");
  if (!list) return;
  if (receipts.length === 0) {
    list.innerHTML = `<div class="sv3-empty" style="padding:30px"><i class="fa-solid fa-receipt"></i><p>No payment receipts yet.</p></div>`;
    return;
  }
  list.innerHTML = receipts.map((r) => `
    <div class="sv3-list-item">
      <div class="sv3-list-item-icon"><i class="fa-solid fa-receipt"></i></div>
      <div class="sv3-list-item-body">
        <div class="sv3-list-item-title">${esc(r.title)}</div>
        <div class="sv3-list-item-sub">${esc(r.property)} · ${r.date ? new Date(r.date).toLocaleDateString() : ""}</div>
      </div>
      <div class="sv3-list-item-title" style="color:#22c55e">${inr(r.amount || 0)}</div>
    </div>`).join("");
}

function renderIdProofs(idProofs) {
  const list = $("idList");
  if (!list) return;
  if (idProofs.length === 0) {
    list.innerHTML = `<div class="sv3-empty" style="padding:30px"><i class="fa-solid fa-id-card"></i><p>No ID proofs uploaded yet.</p></div>`;
    return;
  }
  list.innerHTML = idProofs.map((p) => `
    <div class="sv3-list-item">
      <div class="sv3-list-item-icon"><i class="fa-solid fa-id-card"></i></div>
      <div class="sv3-list-item-body">
        <div class="sv3-list-item-title">${esc(p.title)}</div>
        <div class="sv3-list-item-sub">${p.date ? new Date(p.date).toLocaleDateString() : ""}</div>
      </div>
      <button class="sv3-btn sv3-btn-ghost" onclick="window.open('${imageUrl(p.url)}','_blank')"><i class="fa-solid fa-eye"></i> View</button>
    </div>`).join("");
}
