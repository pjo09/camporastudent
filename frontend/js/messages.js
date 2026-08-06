// =====================================================
// CAMPORA MESSAGES PAGE
// Conversations + Chat Architecture
// =====================================================

import { getToken, getUser, protectPageByRole, logout as sessionLogout } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

const $ = (id) => document.getElementById(id);

const DOM = {
  conversationsList: $("conversationsList"),
  searchInput: $("conversationSearch"),
  chatArea: $("chatArea"),
  chatEmpty: $("chatEmpty"),
  chatActive: $("chatActive"),
  chatTitle: $("chatTitle"),
  chatStatus: $("chatStatus"),
  chatAvatar: $("chatAvatar"),
  chatMessages: $("chatMessages"),
  messageInput: $("messageInput"),
  sendBtn: $("sendMessageBtn"),
  backBtn: $("backToConversations"),
};

const state = {
  user: null,
  token: null,
  conversations: [],
  currentConv: null,
  messages: [],
  searchTerm: "",
};

state.user = protectPageByRole(["student"]);
state.token = getToken();
if (!state.user || !state.token) {}

// Load initial conversations from bookings (owner info)
init();

async function init() {
  await loadConversations();
  setupEventListeners();

  // Check if we have owner/property ID from URL
  const params = new URLSearchParams(window.location.search);
  const ownerId = params.get("owner");
  const propertyId = params.get("property");
  if (ownerId) {
    // Would create a new conversation with this owner
  }
}

async function loadConversations() {
  try {
    // Fetch bookings to get owner info as conversations
    const res = await fetch(`${API}/student/bookings`, {
      headers: { Authorization: `Bearer ${state.token}` },
    });
    const data = await res.json();
    const bookings = data.bookings || [];

    // Build conversations from unique owners
    const ownerMap = new Map();
    bookings.forEach((b) => {
      const prop = b.propertyId || {};
      const owner = prop.owner || {};
      if (owner._id && !ownerMap.has(owner._id)) {
        ownerMap.set(owner._id, {
          id: owner._id,
          name: owner.name || "Owner",
          propertyName: prop.propertyName || b.propertyName || "Property",
          lastMessage: `Booking for ${prop.propertyName || "property"}`,
          lastTime: b.createdAt,
          unread: 0,
          propertyId: prop._id || "",
        });
      }
    });

    state.conversations = Array.from(ownerMap.values());
    renderConversations();
  } catch (err) {
    console.error("Load conversations error:", err);
  }
}

function renderConversations() {
  const filtered = state.searchTerm
    ? state.conversations.filter((c) => c.name.toLowerCase().includes(state.searchTerm.toLowerCase()) || c.propertyName?.toLowerCase().includes(state.searchTerm.toLowerCase()))
    : state.conversations;

  DOM.conversationsList.innerHTML = "";

  if (filtered.length === 0) {
    DOM.conversationsList.innerHTML = `<div style="text-align:center;padding:40px 20px;color:#64748b"><i class="fa-solid fa-comments" style="font-size:40px;display:block;margin-bottom:12px"></i>No conversations yet</div>`;
    return;
  }

  filtered.forEach((conv) => {
    const el = document.createElement("div");
    el.className = `conversation-item${state.currentConv?.id === conv.id ? " active" : ""}`;
    el.innerHTML = `
      <div class="conversation-avatar">${conv.name.charAt(0).toUpperCase()}</div>
      <div class="conversation-content">
        <div class="conversation-name">${conv.name}</div>
        <div class="conversation-preview">${conv.propertyName} — ${conv.lastMessage || "No messages yet"}</div>
      </div>
      ${conv.lastTime ? `<span class="conversation-time">${timeAgo(conv.lastTime)}</span>` : ""}
      ${conv.unread > 0 ? '<div class="conversation-unread"></div>' : ""}`;
    el.addEventListener("click", () => openConversation(conv));
    DOM.conversationsList.appendChild(el);
  });
}

function openConversation(conv) {
  state.currentConv = conv;
  DOM.chatTitle.textContent = conv.name;
  DOM.chatStatus.textContent = `Owner — ${conv.propertyName}`;
  DOM.chatAvatar.textContent = conv.name.charAt(0).toUpperCase();

  // Show chat area, hide empty state
  DOM.chatEmpty.style.display = "none";
  DOM.chatActive.style.display = "flex";

  // On mobile, show only chat
  if (window.innerWidth <= 1024) {
    document.querySelector(".conversations-sidebar").style.display = "none";
    DOM.chatArea.classList.add("active");
    DOM.backBtn.style.display = "flex";
  }

  // Load messages (placeholder for now - will integrate with real backend)
  DOM.chatMessages.innerHTML = `
    <div class="message received">
      Hello! I'm interested in your property ${conv.propertyName}. Is it still available?
      <span class="message-time">${timeAgo(conv.lastTime)}</span>
    </div>`;

  // Update conversation list to show active
  renderConversations();
}

function setupEventListeners() {
  DOM.searchInput?.addEventListener("input", () => {
    state.searchTerm = DOM.searchInput.value.trim();
    renderConversations();
  });

  DOM.sendBtn?.addEventListener("click", sendMessage);
  DOM.messageInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  DOM.backBtn?.addEventListener("click", () => {
    document.querySelector(".conversations-sidebar").style.display = "flex";
    DOM.chatArea.classList.remove("active");
    DOM.backBtn.style.display = "none";
  });
}

function sendMessage() {
  const text = DOM.messageInput?.value.trim();
  if (!text || !state.currentConv) return;

  // Add message to UI (placeholder)
  const msgDiv = document.createElement("div");
  msgDiv.className = "message sent";
  msgDiv.innerHTML = `${text}<span class="message-time">Just now</span>`;
  DOM.chatMessages.appendChild(msgDiv);
  DOM.chatMessages.scrollTop = DOM.chatMessages.scrollHeight;

  DOM.messageInput.value = "";

  // In future: send to backend API
  // fetch(`${API}/messages`, { method: "POST", ... });
}

function timeAgo(dateInput) {
  const now = new Date();
  const date = new Date(dateInput);
  const diffSec = Math.floor((now - date) / 1000);
  if (diffSec < 60) return "Just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay}d`;
  return date.toLocaleDateString();
}

// Handle responsive resize
window.addEventListener("resize", () => {
  if (window.innerWidth > 1024) {
    document.querySelector(".conversations-sidebar").style.display = "flex";
    DOM.backBtn.style.display = "none";
  }
});

console.log("✅ Messages Page Loaded");

