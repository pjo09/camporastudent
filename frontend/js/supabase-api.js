// =====================================================
// CAMPORA SUPABASE NATIVE API MODULE
// Bypasses Render API to talk directly to Supabase
// =====================================================

import { supabase } from "./supabaseClient.js";

export const supabaseAPI = {
    // Properties
    async getProperties(filters = {}) {
        let query = supabase
            .from("properties")
            .select("*, profiles!owner_id(name, profile_image)")
            .eq("status", "approved")
            .eq("published", true);

        if (filters.city) query = query.eq("city", filters.city);
        if (filters.minPrice) query = query.gte("rent", filters.minPrice);
        if (filters.maxPrice) query = query.lte("rent", filters.maxPrice);
        if (filters.propertyType) query = query.eq("property_type", filters.propertyType);

        const { data, error } = await query;
        if (error) throw error;
        return data;
    },

    async getProperty(id) {
        const { data, error } = await supabase
            .from("properties")
            .select("*, profiles!owner_id(*)")
            .eq("id", id)
            .single();
        if (error) throw error;
        return data;
    },

    // Auth
    async signUp(email, password, userData = {}) {
        const { data: authData, error: authError } = await supabase.auth.signUp({
            email,
            password,
            options: { data: userData }
        });
        if (authError) throw authError;

        // Upsert user profile into profiles table
        if (authData && authData.user) {
            await supabase.from("profiles").upsert({
                id: authData.user.id,
                email: email,
                name: userData.name || email.split("@")[0],
                role: userData.role || "student",
                account_status: userData.role === "owner" ? "PENDING" : "ACTIVE"
            });
        }
        return authData;
    },

    async signIn(email, password) {
        const { data, error } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        if (error) throw error;
        return data;
    },

    async signInWithGoogle() {
        const { data, error } = await supabase.auth.signInWithOAuth({
            provider: "google",
            options: {
                redirectTo: `${window.location.origin}/auth/callback.html`
            }
        });
        if (error) throw error;
        return data;
    },

    async signOut() {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
    },

    async getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (!user) return null;

        // Fetch full user profile
        const { data: profile } = await supabase
            .from("profiles")
            .select("*")
            .eq("id", user.id)
            .maybeSingle();

        return { ...user, profile };
    },

    // Bookings
    async createBooking(propertyId, checkIn, price = 0) {
        const { data, error } = await supabase.rpc("create_booking_transaction", {
            p_property_id: propertyId,
            p_check_in: checkIn,
            p_price: price
        });
        if (error) throw error;
        return data;
    },

    async getMyBookings() {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data, error } = await supabase
            .from("bookings")
            .select("*, properties(property_name, images, address)")
            .eq("user_id", user.id)
            .order("created_at", { ascending: false });
        if (error) throw error;
        return data;
    },

    // Saved / Favorite Properties
    async toggleFavorite(propertyId) {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Not authenticated");

        const { data: existing } = await supabase
            .from("saved_properties")
            .select("id")
            .eq("user_id", user.id)
            .eq("property_id", propertyId)
            .maybeSingle();

        if (existing) {
            const { error } = await supabase
                .from("saved_properties")
                .delete()
                .eq("id", existing.id);
            if (error) throw error;
            return { saved: false };
        } else {
            const { error } = await supabase
                .from("saved_properties")
                .insert({ user_id: user.id, property_id: propertyId });
            if (error) throw error;
            return { saved: true };
        }
    },

    // Statistics
    async getStatistics() {
        const [propsRes, citiesRes, collegesRes, usersRes] = await Promise.all([
            supabase.from("properties").select("id", { count: "exact", head: true }),
            supabase.from("cities").select("id", { count: "exact", head: true }),
            supabase.from("colleges").select("id", { count: "exact", head: true }),
            supabase.from("profiles").select("id", { count: "exact", head: true })
        ]);

        return {
            totalProperties: propsRes.count || 0,
            totalCities: citiesRes.count || 0,
            totalColleges: collegesRes.count || 0,
            totalUsers: usersRes.count || 0
        };
    }
};
