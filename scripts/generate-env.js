// =====================================================
// CAMPORA VERCEL DEPLOYMENT RUNTIME CONFIG GENERATOR
// Single authoritative build script executed during Vercel deployment.
// Exposes ONLY public client environment variables (NO service_role secrets).
// =====================================================

const fs = require('fs');
const path = require('path');

// Helper to attempt loading simple key-value pairs from .env files if present (no external dependencies)
function loadEnvFile(envPath) {
    if (!fs.existsSync(envPath)) return;
    try {
        const fileContent = fs.readFileSync(envPath, 'utf8');
        const lines = fileContent.split(/\r?\n/);
        for (const line of lines) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const eqIndex = trimmed.indexOf('=');
            if (eqIndex > 0) {
                const key = trimmed.slice(0, eqIndex).trim();
                let val = trimmed.slice(eqIndex + 1).trim();
                if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
                    val = val.slice(1, -1);
                }
                if (!process.env[key]) {
                    process.env[key] = val;
                }
            }
        }
    } catch (e) {
        // Non-blocking
    }
}

// Load local .env files if process.env is missing values
const rootDir = path.join(__dirname, '..');
loadEnvFile(path.join(rootDir, '.env'));
loadEnvFile(path.join(rootDir, '.env.local'));
loadEnvFile(path.join(rootDir, '.env.production'));

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

if (!anonKey) {
    console.warn('⚠️ BUILD NOTICE: VITE_SUPABASE_ANON_KEY is not defined in environment variables during build.');
    console.warn('👉 To connect live Supabase Auth in production:');
    console.warn('   1. Go to Vercel Dashboard -> Project Settings -> Environment Variables.');
    console.warn('   2. Add VITE_SUPABASE_ANON_KEY with your Supabase Public Anon Key.');
    console.warn('   3. Ensure the "Production" target scope is selected and redeploy.');
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
    const targetDir = path.dirname(targetFile);
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log(`✅ Build Generator: Successfully generated frontend/js/env.js (URL: ${sanitizedUrl}, KeyPresent: ${!!anonKey}, KeyLength: ${anonKey.length})`);
} catch (err) {
    console.error('❌ Build Generator Error writing frontend/js/env.js:', err.message);
    process.exit(1);
}
