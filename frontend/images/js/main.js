import { initOTP } from "./otp.js";
import { initNavbar } from "./navbar.js";
import { initTheme } from "./theme.js";
import { updateNavbar, logout } from "./session.js";
import { sendOTP, verifyOTP, saveLogin } from "./otp-auth.js";
import { API } from "./config.js";

export const API_BASE = API;

function getEl(id){
    return document.getElementById(id);
}

function applyTheme(){

    const theme = localStorage.getItem("theme") || "dark";

    document.body.classList.toggle("light", theme==="light");
    document.body.classList.toggle("dark", theme==="dark");

    const btn = getEl("themeToggle");

    if(btn){

        btn.textContent = theme==="dark" ? "🌙" : "☀️";

    }

}

function bindThemeToggle(){

    const btn = getEl("themeToggle");

    if(!btn) return;

    btn.addEventListener("click",()=>{

        const current = localStorage.getItem("theme") || "dark";

        const next = current==="dark" ? "light" : "dark";

        localStorage.setItem("theme",next);

        applyTheme();

    });

}

function ensureFooterYear(){

    const year = getEl("year");

    if(year){

        year.textContent = new Date().getFullYear();

    }

}

document.addEventListener("DOMContentLoaded",()=>{

    initTheme();

    initNavbar();

    if (document.getElementById("registerForm")) {
    initOTP();
}

});
/* ==========================================
   CAMPORA PREMIUM INTRO
========================================== */

const intro = document.getElementById("introScreen");
const typing = document.getElementById("typingText");
const loading = document.getElementById("loadingBar");

if (!intro || !typing || !loading) {
    console.log("Intro elements not found.");
} else {

    const message = "Hi 👋 Welcome to Campora";

    let i = 0;

    function type() {
        if (i < message.length) {
            typing.innerHTML += message.charAt(i);
            i++;
            setTimeout(type, 70);
        }
    }

    type();

    setTimeout(() => {
        loading.style.width = "100%";
    }, 500);

    setTimeout(() => {
        intro.classList.add("hide");
    }, 5500);
}
