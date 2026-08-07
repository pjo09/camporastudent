// ===============================================
// CAMPORA FRONTEND — SHARED APP BOOTSTRAP
// ===============================================
// This is a CLASSIC (non-module) script loaded by
// placeholder/stub pages (universities, forgot-password,
// admin login, etc.) via:
//   <script src="js/config.js"></script>
//   <script src="js/app.js"></script>
//
// It reads the globals injected by config.js
// (window.__CONFIG / window.__API) and provides a
// small, dependency-free bootstrap so these pages
// render without JS errors.
// ===============================================

(function () {
  "use strict";

  // ===========================================
  // CONFIG (injected by config.js)
  // ===========================================
  var CONFIG = window.__CONFIG || {};
  var API = window.__API || CONFIG.API_BASE || "";

  // ===========================================
  // HELPERS
  // ===========================================
  function $(id) {
    return document.getElementById(id);
  }

  // ===========================================
  // FOOTER YEAR
  // ===========================================
  function setFooterYear() {
    var year = $("year");
    if (year) year.textContent = new Date().getFullYear();
  }

  // ===========================================
  // THEME
  // ===========================================
  function applyTheme() {
    var theme = localStorage.getItem("theme") || "dark";
    document.body.classList.toggle("light", theme === "light");
    document.body.classList.toggle("dark", theme === "dark");

    var btn = $("themeToggle");
    if (btn) btn.textContent = theme === "dark" ? "\uD83C\uDF19" : "\u2600\uFE0F";
  }

  function bindThemeToggle() {
    var btn = $("themeToggle");
    if (!btn) return;
    btn.addEventListener("click", function () {
      var current = localStorage.getItem("theme") || "dark";
      var next = current === "dark" ? "light" : "dark";
      localStorage.setItem("theme", next);
      applyTheme();
    });
  }

  // ===========================================
  // NAVBAR AUTH STATE
  // ===========================================
  function updateNavbar() {
    var token = localStorage.getItem("camporaToken") || sessionStorage.getItem("camporaToken");
    var loginBtn = $("navLogin");
    var registerBtn = $("navRegister");
    var dashboardBtn = $("navDashboard");
    var logoutBtn = $("navLogout");

    if (token) {
      if (loginBtn) loginBtn.style.display = "none";
      if (registerBtn) registerBtn.style.display = "none";
      if (dashboardBtn) dashboardBtn.style.display = "inline-flex";
      if (logoutBtn) logoutBtn.style.display = "inline-flex";
    } else {
      if (loginBtn) loginBtn.style.display = "inline-flex";
      if (registerBtn) registerBtn.style.display = "inline-flex";
      if (dashboardBtn) dashboardBtn.style.display = "none";
      if (logoutBtn) logoutBtn.style.display = "none";
    }
  }

  // ===========================================
  // MOBILE MENU
  // ===========================================
  function initMobileMenu() {
    var toggle = $("menuToggle");
    var menu = $("mobileMenu");
    if (!toggle || !menu) return;

    toggle.addEventListener("click", function () {
      var active = menu.classList.toggle("active");
      toggle.setAttribute("aria-expanded", active ? "true" : "false");
    });

    menu.querySelectorAll("a, button").forEach(function (el) {
      el.addEventListener("click", function () {
        menu.classList.remove("active");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  // ===========================================
  // LOGOUT
  // ===========================================
  function bindLogout() {
    var btn = $("navLogout");
    if (!btn) return;
    btn.addEventListener("click", function () {
      localStorage.removeItem("camporaToken");
      localStorage.removeItem("camporaUser");
      localStorage.removeItem("camporaRole");
      sessionStorage.removeItem("camporaToken");
      sessionStorage.removeItem("camporaUser");
      window.location.href = "index.html";
    });
  }

  // ===========================================
  // BOOTSTRAP
  // ===========================================
  document.addEventListener("DOMContentLoaded", function () {
    applyTheme();
    bindThemeToggle();
    setFooterYear();
    updateNavbar();
    initMobileMenu();
    bindLogout();

    // Expose globals for any inline scripts on these pages.
    window.App = { API: API, CONFIG: CONFIG };
  });
})();
