// =====================================================
// CAMPORA STUDENT V3 - PAYMENTS
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, inr, esc, timeAgo } from "./student-utils.js";

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  loadSummary();
  loadInvoices();
  loadTransactions();
});

async function loadSummary() {
  try {
    const data = await apiFetch("/student/finance/summary");
    const s = data.summary || {};
    if ($("statDue")) $("statDue").textContent = inr(s.totalDue || 0);
    if ($("statPaid")) $("statPaid").textContent = inr(s.totalPaid || 0);
    if ($("statPending")) $("statPending").textContent = (s.pendingCount || 0) + (s.overdueCount || 0);
    if ($("statPaidCount")) $("statPaidCount").textContent = s.paidCount || 0;
  } catch (err) {
    // silent
  }
}

async function loadInvoices() {
  const list = $("invoiceList");
  if (!list) return;
  try {
const data = await apiFetch("/student/finance/invoices");
    const invoices = data.invoices || [];
    if (invoices.length === 0) {
      list.innerHTML = `<div class="sv3-empty"><i class="fa-solid fa-file-invoice"></i><h3>No invoices</h3><p>Your rent invoices will appear here.</p></div>`;
      return;
    }
    list.innerHTML = invoices.map((inv) => {
      const prop = inv.propertyId || {};
      const name = prop.propertyName || "Property";
      const status = inv.status || "pending";
      const color = status === "paid" ? "success" : status === "overdue" ? "danger" : status === "cancelled" ? "neutral" : "warning";
      const outstanding = Number(inv.totalAmount || 0) - Number(inv.amountPaid || 0);
      return `
        <div class="sv3-list-item">
          <div class="sv3-list-item-icon"><i class="fa-solid fa-file-invoice"></i></div>
          <div class="sv3-list-item-body">
            <div class="sv3-list-item-title">${esc(inv.invoiceNumber || "Invoice")} · ${esc(name)}</div>
            <div class="sv3-list-item-sub">${inr(inv.totalAmount || 0)} · Due ${inv.dueDate ? new Date(inv.dueDate).toLocaleDateString() : ""}${status === "partial" ? ` · ${inr(outstanding)} remaining` : ""}</div>
          </div>
          <span class="sv3-pill sv3-pill-${color}">${status.charAt(0).toUpperCase() + status.slice(1)}</span>
        </div>`;
    }).join("");
  } catch (err) {
    list.innerHTML = `<div class="sv3-error"><p>${esc(err.message)}</p></div>`;
  }
}

async function loadTransactions() {
  const body = $("transactionBody");
  if (!body) return;
  try {
const data = await apiFetch("/student/finance/summary");
    const transactions = data.transactions || [];
    if (transactions.length === 0) {
      body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--sv3-muted)">No transactions yet</td></tr>`;
      return;
    }
    body.innerHTML = transactions.map((t) => `
      <tr>
        <td>${esc(t.invoiceNumber || "—")}</td>
        <td style="font-weight:700">${inr(t.amount || 0)}</td>
        <td>${esc(t.method || "Online")}</td>
        <td>${t.paidAt ? new Date(t.paidAt).toLocaleDateString() : "—"}</td>
      </tr>`).join("");
  } catch (err) {
    body.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--sv3-muted)">${esc(err.message)}</td></tr>`;
  }
}
