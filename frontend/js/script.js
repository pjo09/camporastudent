// =====================================================
// CAMPORA LANDING PAGE — SUPABASE NATIVE ARCHITECTURE
// =====================================================

import CONFIG from "./config.js";
import { login, logout, getUser, getToken, redirectBasedOnRole } from "./session.js";
import { getImageUrl } from "./image-utils.js";
import { apiClient } from "./migration-adapter.js";
import { supabase } from "./supabaseClient.js";

console.log("📡 Using backend:", apiClient.provider || "supabase");

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

// =====================================================
// APP BOOTSTRAP
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
    let finished = false;

    const stages = [
        { step: 1, text: "Checking your preferences...", progress: "25%" },
        { step: 2, text: "Finding nearby stays...", progress: "50%" },
        { step: 3, text: "Preparing your experience...", progress: "75%" },
        { step: 4, text: "Almost there...", progress: "100%" }
    ];

    function setStage(index) {
        const stage = stages[index];
        if (!stage) return;

        const textEl = $("introStepText");
        const loading = $("loadingBar");

        if (textEl) textEl.textContent = stage.text;
        if (loading) loading.style.width = stage.progress;

        const nodes = document.querySelectorAll(".journey-node");
        nodes.forEach((node, idx) => {
            if (idx + 1 === stage.step) {
                node.classList.add("active");
                node.classList.remove("completed");
            } else if (idx + 1 < stage.step) {
                node.classList.remove("active");
                node.classList.add("completed");
            } else {
                node.classList.remove("active", "completed");
            }
        });
    }

    function complete() {
        if (finished) return;
        finished = true;

        setStage(3);

        const intro = $("introScreen");
        if (!intro) return;

        setTimeout(() => {
            intro.classList.add("hide");
            document.body.classList.add("intro-done");

            // Show the login/create-account popup after intro completes
            if (!getToken()) {
                AuthModal.open("login");
            }
        }, 300);
    }

    function init() {
        if (started) return;
        started = true;

        const intro = $("introScreen");
        if (!intro) return;

        setStage(0);

        setTimeout(() => setStage(1), 450);
        setTimeout(() => setStage(2), 1000);
        setTimeout(() => complete(), 1600);
    }

    return { init, complete };
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

        // Scroll effect
        window.addEventListener("scroll", () => {
            if (!header) return;
            header.classList.toggle("scrolled", window.scrollY > 40);
        }, { passive: true });

        // Mobile menu
        if (menuToggle && mobileMenu) {
            menuToggle.addEventListener("click", () => {
                mobileMenu.classList.toggle("active");
            });
        }

        // Close mobile menu on link click
        if (mobileMenu) {
            mobileMenu.querySelectorAll("a, button").forEach((el) => {
                el.addEventListener("click", () => {
                    mobileMenu.classList.remove("active");
                });
            });
        }

        // Logout button
        const logoutBtn = $("navLogout");
        if (logoutBtn) {
            logoutBtn.addEventListener("click", async () => {
                await apiClient.signOut().catch(() => {});
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

        if (user && token) {
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

    return { init, updateAuthNavbar };
})();

// =====================================================
// AUTH MODAL
// =====================================================

// =====================================================
// AUTH MODAL MODULE — UNIFIED 3-VIEW SYSTEM
// =====================================================

const AuthModal = (() => {
    let inited = false;
    let currentRole = "student";
    let profileRole = "student";

    function init() {
        if (inited) return;
        inited = true;

        const modal = $("authModal");
        if (!modal) return;

        // Open modal triggers
        document.querySelectorAll("[data-open-modal]").forEach((btn) => {
            btn.addEventListener("click", (e) => {
                e.preventDefault();
                open(btn.dataset.openModal);
            });
        });

        // Close on backdrop or close button
        modal.querySelectorAll("[data-close-modal]").forEach((el) => {
            el.addEventListener("click", close);
        });

        // Close on Escape key
        document.addEventListener("keydown", (e) => {
            if (e.key === "Escape") close();
        });

        // Switch between login & register views
        modal.querySelectorAll("[data-auth-switch]").forEach((btn) => {
            btn.addEventListener("click", () => switchView(btn.dataset.authSwitch));
        });

        // Password Show/Hide Toggles
        modal.querySelectorAll("[data-toggle-pass]").forEach((btn) => {
            btn.addEventListener("click", () => {
                const targetId = btn.dataset.togglePass;
                const input = $(targetId);
                if (!input) return;
                const isPass = input.type === "password";
                input.type = isPass ? "text" : "password";
                const icon = btn.querySelector("i");
                if (icon) {
                    icon.className = isPass ? "fa-regular fa-eye-slash" : "fa-regular fa-eye";
                }
            });
        });

        // Role switch on Register view
        modal.querySelectorAll("[data-auth-role]").forEach((btn) => {
            btn.addEventListener("click", () => setRole(btn.dataset.authRole));
        });

        // Role switch on Profile Completion view
        modal.querySelectorAll("[data-profile-role]").forEach((btn) => {
            btn.addEventListener("click", () => setProfileRole(btn.dataset.profileRole));
        });

        // Form Submit Listeners
        const loginForm = $("loginForm");
        if (loginForm) loginForm.addEventListener("submit", handleLogin);

        const registerForm = $("registerForm");
        if (registerForm) registerForm.addEventListener("submit", handleRegister);

        const profileForm = $("profileCompletionForm");
        if (profileForm) profileForm.addEventListener("submit", handleProfileCompletion);

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
        document.body.classList.add("auth-modal-open");
    }

    function close() {
        const modal = $("authModal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("auth-modal-open");
    }

    function switchView(view) {
        const loginView = $("authViewLogin");
        const registerView = $("authViewRegister");
        const profileView = $("authViewProfile");

        if (loginView) loginView.style.display = view === "login" ? "block" : "none";
        if (registerView) registerView.style.display = view === "register" ? "block" : "none";
        if (profileView) profileView.style.display = view === "profile" ? "block" : "none";

        clearMessage($("loginError"));
        clearMessage($("registerError"));
        clearMessage($("profileError"));
    }

    function setRole(role) {
        currentRole = role;
        document.querySelectorAll("[data-auth-role]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.authRole === role);
        });

        const ownerField = $("ownerField");
        if (ownerField) ownerField.style.display = role === "owner" ? "block" : "none";
    }

    function setProfileRole(role) {
        profileRole = role;
        document.querySelectorAll("[data-profile-role]").forEach((btn) => {
            btn.classList.toggle("active", btn.dataset.profileRole === role);
        });

        const collegeField = $("profileCollegeField");
        if (collegeField) collegeField.style.display = role === "student" ? "block" : "none";
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
            const data = await apiClient.signIn(email, password);
            const user = data.user;
            if (user?.accountStatus === "BANNED" || user?.accountStatus === "DELETED") {
                await apiClient.signOut().catch(() => {});
                throw new Error("Your account has been suspended or deleted. Please contact support.");
            }
            if (user?.role === "owner" && user?.accountStatus === "PENDING") {
                await apiClient.signOut().catch(() => {});
                showMessage(errorBox, "Your owner account is pending approval by an administrator.", "error");
                setTimeout(() => {
                    close();
                    window.location.href = "/login.html?pending=true";
                }, 1000);
                return;
            }

            login(data.token, user, remember);

            // Fetch live profile from Supabase to verify profile completeness
            let prof = null;
            try {
                const { data: pData } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
                prof = pData;
            } catch (e) {}

            const activeProf = prof || user;
            const isComplete = Boolean(activeProf.name && String(activeProf.name).trim().length > 0);

            if (!isComplete) {
                switchView("profile");
                if ($("profileName")) $("profileName").value = activeProf.name || "";
                if ($("profilePhone")) $("profilePhone").value = activeProf.phone || "";
                if ($("profileCollege")) $("profileCollege").value = activeProf.college || "";
                if ($("profileCity")) $("profileCity").value = activeProf.city || "";
                setProfileRole(activeProf.role || "student");
                showMessage($("profileError"), "Please complete your profile details to get started.", "success");
                return;
            }

            showMessage(errorBox, "Welcome back, " + (activeProf.name || "User") + "!", "success");
            setTimeout(() => { close(); redirectBasedOnRole(activeProf.role || "student"); }, 500);
        } catch (err) {
            showMessage(errorBox, err.message || "Login failed.", "error");
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
        const confirmPassword = $("registerConfirmPassword") ? $("registerConfirmPassword").value : password;
        const termsChecked = $("registerTerms") ? $("registerTerms").checked : true;
        const errorBox = $("registerError");

        clearMessage(errorBox);

        if (!name || !email || !password || !confirmPassword) {
            showMessage(errorBox, "Please fill in all required fields.", "error");
            return;
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            showMessage(errorBox, "Please enter a valid email address.", "error");
            return;
        }

        if (password.length < 6) {
            showMessage(errorBox, "Password must be at least 6 characters.", "error");
            return;
        }

        if (password !== confirmPassword) {
            showMessage(errorBox, "Passwords do not match.", "error");
            return;
        }

        if (!termsChecked) {
            showMessage(errorBox, "You must agree to the Terms & Conditions and Privacy Policy.", "error");
            return;
        }

        const btn = e.target.querySelector("button[type='submit']");
        setLoading(btn, true, "Creating account...");

        try {
            const payload = {
                name,
                email,
                role: currentRole
            };
            if (currentRole === "owner") {
                payload.businessName = $("registerBusiness") ? $("registerBusiness").value.trim() : "";
            }

            const data = await apiClient.signUp(email, password, payload);
            const user = data.user;
            const isOwnerPending = currentRole === "owner" || user?.role === "owner" || user?.accountStatus === "PENDING";

            if (isOwnerPending) {
                await apiClient.signOut().catch(() => {});
                showMessage(errorBox, "Registration successful! Your owner account is pending administrative approval.", "success");
                setTimeout(() => {
                    close();
                    window.location.href = "/login.html?pending=true";
                }, 1200);
                return;
            }

            login(data.token, user, false);

            // Move to Profile Completion view inside the same modal
            switchView("profile");
            if ($("profileName")) $("profileName").value = name;
            setProfileRole(currentRole);
            showMessage($("profileError"), "Account created! Please complete your profile to continue.", "success");
        } catch (err) {
            showMessage(errorBox, err.message || "Registration failed.", "error");
        } finally {
            setLoading(btn, false, "Create Account");
        }
    }

    // ---------- PROFILE COMPLETION ----------

    async function handleProfileCompletion(e) {
        e.preventDefault();
        const name = $("profileName").value.trim();
        const phone = $("profilePhone").value.trim();
        const college = $("profileCollege") ? $("profileCollege").value.trim() : "";
        const city = $("profileCity").value.trim();
        const errorBox = $("profileError");

        clearMessage(errorBox);

        if (!name || !phone || !city) {
            showMessage(errorBox, "Please fill in your name, mobile number, and city.", "error");
            return;
        }

        const phoneClean = phone.replace(/\D/g, "");
        if (phoneClean.length !== 10) {
            showMessage(errorBox, "Please enter a valid 10-digit mobile number.", "error");
            return;
        }

        const btn = e.target.querySelector("button[type='submit']");
        setLoading(btn, true, "Saving profile...");

        try {
            const currentUser = getUser();
            if (!currentUser || !currentUser.id) {
                throw new Error("Session expired. Please log in again.");
            }

            const updatePayload = {
                name,
                phone: phoneClean,
                city,
                role: profileRole,
                updated_at: new Date().toISOString()
            };

            if (profileRole === "student" && college) {
                updatePayload.college = college;
            }

            const { data: updatedProf, error: upErr } = await supabase
                .from("profiles")
                .update(updatePayload)
                .eq("id", currentUser.id)
                .select()
                .maybeSingle();

            if (upErr) throw upErr;

            // Update stored user session object
            const updatedUser = {
                ...currentUser,
                name: updatedProf ? updatedProf.name : name,
                phone: updatedProf ? updatedProf.phone : phoneClean,
                city: updatedProf ? updatedProf.city : city,
                college: updatedProf ? updatedProf.college : college,
                role: profileRole
            };

            if (typeof localStorage !== "undefined" && localStorage.getItem("camporaUser")) {
                localStorage.setItem("camporaUser", JSON.stringify(updatedUser));
            }
            if (typeof sessionStorage !== "undefined" && sessionStorage.getItem("camporaUser")) {
                sessionStorage.setItem("camporaUser", JSON.stringify(updatedUser));
            }

            showMessage(errorBox, "Profile saved successfully!", "success");
            setTimeout(() => {
                close();
                redirectBasedOnRole(profileRole);
            }, 600);
        } catch (err) {
            showMessage(errorBox, err.message || "Failed to update profile.", "error");
        } finally {
            setLoading(btn, false, "Save & Continue");
        }
    }

    // ---------- FORGOT PASSWORD ----------

    function handleForgot() {
        const email = $("loginEmail").value.trim();
        const errorBox = $("loginError");
        clearMessage(errorBox);

        if (!email) {
            showMessage(errorBox, "Please enter your email address above, then tap Forgot password.", "error");
            return;
        }

        showMessage(
            errorBox,
            "A password reset link has been sent to " + email + " (if the account exists).",
            "success"
        );
    }

    // ---------- GOOGLE LOGIN ----------

    function initGoogle() {
        const loginGoogle = $("loginGoogleButton");
        const registerGoogle = $("registerGoogleButton");
        const loginBtn = $("loginModalGoogleBtn");
        const registerBtn = $("registerModalGoogleBtn");

        const triggerAuth = async (e) => {
            if (e) e.preventDefault();
            try {
                const activeRoleBtn = document.querySelector(".auth-role-btn.active") || document.querySelector(".auth-profile-role-btn.active");
                const selectedRole = activeRoleBtn ? (activeRoleBtn.dataset.authRole || activeRoleBtn.dataset.profileRole) : "student";
                await apiClient.signInWithGoogle(selectedRole);
            } catch (err) {
                const errorBox = $("loginError") || $("registerError");
                showMessage(errorBox, err.message || "Google login failed.", "error");
            }
        };

        if (loginBtn) loginBtn.addEventListener("click", triggerAuth);
        if (registerBtn) registerBtn.addEventListener("click", triggerAuth);
        if (loginGoogle && !loginBtn) loginGoogle.addEventListener("click", triggerAuth);
        if (registerGoogle && !registerBtn) registerGoogle.addEventListener("click", triggerAuth);
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

    return { init, open, close, switchView };
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

            const heroInput = $("heroQueryInput");
            const query = heroInput ? heroInput.value.trim() : "";
            const location = $("searchLocation") ? $("searchLocation").value.trim() : "";
            const university = $("searchUniversity") ? $("searchUniversity").value.trim() : "";
            const budget = $("searchBudget") ? $("searchBudget").value : "";
            const type = $("searchType") ? $("searchType").value : "";

            const params = new URLSearchParams();

            if (query) {
                params.set("city", query);
                params.set("college", query);
            } else {
                if (location) params.set("city", location);
                if (university) params.set("college", university);
            }

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

        try {
            const data = await apiClient.getProperties({ sort: "rating", limit: 6 });
            const properties = data.properties || [];

            if (properties.length === 0) {
                grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>No featured properties yet</h3><p>New verified homes are added regularly.</p></div>';
                return;
            }

            grid.innerHTML = properties.map(renderCard).join("");
            Animations.observeReveals();
        } catch (err) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Could not load properties</h3><p>' + esc(err.message) + '</p></div>';
        }
    }

    function renderCard(p) {
        const name = p.property_name || p.propertyName || p.title || "Campora Property";
        const loc = p.city ? p.city + (p.state ? ", " + p.state : "") : "Location not specified";
        const rent = p.rent || p.price || 0;
        const rating = parseFloat(p.average_rating || p.averageRating || 0);
        const img = imageUrl(p.images?.[0] || p.image || p.imageUrl);
        const badge = p.verified ? "Verified" : p.featured ? "Featured" : "";
        const amenities = Array.isArray(p.amenities) && p.amenities.length
            ? p.amenities.slice(0, 3).map((a) => '<span class="feature-item"><i class="fa-solid fa-check"></i> ' + esc(a) + "</span>").join("")
            : '<span class="feature-item"><i class="fa-solid fa-bed"></i> ' + esc(p.sharing || "Flexible") + "</span>";

        return `
        <div class="property-card reveal">
            <div class="property-image">
                <img src="${img}" alt="${esc(name)}" loading="lazy" onerror="this.onerror=null; this.src='/assets/images/property-placeholder.jpg'">
                ${badge ? '<span class="property-badge"><i class="fa-solid fa-shield-check"></i> ' + esc(badge) + "</span>" : ""}
                ${p.property_type || p.propertyType ? '<span class="property-type">' + esc(p.property_type || p.propertyType) + "</span>" : ""}
            </div>
            <div class="property-body">
                <div>
                    <div class="property-location"><i class="fa-solid fa-location-dot"></i> ${esc(loc)}</div>
                    <h3 class="property-title">${esc(name)}</h3>
                    <div class="property-features">${amenities}</div>
                </div>
                <div class="property-footer">
                    <div class="property-price"><span>Rent / month</span><h3>${inr(rent)}</h3></div>
                    <span class="property-rating"><i class="fa-solid fa-star"></i> ${rating > 0 ? rating.toFixed(1) : "New"}</span>
                    <a href="/property-details.html?id=${encodeURIComponent(p.id || p._id)}" class="property-btn">View Details</a>
                </div>
            </div>
        </div>`;
    }

    return { load };
})();

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
            const data = await apiClient.getProperties({ limit: 100 });
            const properties = data.properties || [];

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

            grid.innerHTML = universities.slice(0, 6).map((u) => renderCard(u)).join("");
            Animations.observeReveals();
        } catch (err) {
            grid.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><h3>Could not load universities</h3><p>' + esc(err.message) + '</p></div>';
        }
    }

    function renderCard(u) {
        const uniUrl = "properties.html?college=" + encodeURIComponent(u.name);
        return `
        <div class="why-card reveal" onclick="window.location.href='${uniUrl}'" style="cursor:pointer;">
            <div class="why-icon"><i class="fa-solid fa-graduation-cap"></i></div>
            <h3>${esc(u.name)}</h3>
            <p>${esc(u.city || "Across India")}</p>
            <ul>
                <li><i class="fa-solid fa-house-user"></i> ${u.count} homes nearby</li>
                <li>Zero brokerage fees</li>
            </ul>
            <a href="${uniUrl}" class="view-all-link" style="margin-top:12px; display:inline-flex;">View Accommodations <i class="fa-solid fa-arrow-right"></i></a>
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
            const data = await apiClient.getProperties({ limit: 100 });
            const properties = data.properties || [];

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
        const cityUrl = "properties.html?city=" + encodeURIComponent(c.name);
        return `
        <div class="why-card reveal" onclick="window.location.href='${cityUrl}'" style="cursor:pointer;">
            <div class="why-icon"><i class="fa-solid fa-city"></i></div>
            <h3>${esc(c.name)}</h3>
            <p>${esc(c.state || "India")}</p>
            <ul>
                <li><i class="fa-solid fa-building"></i> ${c.count} verified properties</li>
                <li>Ready for student move-in</li>
            </ul>
            <a href="${cityUrl}" class="view-all-link" style="margin-top:12px; display:inline-flex;">Explore City <i class="fa-solid fa-arrow-right"></i></a>
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
            const data = await apiClient.getStatistics();
            stats = data.statistics || null;
        } catch (e) {
            // Error fallback
        }

        if (stats) {
            const heroBoxes = document.querySelectorAll(".hero-stats .stat-number[data-count]");
            const heroMap = ["students", "properties", "cities", "bookings"];
            heroBoxes.forEach((box, idx) => {
                const key = heroMap[idx];
                if (key && stats[key] !== undefined) {
                    box.dataset.count = String(Number(stats[key] || 0));
                    box.dataset.label = key;
                }
            });

            const trustBoxes = document.querySelectorAll(".trust-strip .stat-number[data-count]");
            const trustMap = ["students", "properties", "cities", "verifiedOwners"];
            trustBoxes.forEach((box, idx) => {
                const key = trustMap[idx];
                if (key && stats[key] !== undefined) {
                    box.dataset.count = String(Number(stats[key] || 0));
                    box.dataset.label = key;
                }
            });

            const gridBoxes = document.querySelectorAll(".statistics-grid .stat-number[data-count]");
            const gridMap = ["students", "properties", "cities", "bookings"];
            gridBoxes.forEach((box, idx) => {
                const key = gridMap[idx];
                if (key && stats[key] !== undefined) {
                    box.dataset.count = String(Number(stats[key] || 0));
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
            const pData = await apiClient.getProperties({ sort: "rating", limit: 1 });
            const prop = (pData.properties || [])[0];

            grid.innerHTML = renderEmpty();
        } catch (e) {
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

                tabs.forEach((t) => {
                    const isActive = t.dataset.showcase === target;
                    t.classList.toggle("active", isActive);
                    t.setAttribute("aria-selected", isActive ? "true" : "false");
                });

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
                await apiClient.postContact({
                    name: "Waitlist: " + city,
                    email,
                    subject: "Campora Waitlist — " + city,
                    message: "Waitlist signup for city: " + city
                }).catch(() => {});

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
                await apiClient.postContact({ name, email, subject, message });
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

// Export apiClient to window for global developer console testing
if (typeof window !== "undefined") {
    window.apiClient = apiClient;
}

export { apiClient };

// =====================================================
// BOOTSTRAP
// =====================================================

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", App.init);
} else {
    App.init();
}
