// =====================================================
// CAMPORA SHARED THEME UTILITY
// Handles Dark/Light theme switching & persistence
// Key: "camporaTheme" (default: "dark")
// =====================================================

export function getTheme() {
  return localStorage.getItem("camporaTheme") || localStorage.getItem("theme") || "dark";
}

export function applyTheme(themeName) {
  const theme = themeName || getTheme();

  if (document.documentElement) {
    document.documentElement.setAttribute("data-theme", theme);
  }
  if (document.body) {
    document.body.setAttribute("data-theme", theme);
    document.body.classList.toggle("light", theme === "light");
    document.body.classList.toggle("dark", theme === "dark");
  }

  // Update UI toggles across the DOM
  const toggles = document.querySelectorAll(".v3-theme-toggle-btn, #themeToggle, #themeToggleBtn");
  toggles.forEach((btn) => {
    btn.setAttribute("aria-label", "Toggle light and dark mode");
    btn.setAttribute("data-active-theme", theme);
    const darkOpt = btn.querySelector(".opt-dark");
    const lightOpt = btn.querySelector(".opt-light");
    if (darkOpt && lightOpt) {
      darkOpt.classList.toggle("active", theme === "dark");
      lightOpt.classList.toggle("active", theme === "light");
    }
  });
}

export function setTheme(newTheme) {
  const theme = newTheme === "light" ? "light" : "dark";
  localStorage.setItem("camporaTheme", theme);
  localStorage.setItem("theme", theme);
  applyTheme(theme);
  return theme;
}

export function toggleTheme() {
  const current = getTheme();
  const next = current === "dark" ? "light" : "dark";
  setTheme(next);
  return next;
}

export function initTheme() {
  applyTheme();

  const toggles = document.querySelectorAll(".v3-theme-toggle-btn, #themeToggle, #themeToggleBtn");
  toggles.forEach((btn) => {
    if (!btn.dataset.themeBound) {
      btn.dataset.themeBound = "true";
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        toggleTheme();
      });
      btn.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleTheme();
        }
      });
    }
  });
}

// Immediate execution if in browser
if (typeof window !== "undefined") {
  applyTheme();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initTheme);
  } else {
    initTheme();
  }
}

export default {
  getTheme,
  setTheme,
  toggleTheme,
  applyTheme,
  initTheme,
};