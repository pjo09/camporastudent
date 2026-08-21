// =====================================================
// CAMPORA MIGRATION ADAPTER MODULE
// Unified API client supporting parallel dual-run cutover
// =====================================================

import { supabaseAPI } from "./supabase-api.js";
import { api as renderAPI } from "./api.js";
import { supabase, USE_SUPABASE_NATIVE } from "./supabaseClient.js";

console.log("📡 Using backend:", USE_SUPABASE_NATIVE ? "supabase" : "render");

export const apiClient = {
    provider: USE_SUPABASE_NATIVE ? "supabase" : "render",

    async getProperties(params = {}) {
        if (USE_SUPABASE_NATIVE) {
            const list = await supabaseAPI.getProperties(params);
            let result = Array.isArray(list) ? list : [];
            if (params.limit) {
                result = result.slice(0, params.limit);
            }
            return { success: true, properties: result };
        } else {
            let endpoint = "/properties/search?";
            const searchParams = new URLSearchParams();
            if (params.limit) searchParams.set("limit", params.limit);
            if (params.sort) searchParams.set("sort", params.sort);
            if (params.city) searchParams.set("city", params.city);
            return renderAPI.get(endpoint + searchParams.toString());
        }
    },

    async getProperty(id) {
        if (USE_SUPABASE_NATIVE) {
            const item = await supabaseAPI.getProperty(id);
            return { success: true, property: item };
        } else {
            return renderAPI.get("/properties/" + id);
        }
    },

    async getStatistics() {
        if (USE_SUPABASE_NATIVE) {
            const stats = await supabaseAPI.getStatistics();
            return {
                success: true,
                statistics: {
                    students: stats.totalUsers || 0,
                    properties: stats.totalProperties || 0,
                    cities: stats.totalCities || 0,
                    bookings: 0,
                    verifiedOwners: 0
                }
            };
        } else {
            return renderAPI.get("/statistics");
        }
    },

    async signIn(email, password) {
        if (USE_SUPABASE_NATIVE) {
            const data = await supabaseAPI.signIn(email, password);
            const userObj = data.user ? {
                id: data.user.id,
                email: data.user.email,
                name: data.user.user_metadata?.name || data.user.email.split("@")[0],
                role: data.user.user_metadata?.role || "student"
            } : null;
            return {
                success: true,
                token: data.session?.access_token || "supabase_session",
                user: userObj
            };
        } else {
            return renderAPI.post("/auth/login", { email, password });
        }
    },

    async signUp(email, password, userData = {}) {
        if (USE_SUPABASE_NATIVE) {
            const data = await supabaseAPI.signUp(email, password, userData);
            const userObj = data.user ? {
                id: data.user.id,
                email: data.user.email,
                name: userData.name || email.split("@")[0],
                role: userData.role || "student"
            } : null;
            return {
                success: true,
                token: data.session?.access_token || "supabase_session",
                user: userObj
            };
        } else {
            return renderAPI.post("/auth/register", { email, password, ...userData });
        }
    },

    async signInWithGoogle() {
        if (USE_SUPABASE_NATIVE) {
            return supabaseAPI.signInWithGoogle();
        } else {
            return renderAPI.post("/auth/google", {});
        }
    },

    async signOut() {
        if (USE_SUPABASE_NATIVE) {
            return supabaseAPI.signOut();
        }
    },

    async getCurrentUser() {
        if (USE_SUPABASE_NATIVE) {
            return supabaseAPI.getCurrentUser();
        }
    },

    async createBooking(propertyId, checkIn, price = 0) {
        if (USE_SUPABASE_NATIVE) {
            return supabaseAPI.createBooking(propertyId, checkIn, price);
        } else {
            return renderAPI.post("/bookings", { propertyId, checkIn });
        }
    },

    async getMyBookings() {
        if (USE_SUPABASE_NATIVE) {
            const bookings = await supabaseAPI.getMyBookings();
            return { success: true, bookings };
        } else {
            return renderAPI.get("/student/bookings");
        }
    },

    async toggleFavorite(propertyId) {
        if (USE_SUPABASE_NATIVE) {
            return supabaseAPI.toggleFavorite(propertyId);
        } else {
            return renderAPI.post("/student/saved-properties", { propertyId });
        }
    },

    async postContact(data) {
        if (USE_SUPABASE_NATIVE) {
            const { error } = await supabase.from("contacts").insert({
                name: data.name,
                email: data.email,
                subject: data.subject || "",
                message: data.message || ""
            });
            if (error) throw error;
            return { success: true };
        } else {
            return renderAPI.post("/contact", data);
        }
    },

    async health() {
        if (USE_SUPABASE_NATIVE) {
            const { data, error } = await supabase.from("properties").select("id").limit(1);
            return {
                status: error ? "error" : "ok",
                provider: "supabase",
                native: true,
                error: error ? error.message : null
            };
        } else {
            try {
                const res = await fetch("https://camporastudent.onrender.com/api/health");
                const data = await res.json();
                return { ...data, provider: "render", native: false };
            } catch (err) {
                return { status: "error", provider: "render", native: false, error: err.message };
            }
        }
    }
};
