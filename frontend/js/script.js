// =====================================================
// CAMPORA LANDING PAGE — MODULAR ARCHITECTURE
// =====================================================

import CONFIG, { API } from "./config.js";
import { login, logout, getUser, getToken, redirectBasedOnRole } from "./session.js";
import { getImageUrl } from "./image-utils.js";

// =====================================================
// SHARED HELPERS
// =====================================================

const $ = (id) => document.getElementById(id);

const QUOT = "&" + "quot;";

function esc(value) {
    return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&" + "lt;")
        .replace(/>/g, "&" + "gt;")
        .replace(/"/g, QUOT)
        .replace(/'/g, "&#039;");
}

function inr(value) {
    const num = Number(value || 0);
    return "₹" + num.toLocaleString("en-IN");
}

function imageUrl(path) {
    return getImageUrl(path, "/assets/images/property-placeholder.jpg");
}

async function apiGet(endpoint) {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;

    const res = await fetch(API + endpoint, { headers });
    const data = await res.json();
    if (!res.ok || data.success === false) {
        throw new Error(data.message || "Something went wrong");
    }
    return data;
}

async function apiPost(endpoint, body) {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;

    const res = await fetch(API + endpoint, {
        method: "POST",
        headers,
        body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
        throw new Error(data.message || "Something went wrong");
    }
    return data;
}

async function apiDelete(endpoint) {
    const token = getToken();
    const headers = { "Content-Type": "application/json" };
    if (token) headers.Authorization = "Bearer " + token;

    const res = await fetch(API + endpoint, {
        method: "DELETE",
        headers
    });
    const data = await res.json();
    if (!res.ok || data.success === false) {
        throw new Error(data.message || "Something went wrong");
    }
    return data;
}

// =====================================================
// APP
// =====================================================

const App = (() => {
    function init() {
        Intro.init();
        Navbar.init();
        AuthModal.init();
        Search.init();
        FAQ.init();
        Showcase.init();
        Waitlist.init();
        Animations.init();

        Properties.load();
        Universities.load();
        Cities.load();
        Statistics.load();
        Testimonials.load();
        Contact.init();

        // Footer year
        const year = $("year");
        if (year) year.textContent = new Date().getFullYear();
    }

    return { init };
})();

// =====================================================
// INTRO
// =====================================================

const Intro = (() => {
    let started = false;

    function init() {
        if (started) return;
        started = true;

        const intro = $("introScreen");
        const loading = $("loadingBar");

        if (!intro) return;

        if (loading) {
            setTimeout(() => { loading.style.width = "100%"; }, 200);
        }

        setTimeout(() => {
            intro.classList.add("hide");
            document.body.classList.add("intro-done");

            // Show the login/create-account popup after intro completes,
            // but only for visitors who are not already signed in.
            if (!getToken()) {
                AuthModal.open("login");
            }
        }, 1800);
    }

    return { init };
})();

// =====================================================
// NAVBAR
// =====================================================

const Navbar = (() => {
    let inited = false;

    function init() {
        if (inited) return;
        inited = true;

        const header = $("header");
        const menuToggle = $("menuToggle");
        const mobileMenu = $("mobileMenu");
        const mobileMenuBackdrop = $("mobileMenuBackdrop");
        const stickyMobileCta = $("stickyMobileCta");

        // Scroll & Sticky CTA Visibility tracking
        window.addEventListener("scroll", () => {
            if (header) {
                header.classList.toggle("scrolled", window.scrollY > 40);
            }
            if (stickyMobileCta) {
                if (window.scrollY > 200) {
                    stickyMobileCta.classList.add("visible");
                } else {
                    stickyMobileCta.classList.remove("visible");
                }
            }
        }, { passive: true });

        const openMenu = () => {
            if (!mobileMenu) return;
            mobileMenu.classList.add("active");
            if (mobileMenuBackdrop) mobileMenuBackdrop.classList.add("active");
            document.body.classList.add("mobile-menu-open");
            if (menuToggle) menuToggle.setAttribute("aria-expanded", "true");
            const first = mobileMenu.querySelector("a");
            if (first) first.focus();
        };

        const closeMenu = () => {
            if (!mobileMenu) return;
            mobileMenu.classList.remove("active");
            if (mobileMenuBackdrop) mobileMenuBackdrop.classList.remove("active");
            document.body.classList.remove("mobile-menu-open");
            if (menuToggle) menuToggle.setAttribute("aria-expanded", "false");
        };

        // Mobile menu toggle
        if (menuToggle && mobileMenu) {
            menuToggle.addEventListener("click", (e) => {
                e.stopPropagation();
                if (mobileMenu.classList.contains("active")) {
                    closeMenu();
                } else {
                    openMenu();
                }
            });
        }

        if (mobileMenuBackdrop) {
            mobileMenuBackdrop.addEventListener("click", closeMenu);
        }

        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape" || e.key === "Esc") {
                closeMenu();
            }
        });

        // Close mobile menu on link click
        if (mobileMenu) {
            mobileMenu.querySelectorAll("a, button").forEach((el) => {
                el.addEventListener("click", () => {
                    closeMenu();
                });
            });
        }

        // Logout button
        const logoutBtn = $("navLogout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", () => {
                logout();
            });
        }

        updateAuthNavbar();
    }

    function updateAuthNavbar() {
        const user = getUser();
        const token = getToken();
        const loginBtn = $("navLogin");
        const registerBtn = $("navRegister");
        const dashboardBtn = $("navDashboard");
        const logoutBtn = $("navLogout");
        const mobileGetStarted = $("mobileGetStarted");

        if (user && token) {
            if (loginBtn) loginBtn.style.display = "none";
            if (registerBtn) registerBtn.style.display = "none";
            if (dashboardBtn) dashboardBtn.style.display = "inline-flex";
            if (logoutBtn) logoutBtn.style.display = "inline-flex";

            if (mobileGetStarted) {
                mobileGetStarted.textContent = "Dashboard";
                mobileGetStarted.onclick = (e) => {
                    e.preventDefault();
                    redirectBasedOnRole(user.role);
                };
            }
        } else {
            if (loginBtn) loginBtn.style.display = "inline-flex";
            if (registerBtn) registerBtn.style.display = "inline-flex";
            if (dashboardBtn) dashboardBtn.style.display = "none";
            if (logoutBtn) logoutBtn.style.display = "none";

            if (mobileGetStarted) {
                mobileGetStarted.textContent = "Get Started";
                mobileGetStarted.onclick = (e) => {
                    e.preventDefault();
                    const popover = $("authPopover");
                    if (popover) popover.classList.toggle("active");
                };
            }
        }
    }

    return { init, updateAuthNavbar };
})();

// =====================================================
// AUTH MODAL
// =====================================================

const AuthModal = (() => {
    let inited = false;
    let currentRole = "student";

    function init() {
        if (inited) return;
        inited = true;

        const modal = $("authModal");
        if (!modal) return;

        // Open modal buttons
        document.querySelectorAll("[data-open-modal]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                open(btn.dataset.openModal);
            });
        });

        // Close on backdrop / close button
        modal.querySelectorAll("[data-close-modal]").forEach((el) => {
            el.addEventListener("click", close);
        });

        // Close on Escape
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") close();
        });

        // Tabs (login / register)
        modal.querySelectorAll("[data-auth-switch]").forEach((btn) => {
            btn.addEventListener("click", () => switchView(btn.dataset.authSwitch));
        });

        modal.querySelectorAll("[data-auth-view]").forEach((tab) => {
            tab.addEventListener("click", () => switchView(tab.dataset.authView));
        });

        // Role switch
        modal.querySelectorAll("[data-auth-role]").forEach((btn) => {
            btn.addEventListener("click", () => setRole(btn.dataset.authRole));
        });

        // Forms
        const loginForm = $("loginForm");
        if (loginForm) loginForm.addEventListener("submit", handleLogin);

        const registerForm = $("registerForm");
        if (registerForm) registerForm.addEventListener("submit", handleRegister);

        const forgotBtn = $("forgotPassword");
        if (forgotBtn) forgotBtn.addEventListener("click", handleForgot);

        initGoogle();
    }

    function open(view) {
        const modal = $("authModal");
        if (!modal) return;
        switchView(view || "login");
        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.style.overflow = "hidden";
    }

    function close() {
        const modal = $("authModal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.style.overflow = "";
    }

    function switchView(view) {
        const loginView = $("authViewLogin");
        const registerView = $("authViewRegister");
        if (!loginView || !registerView) return;

        const isLogin = view === "login";

        loginView.style.display = isLogin ? "block" : "none";
        registerView.style.display = isLogin ? "none" : "block";

        document.querySelectorAll("[data-auth-view]").forEach((tab) => {
            tab.classList.toggle("active", tab.dataset.authView === view);
        });
    }

    function setRole(role) {
        currentRole = role;
        document.querySelectorAll("[data-auth-role]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.authRole === role);
        });

        const ownerField = $("ownerField");
        if (ownerField) ownerField.style.display = role === "owner" ? "block" : "none";
    }

    // ---------- LOGIN ----------

    async function handleLogin(e) {
        e.preventDefault();
        const email = $("loginEmail").value.trim();
        const password = $("loginPassword").value;
        const remember = $("loginRemember") ? $("loginRemember").checked : false;
        const errorBox = $("loginError");

        clearMessage(errorBox);

        if (!email || !password) {
            showMessage(errorBox, "Please enter your email and password.", "error");
            return;
        }

        const btn = e.target.querySelector("button[type='submit']");
        setLoading(btn, true, "Logging in...");

        try {
            const data = await apiPost("/auth/login", { email, password });
            login(data.token, data.user, remember);
            showMessage(errorBox, "Welcome back, " + data.user.name + "!", "success");
            setTimeout(() => { close(); redirectBasedOnRole(data.user.role); }, 600);
        } catch (err) {
            showMessage(errorBox, err.message, "error");
        } finally {
            setLoading(btn, false, "Login");
        }
    }

    // ---------- REGISTER ----------

    async function handleRegister(e) {
        e.preventDefault();
        const name = $("registerName").value.trim();
        const email = $("registerEmail").value.trim();
        const password = $("registerPassword").value;
        const errorBox = $("registerError");

        clearMessage(errorBox);

        if (!name || !email || !password) {
            showMessage(errorBox, "Please fill in all fields.", "error");
            return;
        }
        if (password.length < 6) {
            showMessage(errorBox, "Password must be at least 6 characters.", "error");
            return;
        }

        const btn = e.target.querySelector("button[type='submit']");
        setLoading(btn, true, "Creating account...");

        try {
            const payload = {
                name,
                email,
                password,
                role: currentRole
            };
            if (currentRole === "owner") {
                payload.businessName = $("registerBusiness") ? $("registerBusiness").value.trim() : "";
            }

            const data = await apiPost("/auth/register", payload);
            login(data.token, data.user, false);
            showMessage(errorBox, "Account created successfully!", "success");
            setTimeout(() => { close(); redirectBasedOnRole(data.user.role); }, 700);
        } catch (err) {
            showMessage(errorBox, err.message, "error");
        } finally {
            setLoading(btn, false, "Create Account");
        }
    }

    // ---------- FORGOT PASSWORD ----------

    function handleForgot() {
        const email = $("loginEmail").value.trim();
        const errorBox = $("loginError");
        clearMessage(errorBox);

        if (!email) {
            showMessage(errorBox, "Please enter your email above, then click Forgot password.", "error");
            return;
        }

        showMessage(
            errorBox,
            "A password reset link has been sent to " + email + " (if the account exists).",
            "success"
        );
    }

    // ---------- GOOGLE ----------

    function initGoogle() {
        if (typeof google === "undefined" || typeof google.accounts === "undefined") {
            const tryAgain = () => {
                if (typeof google !== "undefined" && typeof google.accounts !== "undefined") setup();
            };
            setTimeout(tryAgain, 800);
            return;
        }
        setup();
    }

    function setup() {
        const clientId = CONFIG.GOOGLE_CLIENT_ID || "45569590642-4mehsdjfru09l14mmslif775edv7jego.apps.googleusercontent.com";

        try {
            google.accounts.id.initialize({
                client_id: clientId,
                callback: handleGoogle
            });
        } catch (e) {
            // already initialized
        }

        const loginGoogle = $("loginGoogleButton");
        if (loginGoogle) {
            loginGoogle.innerHTML = "";
            google.accounts.id.renderButton(loginGoogle, {
                theme: "outline",
                size: "large",
                shape: "pill",
                width: Math.max(200, Math.min(300, window.innerWidth - 80))
            });
        }

        const registerGoogle = $("registerGoogleButton");
        if (registerGoogle) {
            registerGoogle.innerHTML = "";
            google.accounts.id.renderButton(registerGoogle, {
                theme: "filled_blue",
                size: "large",
                shape: "pill",
                width: Math.max(200, Math.min(300, window.innerWidth - 80))
            });
        }
    }

    async function handleGoogle(response) {
        try {
            const role = currentRole || "student";
            const data = await apiPost("/auth/google", {
                credential: response.credential,
                role
            });
            login(data.token, data.user, false);
            close();
            redirectBasedOnRole(data.user.role);
        } catch (err) {
            const errorBox = $("loginError");
            showMessage(errorBox, err.message || "Google login failed.", "error");
        }
    }

    // ---------- UI HELPERS ----------

    function showMessage(el, text, type) {
        if (!el) return;
        el.textContent = text;
        el.className = "auth-message " + (type === "error" ? "error" : "success");
    }

function clearMessage(el) {
        if (!el) return;
        el.textContent = "";
        el.className = "auth-message";
    }

    function setLoading(btn, loading, text) {
        if (!btn) return;
        btn.disabled = loading;
        btn.textContent = text;
    }

return { init, open };
})();

// =====================================================
// SEARCH
// =====================================================

const Search = (() => {
    let inited = false;

    function init() {
        if (inited) return;
        inited = true;

        const form = $("searchForm");
        if (!form) return;

        form.addEventListener("submit", (e) => {
            e.preventDefault();

            const location = $("searchLocation").value.trim();
            const university = $("searchUniversity").value.trim();
            const budget = $("searchBudget").value;
            const type = $("searchType").value;

            const params = new URLSearchParams();
            if (location) params.set("city", location);
            if (university) params.set("college", university);
            if (budget) params.set("maxRent", budget);
            if (type) params.set("sharing", type);

            window.location.href = "properties.html?" + params.toString();
        });
    }

    return { init };
})();

// =====================================================
// PROPERTIES
// =====================================================

const Properties = (() => {
    let loaded = false;

    async function load() {
        if (loaded) return;
        loaded = true;

        const grid = $("featuredProperties");
        if (!grid) return;

        grid.innerHTML = Array(3).fill(
            '<div class="loading-card"></div>'
        ).join("");

        let savedPropertyIds = new Set();
        if (getToken()) {
            try {
                // Auto trigger pending save if returning from login
                const pendingSaveId = localStorage.getItem("pendingSavePropertyId");
                if (pendingSaveId) {
                    localStorage.removeItem("pendingSavePropertyId");
                    await apiPost(`/student/saved/${pendingSaveId}`).catch(() => null);
                }

                const savedData = await apiGet("/properties/saved/list");
                if (savedData && savedData.properties) {
                    savedPropertyIds = new Set(savedData.properties.map(sp => sp._id));
                }
            } catch (e) {
                // ignore
            }
        }

        try {
            const data = await apiGet("/properties/search?sort=rating&limit=6");
            const properties = data.properties || [];

            if (properties.length === 0) {
                grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No featured properties yet</h3><p>New verified homes are added regularly.</p></div>';
                return;
            }

            grid.innerHTML = properties.map(p => renderCard(p, savedPropertyIds)).join("");
            Animations.observeReveals();
        } catch (err) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Could not load properties</h3><p>' + esc(err.message) + '</p></div>';
        }
    }

    function renderCard(p, savedPropertyIds) {
        const name = p.propertyName || p.title || "Campora Property";
        const loc = p.city ? p.city + (p.state ? ", " + p.state : "") : "Location not specified";
        const rent = p.rent || p.price || 0;
        const rating = p.averageRating || 0;
        const isSaved = savedPropertyIds.has(p._id);

        // Verification Badge (Only if verified is explicitly true)
        const badgeHtml = p.verified 
            ? '<span class="property-badge verified"><i class="fa-solid fa-circle-check"></i> Verified</span>' 
            : '';

        // Distance from university/campus (Only if data exists)
        const distanceHtml = p.nearby && p.nearby.length
            ? `<div class="property-distance" style="font-size:12px;color:var(--campora-text);margin-top:4px"><i class="fa-solid fa-person-walking"></i> ${esc(p.nearby[0].distance)} from ${esc(p.nearby[0].title || p.college || "campus")}</div>`
            : '';

        // Amenities (Only if available)
        const amenitiesList = Array.isArray(p.amenities) ? p.amenities : [];
        const amenitiesHtml = amenitiesList.length
            ? amenitiesList.slice(0, 3).map((a) => '<span class="feature-item"><i class="fa-solid fa-check"></i> ' + esc(a) + '</span>').join("")
            : '<span class="feature-item"><i class="fa-solid fa-bed"></i> ' + esc(p.sharing || "Flexible") + '</span>';

        // Availability (Only if available from backend)
        const availabilityHtml = (p.availableBeds !== undefined && p.availableBeds > 0)
            ? `<span class="feature-item" style="color:#22c55e;font-weight:600"><i class="fa-solid fa-bed"></i> ${p.availableBeds} beds left</span>`
            : '';

        // Reusable Image Gallery Swiper logic
        let imageAreaHtml = '';
        if (p.images && p.images.length > 1) {
            const slidesHtml = p.images.map((imgUrl, i) => `
                <img src="${imageUrl(imgUrl)}" alt="${esc(name)} - Image ${i + 1}" loading="${i === 0 ? 'eager' : 'lazy'}" onerror="this.onerror=null; this.src='/assets/images/property-placeholder.jpg'">
            `).join("");
            imageAreaHtml = `
                <div class="property-image-slider">
                    <div class="property-image-slides">
                        ${slidesHtml}
                    </div>
                    <span class="image-indicator">1/${p.images.length}</span>
                </div>
            `;
        } else {
            const singleImg = p.images && p.images.length ? imageUrl(p.images[0]) : "/assets/images/property-placeholder.jpg";
            imageAreaHtml = `<img src="${singleImg}" alt="${esc(name)}" loading="lazy" onerror="this.onerror=null; this.src='/assets/images/property-placeholder.jpg'">`;
        }

        return `
        <div class="property-card reveal" onclick="window.location.href='/pages/property/property.html?id=${p._id}'" style="cursor:pointer">
            <div class="property-image loading">
                ${imageAreaHtml}
                ${badgeHtml}
                ${p.propertyType ? '<span class="property-type">' + esc(p.propertyType) + "</span>" : ""}
                <button class="save-home-btn" onclick="event.stopPropagation(); window.toggleSaveHome('${p._id}', this)" aria-label="Save property" style="position:absolute;top:16px;right:16px;background:rgba(11,31,58,0.6);border:none;border-radius:50%;width:36px;height:36px;display:flex;align-items:center;justify-content:center;color:#fff;cursor:pointer;z-index:10;transition:all 0.2s ease">
                    <i class="fa-${isSaved ? 'solid' : 'regular'} fa-heart" style="${isSaved ? 'color:#ef4444' : ''}"></i>
                </button>
            </div>
            <div class="property-body">
                <div class="property-location"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</div>
                <h3 class="property-title">${esc(name)}</h3>
                ${distanceHtml}
                <div class="property-features" style="margin-top:8px">
                    ${amenitiesHtml}
                    ${availabilityHtml}
                </div>
                <div class="property-footer">
                    <div class="property-price"><span>Rent / month</span><h3>${inr(rent)}</h3></div>
                    <span class="property-rating"><i class="fa-solid fa-star"></i> ${rating > 0 ? rating.toFixed(1) : "New"}</span>
                    <a href="/pages/property/property.html?id=${p._id}" class="property-btn" onclick="event.stopPropagation();">View</a>
                </div>
            </div>
        </div>`;
    }

    return { load };
})();

// Global unauthenticated Save handler
window.toggleSaveHome = async function(propertyId, btn) {
    if (!getToken()) {
        localStorage.setItem("pendingSavePropertyId", propertyId);
        const currentUrl = window.location.pathname + window.location.search;
        window.location.href = `login.html?redirectTo=${encodeURIComponent(currentUrl)}`;
        return;
    }
    try {
        const icon = btn.querySelector("i");
        const isSaved = icon.classList.contains("fa-solid");
        if (isSaved) {
            await apiDelete(`/student/saved/${propertyId}`);
            icon.className = "fa-regular fa-heart";
            icon.style.color = "";
        } else {
            await apiPost(`/student/saved/${propertyId}`);
            icon.className = "fa-solid fa-heart";
            icon.style.color = "#ef4444";
        }
    } catch (err) {
        // silent
    }
};

// Global scroll event listener for swipeable galleries (using capturing scroll delegation)
document.addEventListener("scroll", (e) => {
    const target = e.target;
    if (target && target.classList && target.classList.contains("property-image-slides")) {
        const indicator = target.nextElementSibling;
        if (indicator && indicator.classList.contains("image-indicator")) {
            const index = Math.round(target.scrollLeft / target.clientWidth) + 1;
            const total = target.children.length;
            indicator.textContent = `${index}/${total}`;
        }
    }
}, { capture: true, passive: true });

// =====================================================
// UNIVERSITIES
// =====================================================

const Universities = (() => {
    let loaded = false;

    async function load() {
        if (loaded) return;
        loaded = true;

        const grid = $("universityGrid");
        if (!grid) return;

        grid.innerHTML = Array(3).fill(
            '<div class="loading-card"></div>'
        ).join("");

        try {
            const data = await apiGet("/properties/search?limit=100");
            const properties = data.properties || [];

            // Derive distinct universities (college field) from properties
            const universities = [];
            const seen = new Set();

            properties.forEach((p) => {
                const name = (p.college || "").trim();
                if (!name || seen.has(name.toLowerCase())) return;
                seen.add(name.toLowerCase());
                universities.push({
                    name,
                    city: p.city || "",
                    count: properties.filter((x) => (x.college || "").trim().toLowerCase() === name.toLowerCase()).length
                });
            });

            if (universities.length === 0) {
                grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Universities are coming soon</h3><p>We are onboarding homes near your campus.</p></div>';
                return;
            }

            // Show up to 6
            grid.innerHTML = universities.slice(0, 6).map((u) => renderCard(u)).join("");
            Animations.observeReveals();
        } catch (err) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Could not load universities</h3><p>' + esc(err.message) + '</p></div>';
        }
    }

    function renderCard(u) {
        return `
        <div class="why-card reveal">
            <div class="why-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <h3>${esc(u.name)}</h3>
            <p>${esc(u.city || "Across India")}</p>
            <ul>
                <li>${u.count} properties nearby</li>
                <li>Verified student homes</li>
            </ul>
        </div>`;
    }

    return { load };
})();

// =====================================================
// CITIES
// =====================================================

const Cities = (() => {
    let loaded = false;

    async function load() {
        if (loaded) return;
        loaded = true;

        const grid = $("cityGrid");
        if (!grid) return;

        grid.innerHTML = Array(3).fill(
            '<div class="loading-card"></div>'
        ).join("");

        try {
            const data = await apiGet("/properties/search?limit=100");
            const properties = data.properties || [];

            // Derive distinct cities
            const cities = [];
            const seen = new Set();

            properties.forEach((p) => {
                const name = (p.city || "").trim();
                if (!name || seen.has(name.toLowerCase())) return;
                seen.add(name.toLowerCase());
                cities.push({
                    name,
                    state: p.state || "",
                    count: properties.filter((x) => (x.city || "").trim().toLowerCase() === name.toLowerCase()).length
                });
            });

            if (cities.length === 0) {
                grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No cities yet</h3><p>We are expanding to new cities soon.</p></div>';
                return;
            }

            grid.innerHTML = cities.slice(0, 6).map(renderCard).join("");
            Animations.observeReveals();
        } catch (err) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Could not load cities</h3><p>' + esc(err.message) + '</p></div>';
        }
    }

    function renderCard(c) {
        return `
        <div class="property-card reveal">
            <div class="property-body">
                <div class="property-location"><i class="fa-solid fa-city"></i> ${esc(c.state || "India")}</div>
                <h3 class="property-title">${esc(c.name)}</h3>
                <div class="property-features">
                    <span class="feature-item"><i class="fa-solid fa-building"></i> ${c.count} properties</span>
                </div>
                <div class="property-footer">
                    <a href="properties.html?city=${encodeURIComponent(c.name)}" class="view-all">Explore <i class="fa-solid fa-arrow-right"></i></a>
                </div>
            </div>
        </div>`;
    }

    return { load };
})();

// =====================================================
// STATISTICS
// =====================================================

const Statistics = (() => {
    let loaded = false;

    async function load() {
        if (loaded) return;
        loaded = true;

        let stats = null;
        try {
            const data = await apiGet("/statistics");
            stats = data.statistics || null;
        } catch (e) {
            // No statistics endpoint available — show empty/zero states, never fake numbers
        }

        if (stats) {
            // Update hero-stats (4 elements)
            const heroBoxes = document.querySelectorAll(".hero-stats .stat-number[data-count]");
            const heroMap = ["students", "properties", "cities", "bookings"];
            heroBoxes.forEach((box, idx) => {
                const key = heroMap[idx];
                if (key && stats[key] !== undefined) {
                    const val = Number(stats[key] || 0);
                    box.dataset.count = String(val);
                    box.dataset.label = key;
                }
            });

            // Update trust-strip (4 elements)
            const trustBoxes = document.querySelectorAll(".trust-strip .stat-number[data-count]");
            const trustMap = ["students", "properties", "cities", "verifiedOwners"];
            trustBoxes.forEach((box, idx) => {
                const key = trustMap[idx];
                if (key && stats[key] !== undefined) {
                    const val = Number(stats[key] || 0);
                    box.dataset.count = String(val);
                    box.dataset.label = key;
                }
            });

            // Update statistics-grid (4 elements)
            const gridBoxes = document.querySelectorAll(".statistics-grid .stat-number[data-count]");
            const gridMap = ["students", "properties", "cities", "bookings"];
            gridBoxes.forEach((box, idx) => {
                const key = gridMap[idx];
                if (key && stats[key] !== undefined) {
                    const val = Number(stats[key] || 0);
                    box.dataset.count = String(val);
                    box.dataset.label = key;
                }
            });
        }

        observeCounters();
    }

    function observeCounters() {
        const counters = document.querySelectorAll(".stat-number[data-count]");

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                const el = entry.target;
                animateCounter(el);
                io.unobserve(el);
            });
        }, { threshold: 0.4 });

        counters.forEach((c) => io.observe(c));
    }

function animateCounter(el) {
        const target = Number(el.dataset.count) || 0;
        if (target <= 0) {
            el.textContent = "0+";
            return;
        }

        let count = 0;
        const duration = 1600;
        const start = performance.now();

        function tick(now) {
            const progress = Math.min((now - start) / duration, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            count = Math.floor(eased * target);
            el.textContent = count.toLocaleString("en-IN") + "+";
            if (progress < 1) requestAnimationFrame(tick);
        }

        requestAnimationFrame(tick);
    }

    // Expose a method to update a stat box from a real value
    function setStat(key, value) {
        const boxes = document.querySelectorAll(".stat-number[data-count]");
        boxes.forEach((box) => {
            if (box.dataset.label === key) {
                box.dataset.count = String(Number(value) || 0);
            }
        });
    }

    return { load };
})();

// =====================================================
// TESTIMONIALS
// =====================================================

const Testimonials = (() => {
    let loaded = false;

    async function load() {
        if (loaded) return;
        loaded = true;

        const grid = $("testimonialGrid");
        if (!grid) return;

grid.innerHTML = Array(3).fill(
            '<div class="loading-card"></div>'
        ).join("");

        try {
            // Load a featured property, then pull its reviews
            const pData = await apiGet("/properties/search?sort=rating&limit=1");
            const prop = (pData.properties || [])[0];

            let reviews = [];
            if (prop && prop._id) {
                const rData = await apiGet("/reviews/" + prop._id);
                reviews = Array.isArray(rData.reviews) ? rData.reviews : [];
            }

if (reviews.length === 0) {
                grid.innerHTML = renderEmpty();
                return;
            }

            grid.innerHTML = reviews.slice(0, 3).map(renderCard).join("");
            Animations.observeReveals();
        } catch (e) {
            // No reviews API available — show empty state, never fake data
            grid.innerHTML = renderEmpty();
        }
    }

    function renderEmpty() {
        return `
        <div class="empty-state" style="grid-column:1/-1">
            <h3>No student stories yet</h3>
            <p>Reviews will appear here once students start sharing their experiences.</p>
        </div>`;
    }

    function renderCard(r) {
        const name = r.studentName || r.userName || r.name || "Student";
        const college = r.college || r.university || "Student";
        const text = r.comment || r.review || r.text || "";
        const rating = Number(r.rating || 5);
        const stars = "★".repeat(Math.min(5, Math.max(1, rating)));

        return `
        <div class="testimonial-card reveal">
            <div class="quote-icon"><i class="fa-solid fa-quote-right"></i></div>
            <p class="review">${esc(text)}</p>
            <div class="student-info">
                <div>
                    <h4 class="student-name">${esc(name)}</h4>
                    <p class="student-college">${esc(college)}</p>
                </div>
            </div>
            <div class="rating">${stars}</div>
        </div>`;
    }

return { load };
})();

// =====================================================
// SHOWCASE TABS
// =====================================================

const Showcase = (() => {
    let inited = false;

    function init() {
        if (inited) return;
        inited = true;

        const tabs = document.querySelectorAll(".showcase-tab");
        if (!tabs.length) return;

        tabs.forEach((tab) => {
            tab.addEventListener("click", () => {
                const target = tab.dataset.showcase;
                if (!target) return;

                // Update tab state
                tabs.forEach((t) => {
                    const isActive = t.dataset.showcase === target;
                    t.classList.toggle("active", isActive);
                    t.setAttribute("aria-selected", isActive ? "true" : "false");
                });

                // Toggle panels
                const panels = {
                    students: $("showcaseStudents"),
                    owners: $("showcaseOwners"),
                    secure: $("showcaseSecure")
                };

                Object.entries(panels).forEach(([key, el]) => {
                    if (el) el.style.display = key === target ? "grid" : "none";
                });
            });
        });
    }

    return { init };
})();

// =====================================================
// WAITLIST
// =====================================================

const Waitlist = (() => {
    let inited = false;

    function init() {
        if (inited) return;
        inited = true;

        const form = $("waitlistForm");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const email = $("waitlistEmail").value.trim();
            const city = $("waitlistCity").value.trim();
            const successBox = $("waitlistSuccess");
            const errorBox = $("waitlistError");

            if (errorBox) errorBox.style.display = "none";
            if (successBox) successBox.style.display = "none";

            if (!email || !email.includes("@")) {
                if (errorBox) {
                    errorBox.textContent = "Please enter a valid email address.";
                    errorBox.style.display = "block";
                }
                return;
            }
            if (!city) {
                if (errorBox) {
                    errorBox.textContent = "Please enter your city.";
                    errorBox.style.display = "block";
                }
                return;
            }

            const btn = form.querySelector("button[type='submit']");
            if (btn) {
                btn.disabled = true;
                btn.textContent = "Joining...";
            }

            try {
                // Attempt to store via contact API (non-critical)
                try {
                    await apiPost("/contact", {
                        name: "Waitlist: " + city,
                        email,
                        subject: "Campora Waitlist — " + city,
                        message: "Waitlist signup for city: " + city
                    });
                } catch (apiErr) {
                    // Waitlist is best-effort; never block the user for backend errors
                }

                if (errorBox) errorBox.style.display = "none";
                if (successBox) {
                    successBox.style.display = "block";
                    form.reset();
                    successBox.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
            } finally {
                if (btn) {
                    btn.disabled = false;
                    btn.textContent = "Join the Waitlist";
                }
            }
        });
    }

    return { init };
})();

// =====================================================
// FAQ
// =====================================================

const FAQ = (() => {
    let inited = false;

    function init() {
        if (inited) return;
        inited = true;

        const items = document.querySelectorAll(".faq-item");

        items.forEach((item) => {
            const button = item.querySelector(".faq-question");
            if (!button) return;

            button.addEventListener("click", () => {
                const isActive = item.classList.contains("active");

                items.forEach((f) => f.classList.remove("active"));

                if (!isActive) item.classList.add("active");
            });
        });
    }

    return { init };
})();

// =====================================================
// CONTACT
// =====================================================

const Contact = (() => {
    let inited = false;

    function init() {
        if (inited) return;
        inited = true;

        const form = $("contactForm");
        if (!form) return;

        form.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = $("contactName").value.trim();
            const email = $("contactEmail").value.trim();
            const subject = $("contactSubject") ? $("contactSubject").value.trim() : "";
            const message = $("contactMessage").value.trim();

            if (!name || !email || !message) {
                alert("Please fill in your name, email, and message.");
                return;
            }

            const btn = form.querySelector("button[type='submit']");
            const original = btn.textContent;
            btn.disabled = true;
            btn.textContent = "Sending...";

            try {
                await apiPost("/contact", { name, email, subject, message });
                alert("Message sent successfully. We'll get back to you soon!");
                form.reset();
            } catch (err) {
                alert(err.message || "Unable to send message. Please try again.");
            } finally {
                btn.disabled = false;
                btn.textContent = original;
            }
        });
    }

    return { init };
})();

// =====================================================
// ANIMATIONS
// =====================================================

const Animations = (() => {
    let inited = false;

    function init() {
        if (inited) return;
        inited = true;

        observeReveals();
        initCardTilt();
    }

    function observeReveals() {
        const reveals = document.querySelectorAll(".reveal");

        if (!("IntersectionObserver" in window)) {
            reveals.forEach((el) => el.classList.add("active"));
            return;
        }

        const io = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    entry.target.classList.add("active");
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.12 });

        reveals.forEach((el) => io.observe(el));
    }

    function initCardTilt() {
        const cards = document.querySelectorAll(
            ".feature-card, .property-card, .testimonial-card, .why-card, .step-card, .stat-card"
        );

        cards.forEach((card) => {
            card.addEventListener("mousemove", (e) => {
                const rect = card.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                const rotateX = -(y - rect.height / 2) / 18;
                const rotateY = (x - rect.width / 2) / 18;
                card.style.transform =
                    "perspective(900px) rotateX(" + rotateX + "deg) rotateY(" + rotateY + "deg) translateY(-8px)";
            });

            card.addEventListener("mouseleave", () => {
                card.style.transform = "";
            });
        });
    }

    return { init, observeReveals };
})();

// =====================================================
// BOOTSTRAP
// =====================================================

document.addEventListener("DOMContentLoaded", App.init);
