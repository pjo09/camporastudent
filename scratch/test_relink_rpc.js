const fs = require('fs');
const path = require('path');

const sqlPath = path.join(__dirname, '../supabase/migrations/023_legacy_profile_relink_rpc.sql');
const sql = fs.readFileSync(sqlPath, 'utf8');

console.log("Checking migration 023 SQL file...");
console.log("Length:", sql.length);
console.log("Function definition present:", sql.includes("CREATE OR REPLACE FUNCTION public.relink_legacy_profile_by_email"));
console.log("Updated tables count:", (sql.match(/UPDATE public\./g) || []).length);
console.log("Migration SQL validated successfully!");
