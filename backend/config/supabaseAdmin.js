// =====================================================
// CAMPORA BACKEND SUPABASE ADMIN CLIENT
// SERVER-ONLY Supabase Auth Admin Client helper.
// NEVER expose service role key to frontend.
// =====================================================

let createClient = null;
try {
    const supabaseModule = require("@supabase/supabase-js");
    createClient = supabaseModule.createClient;
} catch (e) {
    // Client SDK loaded dynamically if installed
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "https://wsldciqtznqjnmltgxpm.supabase.co";
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE || "";

let adminClient = null;

function getSupabaseAdmin() {
    if (!adminClient && createClient) {
        if (!supabaseServiceRoleKey) {
            console.warn("[SupabaseAdmin] SUPABASE_SERVICE_ROLE_KEY is not defined in environment.");
        }
        adminClient = createClient(supabaseUrl, supabaseServiceRoleKey || "missing_service_key", {
            auth: {
                autoRefreshToken: false,
                persistSession: false
            }
        });
    }
    return adminClient;
}

module.exports = {
    getSupabaseAdmin,
    supabaseUrl
};
