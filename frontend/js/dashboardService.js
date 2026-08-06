// ======================================================
// CAMPORA DASHBOARD SERVICE
// ======================================================

import { api } from "./api.js";

// ======================================================
// CURRENT USER
// ======================================================

export async function getCurrentUser() {

    return await api.get("/student/profile");

}

// ======================================================
// STUDENT DASHBOARD
// ======================================================

export async function getStudentDashboard() {

    return await api.get("/student/dashboard");

}

// ======================================================
// OWNER DASHBOARD
// ======================================================

export async function getOwnerDashboard() {

    return await api.get("/owner/dashboard");

}

// ======================================================
// ADMIN DASHBOARD
// ======================================================

export async function getAdminDashboard() {

    return await api.get("/admin/dashboard");

}

// ======================================================
// ALL PROPERTIES
// ======================================================

export async function getProperties() {

    return await api.get("/properties");

}

// ======================================================
// PROPERTY DETAILS
// ======================================================

export async function getProperty(id) {

    return await api.get(`/properties/${id}`);

}

// ======================================================
// SEARCH PROPERTY
// ======================================================

export async function searchProperty(query) {

    return await api.get(`/properties/search?${query}`);

}

// ======================================================
// BOOKINGS
// ======================================================

export async function getBookings() {

    return await api.get("/bookings");

}

// ======================================================
// SAVED PROPERTIES
// ======================================================

export async function getSavedProperties() {

    return await api.get("/student/saved");

}

// ======================================================
// RECENTLY VIEWED
// ======================================================

export async function getRecentlyViewed() {

    return await api.get("/student/recent");

}

// ======================================================
// NOTIFICATIONS
// ======================================================

export async function getNotifications() {

    return await api.get("/student/notifications");

}

// ======================================================
// OWNER PROPERTIES
// ======================================================

export async function getOwnerProperties() {

    return await api.get("/owner/properties");

}

// ======================================================
// OWNER BOOKINGS
// ======================================================

export async function getOwnerBookings() {

    return await api.get("/owner/bookings");

}

// ======================================================
// OWNER ANALYTICS
// ======================================================

export async function getOwnerAnalytics() {

    return await api.get("/owner/analytics");

}

// ======================================================
// ADMIN USERS
// ======================================================

export async function getUsers() {

    return await api.get("/admin/users");

}

// ======================================================
// ADMIN OWNERS
// ======================================================

export async function getOwners() {

    return await api.get("/admin/owners");

}

// ======================================================
// ADMIN PENDING PROPERTIES
// ======================================================

export async function getPendingProperties() {

    return await api.get("/admin/pending-properties");

}

// ======================================================
// ADMIN ANALYTICS
// ======================================================

export async function getAnalytics() {

    return await api.get("/admin/analytics");

}