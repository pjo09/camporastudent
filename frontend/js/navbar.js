import { getToken, getUser, logout, redirectToLanding } from "./session.js";

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
            redirectToLanding();
        };
    }
}
