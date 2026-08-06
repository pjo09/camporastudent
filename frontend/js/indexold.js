// ===============================================
// CAMPORA FRONTEND SCRIPT
// MODULE 1A
// ===============================================

"use strict";

document.addEventListener("DOMContentLoaded", () => {

    console.clear();

    console.log("==================================");
    console.log("Campora Frontend Initializing...");
    console.log("==================================");

    // ===========================================
    // USER SETTINGS
    // ===========================================

    const reducedMotion =
        window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    // ===========================================
    // DOM ELEMENTS
    // ===========================================

    const body = document.body;

    const intro = document.getElementById("intro");

if (intro) {
    // existing intro animation code
}
    const introStars = document.getElementById("introStars");
    const heroStars = document.getElementById("heroStars");

    const introGreet = document.getElementById("introGreet");
    const introTitle = document.getElementById("introTitle");
    const introSub = document.getElementById("introSub");

    const burgerBtn = document.getElementById("burgerBtn");

    const searchForm = document.getElementById("searchForm");

    const guesthouseGrid =
        document.getElementById("guesthouseGrid");

    const apartmentGrid =
        document.getElementById("apartmentGrid");

    const staysSection =
        document.getElementById("stays");

    const collegeRow =
        document.getElementById("collegeRow");

    const popup =
        document.getElementById("entryPopup");

    const funnel =
        document.getElementById("funnelOverlay");

    const detailsOverlay =
        document.getElementById("detailsOverlay");

    // ===========================================
    // GLOBAL VARIABLES
    // ===========================================

    let popupShown = false;

    let popupTimer = null;

    let counted = false;

    // ===========================================
    // HELPERS
    // ===========================================

    function $(id) {

        return document.getElementById(id);

    }

    function create(tag) {

        return document.createElement(tag);

    }

    // ===========================================
    // INTRO STARS
    // ===========================================

    function createIntroStars() {

        if (introStars) {

            introStars.innerHTML = "";

            for (let i = 0; i < 26; i++) {

                const star = create("span");

                star.style.left =
                    Math.random() * 100 + "%";

                star.style.top =
                    Math.random() * 100 + "%";

                star.style.animationDelay =
                    Math.random() * 3 + "s";

                star.style.animationDuration =
                    (2.5 + Math.random() * 2.5) + "s";

                introStars.appendChild(star);

            }

        }

        if (heroStars) {

            heroStars.innerHTML = "";

            for (let i = 0; i < 14; i++) {

                const star = create("span");

                star.style.left =
                    Math.random() * 60 + "%";

                star.style.top =
                    Math.random() * 45 + "%";

                star.style.animationDelay =
                    Math.random() * 4 + "s";

                heroStars.appendChild(star);

            }

        }

    }

    createIntroStars();

    // ===========================================
    // TYPEWRITER
    // ===========================================

    function typeText(element, text, speed = 60, callback = null) {

        if (!element) return;

        if (reducedMotion) {

            element.textContent = text;

            if (callback) callback();

            return;

        }

        element.classList.add("type-cursor");

        let index = 0;

        function typing() {

            element.textContent =
                text.substring(0, index);

            index++;

            if (index <= text.length) {

                setTimeout(typing, speed);

            }

            else {

                element.classList.remove("type-cursor");

                if (callback) callback();

            }

        }

        typing();

    }

    // ===========================================
    // INTRO
    // ===========================================

    function dismissIntro() {

        if (!intro) return;

        intro.classList.add("fade-out");

        body.classList.remove("intro-active");

        setTimeout(() => {

            intro.style.display = "none";

        }, 850);

        popupTimer =
            setTimeout(showEntryPopup, reducedMotion ? 600 : 3000);

    }

    function startIntro() {

        if (!intro) return;

        body.classList.add("intro-active");
                if (reducedMotion) {

            if (introGreet) introGreet.textContent = "Hii 👋";
            if (introTitle) introTitle.textContent = "Welcome to Campora";
            if (introSub) {
                introSub.textContent =
                    "Finding Your Perfect Student Accommodation";
            }

            setTimeout(dismissIntro, 1000);

            return;

        }

        setTimeout(() => {

            typeText(introGreet, "Hii 👋", 90, () => {

                setTimeout(() => {

                    typeText(
                        introTitle,
                        "Welcome to Campora",
                        55,
                        () => {

                            setTimeout(() => {

                                typeText(
                                    introSub,
                                    "Finding Your Perfect Student Accommodation",
                                    32,
                                    () => {

                                        setTimeout(dismissIntro, 900);

                                    }
                                );

                            }, 250);

                        }
                    );

                }, 250);

            });

        }, 350);

    }

    startIntro();

    // ===========================================
    // ENTRY POPUP
    // ===========================================

    function showEntryPopup() {

        if (!popup) return;

        if (popupShown) return;

        if (funnel && funnel.classList.contains("show")) return;

        popupShown = true;

        popup.classList.add("show");

        popup.setAttribute("aria-hidden", "false");

    }

    function hideEntryPopup() {

        if (!popup) return;

        popup.classList.remove("show");

        popup.setAttribute("aria-hidden", "true");

    }

    const popupClose = $("popupClose");

    if (popupClose) {

        popupClose.addEventListener("click", hideEntryPopup);

    }

    if (popup) {

        popup.addEventListener("click", function (e) {

            if (e.target === popup) {

                hideEntryPopup();

            }

        });

    }

    // ===========================================
    // MOBILE MENU
    // ===========================================

    if (burgerBtn) {

        burgerBtn.addEventListener("click", function () {

            const existing =
                document.getElementById("mobileMenu");

            if (existing) {

                existing.remove();

                return;

            }

            const panel = document.createElement("div");

            panel.id = "mobileMenu";

            panel.style.position = "fixed";
            panel.style.inset = "0";
            panel.style.background = "rgba(4,6,15,.97)";
            panel.style.zIndex = "300";

            panel.style.display = "flex";
            panel.style.flexDirection = "column";
            panel.style.justifyContent = "center";
            panel.style.alignItems = "center";
            panel.style.gap = "26px";

            const menu = [

                "Home",

                "Student Housing",

                "Universities",

                "Cities",

                "Blog",

                "About",

                "Login",

                "Get Started"

            ];

            menu.forEach(text => {

                const a = document.createElement("a");

                a.textContent = text;

                a.href = "#";

                a.style.color = "#eef5ff";

                a.style.fontSize = "20px";

                a.style.textDecoration = "none";

                panel.appendChild(a);

            });

            const close = document.createElement("button");

            close.innerHTML = "&times;";

            close.style.position = "absolute";

            close.style.top = "20px";

            close.style.right = "30px";

            close.style.fontSize = "34px";

            close.style.background = "none";

            close.style.border = "0";

            close.style.color = "#fff";

            close.style.cursor = "pointer";

            close.onclick = () => panel.remove();

            panel.appendChild(close);

            document.body.appendChild(panel);

        });

    }

    // ===========================================
    // COUNT-UP STATS
    // ===========================================

    function countUp(element) {

        const target =
            Number(element.dataset.count);

        let start = null;

        function frame(timestamp) {

            if (!start) start = timestamp;

            const progress =
                Math.min((timestamp - start) / 1200, 1);

            element.textContent =
                Math.floor(progress * target).toLocaleString("en-IN");

            if (progress < 1) {

                requestAnimationFrame(frame);

            }

            else {

                element.textContent =
                    target.toLocaleString("en-IN") + "+";

            }

        }

        requestAnimationFrame(frame);

    }

    const statsSection =
        document.querySelector(".stats");

    if ("IntersectionObserver" in window && statsSection) {

        const observer =
            new IntersectionObserver(entries => {

                entries.forEach(entry => {

                    if (entry.isIntersecting && !counted) {

                        counted = true;

                        document
                            .querySelectorAll(".stat b")
                            .forEach(countUp);

                    }

                });

            }, {

                threshold: 0.4

            });

        observer.observe(statsSection);

    }

    console.log("Module 1 Loaded Successfully");

});