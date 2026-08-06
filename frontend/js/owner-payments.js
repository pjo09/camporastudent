// =====================================================
// CAMPORA OWNER PAYMENTS V3
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  invoicesBody: $("invoicesBody"),
  transactionsBody: $("transactionsBody"),
  totalCollected: $("totalCollected"),
  totalOutstanding: $("totalOutstanding"),
  overdueCount: $("overdueCount"),
  paidCount: $("paidCount"),
  filterBtns: document.querySelectorAll(".v3-section .v3-filter-btn"),
  newInvoiceBtn: $("newInvoiceBtn"),
  newInvoiceModal: $("newInvoiceModal"),
  closeNewInvoiceModal: $("closeNewInvoiceModal"),
  newInvoiceForm: $("newInvoiceForm"),
  invStudent: $("invStudent"),
  invProperty: $("invProperty"),
  invFrom: $("invFrom"),
  invTo: $("invTo"),
  invDue: $("invDue"),
  invRent: $("invRent"),
  invMaintenance: $("invMaintenance"),
  invElectricity: $("invElectricity"),
  invFood: $("invFood"),
  invOther: $("invOther"),
  invDiscount: $("invDiscount"),
  invNotes: $("invNotes"),
  payModal: $("payModal"),
  closePayModal: $("closePayModal"),
  payModalContent: $("payModalContent"),
};

let invoices = [];
let transactions = [];
let currentFilter = "all";
let properties = [];
let students = [];

// =====================================================
// INIT
// =====================================================

initShell("Payments");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadInvoices();
  loadSummary();
  loadFormData();
});

function setupListeners() {
  DOM.filterBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      currentFilter = btn.dataset.filter;
      DOM.filterBtns.forEach((b) => b.classList.toggle("active", b === btn));
      renderInvoices();
    });
  });

  DOM.newInvoiceBtn?.addEventListener("click", () => DOM.newInvoiceModal.classList.add("active"));
  DOM.closeNewInvoiceModal?.addEventListener("click", () => DOM.newInvoiceModal.classList.remove("active"));
  DOM.newInvoiceModal?.addEventListener("click", (e) => { if (e.target === DOM.newInvoiceModal) DOM.newInvoiceModal.classList.remove("active"); });
  DOM.newInvoiceForm?.addEventListener("submit", handleNewInvoice);

  DOM.closePayModal?.addEventListener("click", () => DOM.payModal.classList.remove("active"));
  DOM.payModal?.addEventListener("click", (e) => { if (e.target === DOM.payModal) DOM.payModal.classList.remove("active"); });
}

// =====================================================
// LOAD DATA
// =====================================================

async function loadInvoices() {
  DOM.invoicesBody.innerHTML = `<tr><td colspan="9" class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading invoices...</td></tr>`;

  try {
    const data = await apiFetch("/owner/finance/invoices");
    invoices = data.invoices || [];
    renderInvoices();
  } catch (err) {
    console.error("Invoices load error:", err);
    DOM.invoicesBody.innerHTML = `<tr><td colspan="9" class="v3-error"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load</h3><p>${err.message}</p></td></tr>`;
  }
}

async function loadSummary() {
  try {
    const data = await apiFetch("/owner/finance/summary");
    const s = data.summary || {};
    transactions = data.transactions || [];
    if (DOM.totalCollected) DOM.totalCollected.textContent = `₹${Number(s.totalCollected || 0).toLocaleString()}`;
    if (DOM.totalOutstanding) DOM.totalOutstanding.textContent = `₹${Number(s.totalOutstanding || 0).toLocaleString()}`;
    if (DOM.overdueCount) DOM.overdueCount.textContent = s.overdueCount || 0;
    if (DOM.paidCount) DOM.paidCount.textContent = s.totalPaidCount || 0;
    renderTransactions();
  } catch (err) { /* silent */ }
}

async function loadFormData() {
  try {
    const [propData, studentData] = await Promise.all([
      apiFetch("/owner/properties?limit=100"),
      apiFetch("/owner/students?limit=100"),
    ]);
    properties = propData.properties || [];
    students = studentData.students || [];

    if (DOM.invProperty) {
      DOM.invProperty.innerHTML = properties.map((p) => `<option value="${p._id}">${p.propertyName || "Property"}</option>`).join("");
    }
    if (DOM.invStudent) {
      DOM.invStudent.innerHTML = students.map((s) => {
        const st = s.student || s.userId || s;
        return `<option value="${st._id}">${st.name || "Student"}</option>`;
      }).join("");
    }
  } catch (err) { /* silent */ }
}

// =====================================================
// RENDER INVOICES
// =====================================================

function renderInvoices() {
  let filtered = invoices;
  if (currentFilter !== "all") filtered = filtered.filter((i) => i.status === currentFilter);

  if (filtered.length === 0) {
    DOM.invoicesBody.innerHTML = `<tr><td colspan="9" class="v3-empty" style="padding:30px"><i class="fa-solid fa-receipt"></i><p>No invoices found</p></td></tr>`;
    return;
  }

  DOM.invoicesBody.innerHTML = filtered.map((inv) => {
    const student = inv.studentId || {};
    const property = inv.propertyId || {};
    const statusColor = inv.status === "paid" ? "success" : inv.status === "overdue" ? "danger" : inv.status === "partial" ? "warning" : inv.status === "cancelled" ? "purple" : "info";
    return `
      <tr>
        <td style="font-weight:700;color:#60a5fa">${inv.invoiceNumber || "INV"}</td>
        <td>${student.name || "—"}</td>
        <td style="font-size:13px">${property.propertyName || "—"}</td>
        <td style="font-size:13px">${inv.periodFrom ? new Date(inv.periodFrom).toLocaleDateString() : "—"} → ${inv.periodTo ? new Date(inv.periodTo).toLocaleDateString() : "—"}</td>
        <td style="font-size:13px">${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : "—"}</td>
        <td style="font-weight:700">₹${Number(inv.totalAmount).toLocaleString()}</td>
        <td style="font-weight:700;color:#4ade80">₹${Number(inv.amountPaid || 0).toLocaleString()}</td>
        <td><span class="v3-pill v3-pill-${statusColor}">${(inv.status || "pending").toUpperCase()}</span></td>
        <td>
          <div style="display:flex;gap:6px">
            ${inv.status !== "paid" ? `<button class="v3-btn v3-btn-success v3-btn-sm" data-action="pay" data-id="${inv._id}" title="Record Payment"><i class="fa-solid fa-hand-holding-dollar"></i></button>` : ""}
            ${inv.status === "pending" ? `<button class="v3-btn v3-btn-warning v3-btn-sm" data-action="overdue" data-id="${inv._id}" style="background:rgba(245,158,11,.15);color:#f59e0b" title="Mark Overdue"><i class="fa-solid fa-clock"></i></button>
            <button class="v3-btn v3-btn-danger v3-btn-sm" data-action="cancel" data-id="${inv._id}" title="Cancel"><i class="fa-solid fa-xmark"></i></button>` : ""}
          </div>
        </td>
      </tr>`;
  }).join("");

  DOM.invoicesBody.querySelectorAll("[data-action]").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "pay") openPayModal(id);
      if (action === "overdue") markOverdue(id);
      if (action === "cancel") cancelInvoice(id);
    });
  });
}

function renderTransactions() {
  if (!DOM.transactionsBody) return;
  if (transactions.length === 0) {
    DOM.transactionsBody.innerHTML = `<tr><td colspan="5" class="v3-empty" style="padding:30px"><i class="fa-solid fa-hand-holding-dollar"></i><p>No transactions yet</p></td></tr>`;
    return;
  }

  DOM.transactionsBody.innerHTML = transactions.map((t) => `
    <tr>
      <td style="font-size:13px">${t.paidAt ? new Date(t.paidAt).toLocaleDateString() : "—"}</td>
      <td style="font-weight:700;color:#60a5fa">${t.invoiceNumber || "—"}</td>
      <td style="font-weight:700">₹${Number(t.amount || 0).toLocaleString()}</td>
      <td><span class="v3-pill v3-pill-cyan">${t.method || "Cash"}</span></td>
      <td style="font-size:13px">${t.note || "—"}</td>
    </tr>`).join("");
}

// =====================================================
// INVOICE ACTIONS
// =====================================================

function openPayModal(id) {
  const inv = invoices.find((i) => i._id === id);
  if (!inv) return;
  const remaining = (inv.totalAmount || 0) - (inv.amountPaid || 0);

  DOM.payModalContent.innerHTML = `
    <div style="padding:14px;border-radius:14px;background:rgba(255,255,255,.04);margin-bottom:16px">
      <div style="display:flex;justify-content:space-between">
        <span style="color:var(--v3-muted)">Invoice</span>
        <strong>${inv.invoiceNumber}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px">
        <span style="color:var(--v3-muted)">Total</span>
        <strong>₹${Number(inv.totalAmount).toLocaleString()}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px">
        <span style="color:var(--v3-muted)">Paid</span>
        <strong style="color:#4ade80">₹${Number(inv.amountPaid || 0).toLocaleString()}</strong>
      </div>
      <div style="display:flex;justify-content:space-between;margin-top:8px">
        <span style="color:var(--v3-muted)">Remaining</span>
        <strong style="color:#f59e0b">₹${Number(remaining).toLocaleString()}</strong>
      </div>
    </div>
    <div class="v3-form-group">
      <label for="payAmount">Amount (₹) *</label>
      <input type="number" id="payAmount" min="1" max="${remaining}" value="${remaining}" required>
    </div>
    <div class="v3-form-group">
      <label for="payMethod">Method</label>
      <select id="payMethod">
        <option>Cash</option>
        <option>UPI</option>
        <option>Bank Transfer</option>
        <option>Card</option>
        <option>Other</option>
      </select>
    </div>
    <div class="v3-form-group">
      <label for="payTxnId">Transaction ID</label>
      <input type="text" id="payTxnId" placeholder="Optional">
    </div>
    <div class="v3-form-group">
      <label for="payNote">Note</label>
      <input type="text" id="payNote" placeholder="Optional">
    </div>
    <button class="v3-btn v3-btn-primary" style="width:100%" id="savePaymentBtn"><i class="fa-solid fa-hand-holding-dollar"></i> Record Payment</button>
  `;

  DOM.payModalContent.querySelector("#savePaymentBtn").addEventListener("click", async () => {
    const amount = DOM.payModalContent.querySelector("#payAmount").value;
    const method = DOM.payModalContent.querySelector("#payMethod").value;
    const txnId = DOM.payModalContent.querySelector("#payTxnId").value;
    const note = DOM.payModalContent.querySelector("#payNote").value;
    await recordPayment(id, amount, method, txnId, note);
  });

  DOM.payModal.classList.add("active");
}

async function recordPayment(id, amount, method, txnId, note) {
  try {
    await apiFetch(`/owner/finance/invoices/${id}/pay`, {
      method: "POST",
      body: JSON.stringify({ amount, method, transactionId: txnId, note }),
    });
    showToast("Payment recorded successfully", "success");
    DOM.payModal.classList.remove("active");
    loadInvoices();
    loadSummary();
  } catch (err) {
    showToast("Failed to record payment: " + err.message, "error");
  }
}

async function markOverdue(id) {
  try {
    await apiFetch(`/owner/finance/invoices/${id}/overdue`, { method: "PATCH" });
    showToast("Invoice marked as overdue", "success");
    loadInvoices();
    loadSummary();
  } catch (err) {
    showToast("Failed to update invoice: " + err.message, "error");
  }
}

async function cancelInvoice(id) {
  if (!confirm("Cancel this invoice?")) return;
  try {
    await apiFetch(`/owner/finance/invoices/${id}/cancel`, { method: "PATCH" });
    showToast("Invoice cancelled", "success");
    loadInvoices();
    loadSummary();
  } catch (err) {
    showToast("Failed to cancel invoice: " + err.message, "error");
  }
}

// =====================================================
// CREATE INVOICE
// =====================================================

async function handleNewInvoice(e) {
  e.preventDefault();
  const btn = DOM.newInvoiceForm.querySelector("button[type='submit']");
  btn.disabled = true;

  try {
    await apiFetch("/owner/finance/invoices", {
      method: "POST",
      body: JSON.stringify({
        studentId: DOM.invStudent.value,
        propertyId: DOM.invProperty.value,
        periodFrom: DOM.invFrom.value,
        periodTo: DOM.invTo.value,
        dueDate: DOM.invDue.value,
        rentAmount: DOM.invRent.value,
        maintenanceCharge: DOM.invMaintenance.value || 0,
        electricityCharge: DOM.invElectricity.value || 0,
        foodCharge: DOM.invFood.value || 0,
        otherCharges: DOM.invOther.value || 0,
        discount: DOM.invDiscount.value || 0,
        notes: DOM.invNotes.value,
      }),
    });
    showToast("Invoice created successfully", "success");
    DOM.newInvoiceForm.reset();
    DOM.newInvoiceModal.classList.remove("active");
    loadInvoices();
    loadSummary();
  } catch (err) {
    showToast("Failed to create invoice: " + err.message, "error");
  } finally {
    btn.disabled = false;
  }
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Payments V3 initialised");
