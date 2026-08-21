// =====================================================
// CAMPORA MIGRATION ADAPTER MODULE
// Unified API client supporting parallel dual-run cutover
// =====================================================

import { supabaseAPI } from "./supabase-api.js";
import { api as renderAPI } from "./api.js";
import { supabase, USE_SUPABASE_NATIVE } from "./supabaseClient.js";

export const api = USE_SUPABASE_NATIVE ? supabaseAPI : renderAPI;

export const apiClient = {
    ...api,

    // Health check function that works for both Render and Supabase
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
