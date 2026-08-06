// =====================================================
// ⚠️ DEPRECATED LEGACY FILE — ARCHIVED
// -----------------------------------------------------
// This file is no longer referenced by any HTML page.
// It has been superseded by `bookings-page.js`.
// Kept only for historical reference. Do NOT use.
// =====================================================

import { getToken, getUser, protectPageByRole } from "./session.js";
import { API } from "./config.js";

const API_BASE = API;

// ==========================================
// ELEMENTS
// ==========================================

const bookingTableBody = document.getElementById("bookingTableBody");

const searchInput = document.getElementById("searchBooking");

const totalBookings = document.getElementById("totalBookings");

const confirmedBookings = document.getElementById("confirmedBookings");

const pendingBookings = document.getElementById("pendingBookings");

const cancelledBookings = document.getElementById("cancelledBookings");

// ==========================================
// STATE
// ==========================================

let allBookings = [];

// ==========================================
// LOAD BOOKINGS FROM BACKEND
// ==========================================

document.addEventListener("DOMContentLoaded", () => {

    loadBookings();

});

// ==========================================
// FETCH BOOKINGS
// ==========================================

async function loadBookings() {

    try {

        bookingTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-row">Loading bookings...</td>
        </tr>
        `;

        const res = await fetch(`${API_BASE}/api/bookings`, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });

        const data = await res.json();

        if (!data.success) {
            bookingTableBody.innerHTML = `
            <tr>
                <td colspan="7" class="loading-row">No bookings found</td>
            </tr>`;
            return;
        }

        allBookings = data.bookings || [];

        updateStats(allBookings);

        renderTable(allBookings);

    } catch (err) {

        console.log(err);

        bookingTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-row">Server Error</td>
        </tr>`;

    }
}

// ==========================================
// RENDER TABLE
// ==========================================

function renderTable(bookings) {

    if (!bookings.length) {

        bookingTableBody.innerHTML = `
        <tr>
            <td colspan="7" class="loading-row">No bookings available</td>
        </tr>`;

        return;
    }

    bookingTableBody.innerHTML = "";

    bookings.forEach((b) => {

        bookingTableBody.innerHTML += `
        <tr>

            <td>${b.propertyName || "N/A"}</td>

            <td>${b.userName || "N/A"}</td>

            <td>${b.userEmail || "N/A"}</td>

            <td>₹${b.price || 0}</td>

            <td>
                <span class="status ${b.status?.toLowerCase()}">
                    ${b.status || "pending"}
                </span>
            </td>

            <td>
                ${new Date(b.createdAt).toLocaleDateString()}
            </td>

            <td>
                <button onclick="viewBooking('${b._id}')">
                    View
                </button>
            </td>

        </tr>
        `;
    });
}

// ==========================================
// STATS UPDATE
// ==========================================

function updateStats(bookings) {

    totalBookings.textContent = bookings.length;

    confirmedBookings.textContent =
        bookings.filter(b => b.status === "confirmed").length;

    pendingBookings.textContent =
        bookings.filter(b => b.status === "pending").length;

    cancelledBookings.textContent =
        bookings.filter(b => b.status === "cancelled").length;
}

// ==========================================
// SEARCH FILTER
// ==========================================

if (searchInput) {

    searchInput.addEventListener("input", (e) => {

        const value = e.target.value.toLowerCase();

        const filtered = allBookings.filter(b => {

            return (
                (b.userName || "").toLowerCase().includes(value) ||
                (b.userEmail || "").toLowerCase().includes(value) ||
                (b.propertyName || "").toLowerCase().includes(value)
            );

        });

        renderTable(filtered);

    });

}

// ==========================================
// VIEW BOOKING (MODAL)
// ==========================================

window.viewBooking = function (id) {

    const booking = allBookings.find(b => b._id === id);

    if (!booking) return;

    alert(
        `
Property: ${booking.propertyName}
User: ${booking.userName}
Email: ${booking.userEmail}
Status: ${booking.status}
        `
    );

};

// ==========================================
// LOGOUT
// ==========================================

const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {

    logoutBtn.onclick = () => {

        localStorage.removeItem("camporaToken");
        localStorage.removeItem("camporauser");

        window.location.href = "login.html";

    };

}