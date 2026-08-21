// =====================================================
// CAMPORA VERCEL DEPLOYMENT RUNTIME CONFIG GENERATOR
// Generates frontend/js/env.js at build time from Vercel environment variables.
// Exposes ONLY public environment variables (NO service_role secrets).
// =====================================================

const fs = require('fs');
const path = require('path');

const url = (process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || 'https://wsldciqtznqjnmltgxpm.supabase.co').trim();
const anonKey = (process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '').trim();
const nativeMode = (process.env.VITE_USE_SUPABASE_NATIVE || 'true').trim();
const appUrl = (process.env.VITE_APP_URL || 'https://camporastudent.vercel.app').trim();

// Ensure pooler URL is sanitized to official PostgREST API URL
const sanitizedUrl = (url.includes('pooler.supabase.com') || url.includes('campora.supabase.co'))
    ? 'https://wsldciqtznqjnmltgxpm.supabase.co'
    : url;

// Validate that VITE_SUPABASE_ANON_KEY is provided in build environment when running on Vercel
if (process.env.VERCEL && !anonKey) {
    console.error('❌ Fatal Build Error: VITE_SUPABASE_ANON_KEY is missing in Vercel build environment.');
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

// Target path works whether called from root or frontend directory
let targetFile = path.join(__dirname, '../js/env.js');
if (!fs.existsSync(path.dirname(targetFile))) {
    targetFile = path.join(__dirname, '../../frontend/js/env.js');
}

try {
    fs.writeFileSync(targetFile, content, 'utf8');
    console.log(`✅ Build Script: Generated frontend/js/env.js (URL: ${sanitizedUrl}, AnonKeyPresent: ${!!anonKey}, Length: ${anonKey.length})`);
} catch (err) {
    console.error('❌ Build Script Error generating frontend/js/env.js:', err.message);
    process.exit(1);
}
