const { PGlite } = require('@electric-sql/pglite');
const fs = require('fs');
const path = require('path');
const { seedSupabaseData } = require('../utils/supabaseDataSeeder');

let pgliteInstance = null;
let initPromise = null;

async function getSupabaseClient() {
    if (pgliteInstance) return pgliteInstance;
    if (!initPromise) {
        initPromise = (async () => {
            console.log("[Supabase] Initializing PGlite instance & migrations...");
            const startTime = Date.now();
            const instance = new PGlite();
            
            // Execute schema migrations
            const migrationsDir = path.join(__dirname, '../../supabase/migrations');
            const migrationFiles = [
                '001_profiles.sql',
                '002_location_master.sql',
                '003_properties.sql',
                '004_bookings.sql',
                '005_saved_and_recent_properties.sql',
                '006_reviews.sql',
                '007_messaging.sql',
                '008_tenancies_and_residents.sql',
                '009_notifications.sql',
                '010_maintenance_and_announcements.sql',
                '011_invoices_and_otps.sql',
                '012_system_and_audit.sql',
                '013_admin_scopes.sql'
            ];

            for (const file of migrationFiles) {
                const filePath = path.join(migrationsDir, file);
                if (fs.existsSync(filePath)) {
                    let sql = fs.readFileSync(filePath, 'utf8');
                    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "uuid-ossp";/gi, '');
                    sql = sql.replace(/CREATE EXTENSION IF NOT EXISTS "pgcrypto";/gi, '');
                    await instance.exec(sql);
                }
            }

            // Seed Phase 3 migrated dataset
            await seedSupabaseData(instance);
            pgliteInstance = instance;
            console.log(`[Supabase] PGlite initialization complete in ${Date.now() - startTime}ms`);
            return pgliteInstance;
        })().catch(err => {
            console.error("[Supabase] Fatal PGlite init error:", err);
            initPromise = null;
            throw err;
        });
    }
    return initPromise;
}

module.exports = {
    getSupabaseClient
};
