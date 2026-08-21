// =====================================================
// CAMPORA VERCEL DEPLOYMENT RUNTIME CONFIG GENERATOR
// Single authoritative build script executed during Vercel deployment.
// Exposes ONLY public client environment variables (NO service_role secrets).
// =====================================================

const fs = require('fs');
const path = require('path');

const rawUrl = (
    process.env.VITE_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    'https://wsldciqtznqjnmltgxpm.supabase.co'
).trim();

const anonKey = (
    process.env.VITE_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    process.env.VITE_SUPABASE_KEY ||
    process.env.SUPABASE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    ''
).trim();

const nativeMode = (process.env.VITE_USE_SUPABASE_NATIVE || 'true').trim();
const appUrl = (process.env.VITE_APP_URL || 'https://camporastudent.vercel.app').trim();

// Ensure pooler URL is sanitized to official PostgREST API URL
const sanitizedUrl = (rawUrl.includes('pooler.supabase.com') || rawUrl.includes('campora.supabase.co'))
    ? 'https://wsldciqtznqjnmltgxpm.supabase.co'
    : rawUrl;

const isVercelBuild = Boolean(process.env.VERCEL || process.env.CI || process.env.NOW_BUILDER);

// Fail build immediately if anon key is missing during Vercel deployment
if (isVercelBuild && !anonKey) {
    console.error('❌ FATAL VERCEL BUILD FAILURE: VITE_SUPABASE_ANON_KEY environment variable is not defined in Vercel Production Environment Variables.');
    console.error('👉 REQUIRED ACTION IN VERCEL DASHBOARD:');
    console.error('   1. Go to Vercel Dashboard -> Project Settings -> Environment Variables.');
    console.error('   2. Add/Edit VITE_SUPABASE_ANON_KEY with your Supabase Public Anon Key.');
    console.error('   3. Ensure the "Production" target scope checkbox is checked.');
    console.error('   4. Save and trigger a manual Redeploy under Deployments tab.');
    process.exit(1);
}

const content = `// Generated at deployment build time by scripts/generate-env.js
(function() {
    if (typeof window === "undefined") return;
    window.__ENV = {
        VITE_SUPABASE_URL: ${JSON.stringify(sanitizedUrl)},
        VITE_SUPABASE_ANON_KEY: ${JSON.stringify(anonKey)},
        VITE_USE_SUPABASE_NATIVE: ${JSON.stringify(nativeMode)},
        VITE_APP_URL: ${JSON.stringify(appUrl)}
    };
})();
`;

const targetFile = path.join(__dirname, '../frontend/js/env.js');

try {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log(`✅ Build Generator: Successfully generated frontend/js/env.js (URL: ${sanitizedUrl}, KeyPresent: ${!!anonKey}, KeyLength: ${anonKey.length})`);
} catch (err) {
    console.error('❌ Build Generator Error writing frontend/js/env.js:', err.message);
    process.exit(1);
}
