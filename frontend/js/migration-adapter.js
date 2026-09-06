// =====================================================
// CAMPORA UNIFIED API ADAPTER — 100% SUPABASE NATIVE
// Render dependencies completely removed
// =====================================================

import { supabaseAPI } from "./supabase-api.js";
import { supabase } from "./supabaseClient.js";

console.log("⚡ Backend Provider: 100% Supabase Native");

export const apiClient = {
    provider: "supabase",

    async getProperties(params = {}) {
        const list = await supabaseAPI.getProperties(params);
        let result = Array.isArray(list) ? list : [];
        if (params.limit) {
            result = result.slice(0, params.limit);
        }
        return { success: true, properties: result };
    },

    async getProperty(id) {
        const item = await supabaseAPI.getProperty(id);
        return { success: true, property: item };
    },

    async getStatistics() {
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
    },

    async signIn(email, password) {
        const data = await supabaseAPI.signIn(email, password);
        let profile = null;
        if (data.user) {
            try {
                const { data: pById } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", data.user.id)
                    .maybeSingle();
                if (pById) {
                    profile = pById;
                } else if (data.user.email) {
                    const { data: pByEmail } = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("email", data.user.email)
                        .maybeSingle();
                    if (pByEmail) profile = pByEmail;
                }
            } catch (e) {}
        }
        if (profile && (profile.account_status === "DELETED" || profile.status === "inactive")) {
            await supabase.auth.signOut().catch(() => {});
            throw new Error("This account has been deleted and cannot be accessed.");
        }
        const userObj = data.user ? {
            id: profile?.id || data.user.id,
            email: data.user.email,
            name: profile?.name || data.user.user_metadata?.name || data.user.email.split("@")[0],
            role: profile?.role || data.user.user_metadata?.role || "student",
            accountStatus: profile?.account_status || "ACTIVE"
        } : null;
        return {
            success: true,
            token: data.session?.access_token || "supabase_session",
            user: userObj
        };
    },

    async signUp(email, password, userData = {}) {
        const data = await supabaseAPI.signUp(email, password, userData);
        let profile = null;
        if (data.user) {
            try {
                const { data: pById } = await supabase
                    .from("profiles")
                    .select("*")
                    .eq("id", data.user.id)
                    .maybeSingle();
                if (pById) {
                    profile = pById;
                } else if (data.user.email) {
                    const { data: pByEmail } = await supabase
                        .from("profiles")
                        .select("*")
                        .eq("email", data.user.email)
                        .maybeSingle();
                    if (pByEmail) profile = pByEmail;
                }
            } catch (e) {}
        }
        const userObj = data.user ? {
            id: profile?.id || data.user.id,
            email: data.user.email,
            name: profile?.name || userData.name || data.user.email.split("@")[0],
            role: profile?.role || userData.role || "student",
            accountStatus: profile?.account_status || (userData.role === "owner" ? "PENDING" : "ACTIVE")
        } : null;
        return {
            success: true,
            token: data.session?.access_token || "supabase_session",
            user: userObj
        };
    },

    async signInWithGoogle(selectedRole = "student") {
        return supabaseAPI.signInWithGoogle(selectedRole);
    },

    async signOut() {
        return supabaseAPI.signOut();
    },

    async getCurrentUser() {
        return supabaseAPI.getCurrentUser();
    },

    async createBooking(propertyId, checkIn, price = 0) {
        return supabaseAPI.createBooking(propertyId, checkIn, price);
    },

    async getMyBookings() {
        const bookings = await supabaseAPI.getMyBookings();
        return { success: true, bookings };
    },

    async toggleFavorite(propertyId) {
        return supabaseAPI.toggleFavorite(propertyId);
    },

    async postContact(data) {
        const { error } = await supabase.from("contacts").insert({
            name: data.name,
            email: data.email,
            subject: data.subject || "",
            message: data.message || ""
        });
        if (error) throw error;
        return { success: true };
    },

    async health() {
        const { data, error } = await supabase.from("properties").select("id").limit(1);
        return {
            status: error ? "error" : "ok",
            provider: "supabase",
            native: true,
            error: error ? error.message : null
        };
    }
};
