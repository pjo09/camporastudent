import { getToken, getUser, logout } from "./session.js";

export function initNavbar() {

    const loginBtn = document.getElementById("navLogin");
    const registerBtn = document.getElementById("navRegister");
    const dashboardBtn = document.getElementById("navDashboard");
    const logoutBtn = document.getElementById("navLogout");
    const userName = document.getElementById("navUser");

    const token = getToken();
    const user = getUser();

    if (token && user) {
        if (loginBtn) loginBtn.style.display = "none";
        if (registerBtn) registerBtn.style.display = "none";
        if (dashboardBtn) dashboardBtn.style.display = "inline-flex";
        if (logoutBtn) logoutBtn.style.display = "inline-flex";
        if (userName) {
            userName.style.display = "inline-flex";
            userName.textContent = "👋 Hi, " + user.name;
        }
    } else {
        if (loginBtn) loginBtn.style.display = "inline-flex";
        if (registerBtn) registerBtn.style.display = "inline-flex";
        if (dashboardBtn) dashboardBtn.style.display = "none";
        if (logoutBtn) logoutBtn.style.display = "none";
        if (userName) userName.style.display = "none";
    }

if (logoutBtn) {
        logoutBtn.onclick = function (e) {
            e.preventDefault();
            logout();
        };
    }
}


/* Mobile menu handler — light, accessible, and idempotent
   Adds toggle behavior for #mobileMenuBtn and #mobileMenu without touching auth logic. */
(function initMobileMenu() {
  if (typeof window === 'undefined') return;
  if (window.__camporaMobileMenuInit) return; // avoid duplicate in SPA/hmr
  window.__camporaMobileMenuInit = true;

  function qs(id){ return document.getElementById(id); }
  const btn = qs('mobileMenuBtn');
  const menu = qs('mobileMenu');
  if (!btn || !menu) return;

  const BODY_LOCK_CLASS = 'mobile-menu-open';

  function isOpen(){ return btn.getAttribute('aria-expanded') === 'true'; }

  function openMenu() {
    btn.setAttribute('aria-expanded','true');
    menu.classList.add('open');
    menu.setAttribute('aria-hidden','false');
    document.body.classList.add(BODY_LOCK_CLASS);
    const first = menu.querySelector('.mobile-link');
    if (first) first.focus();
    document.addEventListener('keydown', onKeyDown, true);
    document.addEventListener('click', onOutsideClick, true);
  }

  function closeMenu() {
    btn.setAttribute('aria-expanded','false');
    menu.classList.remove('open');
    menu.setAttribute('aria-hidden','true');
    document.body.classList.remove(BODY_LOCK_CLASS);
    document.removeEventListener('keydown', onKeyDown, true);
    document.removeEventListener('click', onOutsideClick, true);
    // do NOT force focus back to the hamburger to avoid unexpected focus jumps
  }

  function toggleMenu() { if (isOpen()) closeMenu(); else openMenu(); }

  function onKeyDown(e) {
    if (e.key === 'Escape' || e.key === 'Esc') {
      closeMenu();
    }
  }

  function onOutsideClick(e){
    if (!menu.contains(e.target) && !btn.contains(e.target)) {
      closeMenu();
    }
  }

  // close when any menu link is clicked
  menu.addEventListener('click', function (e) {
    const a = e.target.closest('a');
    if (a) {
      closeMenu();
    }
  });

  btn.addEventListener('click', function (e) {
    e.stopPropagation();
    toggleMenu();
  });

  // initialize ARIA states
  btn.setAttribute('aria-expanded','false');
  menu.setAttribute('aria-hidden','true');

  // defensive positioning if header height variable exists
  try {
    const headerHeight = getComputedStyle(document.documentElement).getPropertyValue('--auth-header-height') || '72px';
    menu.style.top = `calc(${headerHeight} + 8px + env(safe-area-inset-top))`;
  } catch (err) { /* ignore in older browsers */ }

})();
