// =====================================================
// CAMPORA OWNER MESSAGES V3
// =====================================================

import { initShell, apiFetch, showToast, $ } from "./owner-shell.js";

const DOM = {
  conversationList: $("conversationList"),
  chatHeader: $("chatHeader"),
  chatAvatar: $("chatAvatar"),
  chatStudentName: $("chatStudentName"),
  chatStudentMeta: $("chatStudentMeta"),
  chatMessages: $("chatMessages"),
  chatInputBar: $("chatInputBar"),
  chatInput: $("chatInput"),
  sendBtn: $("sendBtn"),
};

let conversations = [];
let currentConversationId = null;
let pollTimer = null;

// =====================================================
// INIT
// =====================================================

initShell("Messages");

document.addEventListener("DOMContentLoaded", () => {
  setupListeners();
  loadConversations();
});

function setupListeners() {
  DOM.sendBtn?.addEventListener("click", sendMessage);
  DOM.chatInput?.addEventListener("keydown", (e) => { if (e.key === "Enter") sendMessage(); });
}

// =====================================================
// CONVERSATIONS
// =====================================================

async function loadConversations() {
  DOM.conversationList.innerHTML = `<div class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading conversations...</div>`;

  try {
    const data = await apiFetch("/owner/messages/conversations");
    conversations = data.conversations || [];
    renderConversations();
  } catch (err) {
    console.error("Conversations load error:", err);
    DOM.conversationList.innerHTML = `<div class="v3-error" style="padding:30px"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load</h3><p>${err.message}</p></div>`;
  }
}

function renderConversations() {
  if (conversations.length === 0) {
    DOM.conversationList.innerHTML = `<div class="v3-empty" style="padding:30px"><i class="fa-solid fa-comments"></i><h3>No Conversations</h3><p>Student messages will appear here.</p></div>`;
    return;
  }

  DOM.conversationList.innerHTML = "";

  conversations.forEach((conv) => {
    const student = conv.studentId || {};
    const property = conv.propertyId || {};
    const name = student.name || "Student";
    const unread = conv.unreadByOwner || 0;
    const lastTime = conv.lastMessageAt ? timeAgo(conv.lastMessageAt) : "";

    const item = document.createElement("div");
    item.className = `conv-item ${conv._id === currentConversationId ? "active" : ""}`;
    item.style.cssText = "display:flex;align-items:center;gap:12px;padding:16px 18px;border-bottom:1px solid rgba(255,255,255,.04)";
    item.innerHTML = `
      <div class="v3-avatar" style="width:44px;height:44px;font-size:17px;flex-shrink:0">${(name.charAt(0) || "S").toUpperCase()}</div>
      <div style="flex:1;min-width:0">
        <div style="display:flex;justify-content:space-between;align-items:center">
          <strong style="font-size:14px">${name}</strong>
          <span style="font-size:11px;color:var(--v3-muted)">${lastTime}</span>
        </div>
        <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px">
          <span style="font-size:12.5px;color:var(--v3-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:160px">${conv.lastMessage || property.propertyName || "New conversation"}</span>
          ${unread > 0 ? `<span class="v3-pill v3-pill-danger" style="padding:2px 8px;font-size:11px">${unread}</span>` : ""}
        </div>
      </div>
    `;

    item.addEventListener("click", () => openConversation(conv._id));
    DOM.conversationList.appendChild(item);
  });
}

// =====================================================
// OPEN CONVERSATION
// =====================================================

async function openConversation(id) {
  currentConversationId = id;
  renderConversations();

  const conv = conversations.find((c) => c._id === id);
  const student = conv?.studentId || {};
  const property = conv?.propertyId || {};
  const name = student.name || "Student";

  if (DOM.chatAvatar) DOM.chatAvatar.textContent = (name.charAt(0) || "S").toUpperCase();
  if (DOM.chatStudentName) DOM.chatStudentName.textContent = name;
  if (DOM.chatStudentMeta) DOM.chatStudentMeta.textContent = `${property.propertyName || ""}${student.phone ? " • " + student.phone : ""}`;
  if (DOM.chatInputBar) DOM.chatInputBar.style.display = "flex";

  DOM.chatMessages.innerHTML = `<div class="v3-loading"><i class="fa-solid fa-spinner fa-spin"></i> Loading messages...</div>`;

  try {
    const data = await apiFetch(`/owner/messages/conversation/${id}/messages`);
    renderMessages(data.messages || []);
    // Update unread badge
    const unread = await apiFetch("/owner/messages/unread-count");
    updateUnreadBadge(unread.unreadCount || 0);
    startPolling(id);
  } catch (err) {
    console.error("Messages load error:", err);
    DOM.chatMessages.innerHTML = `<div class="v3-error" style="padding:30px"><i class="fa-solid fa-exclamation-triangle"></i><h3>Failed to Load Messages</h3><p>${err.message}</p></div>`;
  }
}

function renderMessages(messages) {
  DOM.chatMessages.innerHTML = "";

  if (messages.length === 0) {
    DOM.chatMessages.innerHTML = `<div class="v3-empty" style="padding:40px"><i class="fa-solid fa-comments"></i><h3>No messages yet</h3><p>Say hello to your student!</p></div>`;
    return;
  }

  messages.forEach((m) => {
    const isOwner = m.sender === "owner";
    const time = m.createdAt ? new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "";
    const bubble = document.createElement("div");
    bubble.className = `msg-bubble ${isOwner ? "msg-owner" : "msg-student"}`;
    bubble.innerHTML = `
      <div>${m.text || (m.attachment ? "📎 Attachment" : "")}</div>
      ${m.isBroadcast ? `<div style="font-size:11px;opacity:.8;margin-top:2px">📢 Broadcast</div>` : ""}
      <div class="msg-time">${time}</div>
    `;
    DOM.chatMessages.appendChild(bubble);
  });

  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;
}

// =====================================================
// SEND MESSAGE
// =====================================================

async function sendMessage() {
  const text = DOM.chatInput?.value.trim();
  if (!text || !currentConversationId) return;

  DOM.chatInput.value = "";
  try {
    await apiFetch(`/owner/messages/conversation/${currentConversationId}/send`, {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    // Reload messages
    const data = await apiFetch(`/owner/messages/conversation/${currentConversationId}/messages`);
    renderMessages(data.messages || []);
  } catch (err) {
    showToast("Failed to send: " + err.message, "error");
    DOM.chatInput.value = text;
  }
}

// =====================================================
// POLLING
// =====================================================

function startPolling(convId) {
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(async () => {
    if (currentConversationId !== convId) return;
    try {
      const data = await apiFetch(`/owner/messages/conversation/${convId}/messages`);
      renderMessages(data.messages || []);
    } catch (e) { /* ignore */ }
  }, 5000);
}

function updateUnreadBadge(count) {
  const badge = document.getElementById("unreadNotifications");
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? "inline-flex" : "none";
  }
}

function timeAgo(input) {
  const now = new Date();
  const date = new Date(input);
  const diff = (now - date) / 1000;
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}d`;
  return date.toLocaleDateString();
}

window.showToast = (...args) => showToast(...args);
console.log("✅ Campora Owner Messages V3 initialised");
