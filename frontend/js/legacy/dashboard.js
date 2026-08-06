// =====================================================
// ⚠️ DEPRECATED LEGACY FILE — ARCHIVED
// -----------------------------------------------------
// This file is no longer referenced by any HTML page.
// It has been superseded by `dashboard-v2.js`.
// Kept only for historical reference. Do NOT use.
// =====================================================

// ==========================================
// CAMPORA DASHBOARD
// ==========================================

import { API } from "./config.js";

const API_BASE = API;

// ------------------------------------------
// CHECK LOGIN
// ------------------------------------------

const token = localStorage.getItem("camporaToken");
const user = JSON.parse(localStorage.getItem("camporauser"));

if (!token || !user) {

    window.location.href = "login.html";

}

// ------------------------------------------
// SHOW USER
// ------------------------------------------

const welcomeText = document.getElementById("welcomeText");

if (welcomeText) {

    welcomeText.innerHTML =
        `Welcome, ${user.name} 👋`;

}

// ------------------------------------------
// PROFILE NAME
// ------------------------------------------

const profileName = document.getElementById("profileName");

if (profileName) {

    profileName.innerText = user.name;

}

const profileEmail = document.getElementById("profileEmail");

if (profileEmail) {

    profileEmail.innerText = user.email;

}

// ------------------------------------------
// LOGOUT
// ------------------------------------------

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.addEventListener("click", () => {

        localStorage.removeItem("camporaToken");

        localStorage.removeItem("camporauser");

        window.location.href = "login.html";

    });

}

// ------------------------------------------
// LOADER
// ------------------------------------------

window.addEventListener("load", () => {

    const loader = document.querySelector(".loader");

    if (loader) {

        loader.classList.add("hide");

    }

});

// ------------------------------------------
// TOAST
// ------------------------------------------

function showToast(message, type = "success") {

    const container =
        document.querySelector(".toast-container");

    if (!container) return;

    const toast =
        document.createElement("div");

    toast.className =
        `toast ${type}`;

    toast.innerHTML = `

        <h4>${type.toUpperCase()}</h4>

        <p>${message}</p>

    `;

    container.appendChild(toast);

    setTimeout(() => {

        toast.remove();

    }, 3000);

}

console.log("✅ Dashboard Loaded");
