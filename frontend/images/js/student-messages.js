// =====================================================
// CAMPORA STUDENT V3 - MESSAGES
// =====================================================

import { $, apiFetch, initShell, loadUnreadCount, esc, timeAgo, showToast } from "./student-utils.js";

let conversations = [];
let activeConvId = null;

document.addEventListener("DOMContentLoaded", () => {
  initShell();
  loadUnreadCount();
  loadConversations();
  setupSend();
});

async function loadConversations() {
  const list = $("convoList");
  if (!list) return;
  try {
const data = await apiFetch("/student/messages/conversations");
    conversations = data.conversations || [];
    if (conversations.length === 0) {
      list.innerHTML = `<div class="sv3-empty" style="padding:40px 20px"><i class="fa-solid fa-comments"></i><h3>No conversations</h3><p>Contact an owner from a property page to start chatting.</p></div>`;
      return;
    }
    list.innerHTML = conversations.map((c) => {
      const owner = c.ownerId || {};
      const prop = c.propertyId || {};
      const name = owner.businessName || owner.name || "Owner";
      const unread = c.unreadByStudent || 0;
      return `
        <div class="sv3-convo-item ${c._id === activeConvId ? "active" : ""}" data-id="${c._id}" onclick="window.openConv('${c._id}')">
          <div class="sv3-convo-avatar">${(name || "O").charAt(0).toUpperCase()}</div>
          <div class="sv3-convo-body">
            <div class="sv3-convo-name">${esc(name)}</div>
            <div class="sv3-convo-last">${esc(c.lastMessage || "No messages yet")} · ${prop.propertyName || ""}</div>
          </div>
          <div class="sv3-convo-meta">
            <div class="sv3-convo-time">${c.lastMessageAt ? timeAgo(c.lastMessageAt) : ""}</div>
            ${unread > 0 ? `<div class="sv3-convo-unread">${unread}</div>` : ""}
          </div>
        </div>`;
    }).join("");
  } catch (err) {
    list.innerHTML = `<div class="sv3-error" style="margin:20px"><p>${esc(err.message)}</p></div>`;
  }
}

window.openConv = async function (convId) {
  activeConvId = convId;
  loadConversations();
  try {
const data = await apiFetch(`/student/messages/conversation/${convId}/messages`);
    const messages = data.messages || [];
    const conv = conversations.find((c) => c._id === convId);
    const owner = conv?.ownerId || {};
    const name = owner.businessName || owner.name || "Owner";
    if ($("chatName")) $("chatName").textContent = name;
    if ($("chatAvatar")) $("chatAvatar").textContent = name.charAt(0).toUpperCase();
    const input = $("messageInput");
    const send = $("sendBtn");
    if (input) input.disabled = false;
    if (send) send.disabled = false;

    const container = $("chatMessages");
    if (messages.length === 0) {
      container.innerHTML = `<div class="sv3-empty" style="padding:40px"><p>No messages yet. Say hello!</p></div>`;
      return;
    }
    container.innerHTML = messages.map((m) => {
      const isOut = m.sender === "student";
      return `
        <div class="sv3-msg ${isOut ? "sv3-msg-out" : "sv3-msg-in"}">
          ${esc(m.text || "")}
          <span class="sv3-msg-time">${m.createdAt ? new Date(m.createdAt).toLocaleString() : ""}</span>
        </div>`;
    }).join("");
    container.scrollTop = container.scrollHeight;
  } catch (err) {
    showToast(err.message || "Unable to load messages", "error");
  }
};

function setupSend() {
  const input = $("messageInput");
  const send = $("sendBtn");
  if (!input || !send) return;
  const doSend = async () => {
    const text = input.value.trim();
    if (!text || !activeConvId) return;
    send.disabled = true;
    try {
await apiFetch(`/student/messages/conversation/${activeConvId}/send`, {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      input.value = "";
      openConv(activeConvId);
    } catch (err) {
      showToast(err.message || "Unable to send message", "error");
    } finally {
      send.disabled = false;
    }
  };
  send.addEventListener("click", doSend);
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") doSend();
  });
}
