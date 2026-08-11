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

    /* Mobile menu toggling — defensive and non-invasive */
    (function initMobileMenu() {
        const mobileBtn = document.getElementById("mobileMenuBtn");
        const mobileMenu = document.getElementById("mobileMenu");

        // If either element is missing, do nothing (safe on pages without mobile menu)
        if (!mobileBtn || !mobileMenu) return;

        // Prevent double-initialization
        if (mobileBtn.dataset.mobileMenuInitialized === "true") return;
        mobileBtn.dataset.mobileMenuInitialized = "true";

        const openMenu = () => {
            mobileMenu.classList.add("open");
            mobileBtn.setAttribute("aria-expanded", "true");
            mobileMenu.setAttribute("aria-hidden", "false");
            document.body.classList.add("mobile-menu-open");
            // prevent background touch scrolling (simple guard)
            document.addEventListener('touchmove', preventBackgroundTouch, { passive: false });
        };

        const closeMenu = () => {
            mobileMenu.classList.remove("open");
            mobileBtn.setAttribute("aria-expanded", "false");
            mobileMenu.setAttribute("aria-hidden", "true");
            document.body.classList.remove("mobile-menu-open");
            document.removeEventListener('touchmove', preventBackgroundTouch, { passive: false });
        };

        function toggleMenu(e) {
            if (e) { e.preventDefault(); e.stopPropagation(); }
            if (mobileMenu.classList.contains('open')) closeMenu();
            else openMenu();
        }

        function preventBackgroundTouch(e) {
            if (mobileMenu.contains(e.target)) return; // allow inside menu
            e.preventDefault();
        }

        mobileBtn.addEventListener('click', toggleMenu);

        // Close on outside click
        document.addEventListener('click', function (e) {
            if (!mobileMenu.classList.contains('open')) return;
            if (!mobileMenu.contains(e.target) && !mobileBtn.contains(e.target)) {
                closeMenu();
            }
        });

        // Close on Escape
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && mobileMenu.classList.contains('open')) {
                closeMenu();
            }
        });

        // Close when a link inside the mobile menu is clicked
        mobileMenu.addEventListener('click', function (e) {
            const a = e.target.closest('a');
            if (a) {
                closeMenu();
            }
        });

    })();

}
