import { apiFetch, imageUrl, inr, esc, timeAgo } from "./student-utils.js";
import { protectPage } from "./session.js";

document.addEventListener("DOMContentLoaded", () => {
    // Guard the page and get user
    const user = protectPage();
    if (!user) return;

    // Load actual user names / details
    const welcomeHeader = document.querySelector(".hero h1");
    if (welcomeHeader) welcomeHeader.textContent = `Hello, ${user.name.split(" ")[0]}!`;
    const profileName = document.querySelector(".profile h3");
    if (profileName) profileName.textContent = user.name;
    const profileImg = document.querySelector(".profile img");
    if (profileImg && (user.profileImage || user.avatar)) {
        profileImg.src = imageUrl(user.profileImage || user.avatar);
    }

    // Bind logout click event
    const logoutBtn = document.querySelector("button.logout");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", (e) => {
            e.preventDefault();
            import("./session.js").then(({ logout }) => logout());
        });
    }

    loadDashboardData();
});

async function loadDashboardData() {
    try {
        const data = await apiFetch("/student/dashboard-v3");
        const stats = data.statistics || {};

        // Render stats
        const savedEl = document.getElementById("savedCount");
        if (savedEl) savedEl.textContent = stats.savedCount || 0;
        const bookingEl = document.getElementById("bookingCount");
        if (bookingEl) bookingEl.textContent = stats.totalBookings || 0;
        const viewedEl = document.getElementById("viewedCount");
        if (viewedEl) viewedEl.textContent = stats.recentCount || 0;
        const contactEl = document.getElementById("contactCount");
        if (contactEl) contactEl.textContent = stats.unreadMessages || 0;

        // Render Featured Properties
        const propertyGrid = document.getElementById("propertyGrid");
        if (propertyGrid) {
            if (!data.recommended || data.recommended.length === 0) {
                propertyGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 40px; color: var(--text-muted); font-size: 14px;">No properties are featured at the moment.</div>`;
            } else {
                propertyGrid.innerHTML = data.recommended.map(p => {
                    const imgUrl = (p.images && p.images.length > 0) ? imageUrl(p.images[0]) : "/assets/images/property-placeholder.jpg";
                    const priceStr = inr(p.rent || p.price);
                    const locationStr = p.city ? `${p.propertyName}, ${p.city}` : p.propertyName;
                    return `
                    <div class="property-card" onclick="window.location.href='properties.html?id=${p._id}'" style="cursor:pointer">
                        <div class="property-image">
                            <img src="${imgUrl}">
                            <span class="property-badge">${p.verified ? 'Verified' : 'Pending'}</span>
                            <button class="favorite-btn" data-id="${p._id}">
                                <i class="fa-solid fa-heart"></i>
                            </button>
                        </div>
                        <div class="property-body">
                            <div class="property-title">${esc(p.propertyName)}</div>
                            <div class="property-location">
                                <i class="fa-solid fa-location-dot"></i>
                                ${esc(locationStr)}
                            </div>
                            <div class="property-features">
                                <span>🛏 ${esc(p.sharing || 'Sharing')}</span>
                                <span>📶 WiFi</span>
                                <span>🍽 Food</span>
                            </div>
                            <div class="property-price">
                                <div class="price">${priceStr}/mo</div>
                                <button class="book-btn">View</button>
                            </div>
                        </div>
                    </div>`;
                }).join("");
            }
        }

        // Render Bookings List
        const bookingList = document.getElementById("bookingList");
        if (bookingList) {
            if (!data.recentBookings || data.recentBookings.length === 0) {
                bookingList.innerHTML = `<div class="empty-state" style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 14px;">No bookings found.</div>`;
            } else {
                bookingList.innerHTML = data.recentBookings.map(b => {
                    const propName = b.propertyName || (b.propertyId && b.propertyId.propertyName) || "Property";
                    const dateStr = b.checkIn ? new Date(b.checkIn).toLocaleDateString() : "Pending date";
                    const status = b.bookingStatus ? b.bookingStatus.charAt(0).toUpperCase() + b.bookingStatus.slice(1) : "Pending";
                    return `
                    <div class="booking-item" onclick="window.location.href='bookings.html'" style="cursor:pointer">
                        <div>
                            <div class="booking-title">${esc(propName)}</div>
                            <div class="booking-date">Move in: ${esc(dateStr)}</div>
                        </div>
                        <div class="booking-status">${esc(status)}</div>
                    </div>`;
                }).join("");
            }
        }

        // Render Notifications List
        const notificationList = document.getElementById("notificationList");
        if (notificationList) {
            if (!data.recentNotifications || data.recentNotifications.length === 0) {
                notificationList.innerHTML = `<div class="empty-state" style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 14px;">No new notifications.</div>`;
            } else {
                notificationList.innerHTML = data.recentNotifications.map(n => `
                <div class="notification" onclick="window.location.href='notifications.html'" style="cursor:pointer">
                    <div class="notification-icon">
                        <i class="fa-solid fa-bell"></i>
                    </div>
                    <div>
                        <h4>${esc(n.title)}</h4>
                        <p>${esc(n.message)}</p>
                    </div>
                </div>`).join("");
            }
        }

        // Render Nearby Universities
        const universityGrid = document.getElementById("universityGrid");
        if (universityGrid) {
            const colleges = [];
            const seen = new Set();
            const recommendedList = data.recommended || [];
            
            recommendedList.forEach(p => {
                const name = (p.college || "").trim();
                if (!name || seen.has(name.toLowerCase())) return;
                seen.add(name.toLowerCase());
                colleges.push(name);
            });

            if (colleges.length === 0) {
                universityGrid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1; text-align: center; padding: 20px; color: var(--text-muted); font-size: 14px;">No nearby colleges listed.</div>`;
            } else {
                universityGrid.innerHTML = colleges.slice(0, 3).map(u => `
                <div class="university-card">
                    <h3>${esc(u)}</h3>
                    <p>Verified student accommodation nearby.</p>
                    <button class="explore-btn" onclick="window.location.href='properties.html?search=${encodeURIComponent(u)}'">Explore</button>
                </div>
                `).join("");
            }
        }

        // Render Dynamic Activities
        const activityList = document.getElementById("activityList");
        if (activityList) {
            const activities = [];
            
            if (data.savedProperties && data.savedProperties.length > 0) {
                data.savedProperties.slice(0, 2).forEach(p => {
                    activities.push({
                        icon: "fa-heart",
                        title: "Saved Property",
                        desc: p.propertyName || "Property",
                        time: "Recently"
                    });
                });
            }
            
            if (data.recentBookings && data.recentBookings.length > 0) {
                data.recentBookings.slice(0, 2).forEach(b => {
                    const propName = b.propertyName || (b.propertyId && b.propertyId.propertyName) || "Property";
                    activities.push({
                        icon: "fa-calendar-check",
                        title: `Booking ${b.bookingStatus || 'pending'}`,
                        desc: propName,
                        time: b.createdAt ? timeAgo(b.createdAt) : "Recently"
                    });
                });
            }

            if (activities.length === 0) {
                activityList.innerHTML = `<div class="empty-state" style="padding: 20px; color: var(--text-muted); text-align: center; font-size: 14px;">No recent activities.</div>`;
            } else {
                activityList.innerHTML = activities.map(a => `
                <div class="activity-card">
                    <div class="activity-icon">
                        <i class="fa-solid ${a.icon}"></i>
                    </div>
                    <div>
                        <h3>${esc(a.title)}</h3>
                        <p>${esc(a.desc)}</p>
                    </div>
                    <div class="activity-time">
                        ${esc(a.time)}
                    </div>
                </div>
                `).join("");
            }
        }

        // Load Chart
        const ctx = document.getElementById('dashboardChart');
        if (ctx) {
            new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'],
                    datasets: [{
                        label: 'Saved Properties',
                        data: [1, 2, 4, 3, 6, (data.savedProperties || []).length],
                        borderWidth: 2,
                        borderColor: '#2563eb',
                        backgroundColor: 'rgba(37, 99, 235, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: {
                            display: false
                        }
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        },
                        x: {
                            grid: {
                                color: 'rgba(255, 255, 255, 0.05)'
                            },
                            ticks: {
                                color: '#94a3b8'
                            }
                        }
                    }
                }
            });
        }

    } catch (err) {
        console.error("Failed to load dashboard data", err);
    }
}
