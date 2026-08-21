const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });
process.env.DATABASE_PROVIDER = 'supabase';

const http = require('http');

async function runCorsProductionContractTest() {
    console.log("\n=========================================");
    console.log("CAMPORA PRODUCTION CORS & PREFLIGHT CONTRACT TEST");
    console.log("=========================================\n");

    const app = require('../app');
    let server;
    let baseUrl;

    await new Promise((resolve) => {
        server = app.listen(0, () => {
            const port = server.address().port;
            baseUrl = `http://127.0.0.1:${port}`;
            resolve();
        });
    });

    console.log(`Testing production CORS contract against local express port ${server.address().port}...`);

    let pass = 0;
    let fail = 0;

    function assert(cond, name, detail = "") {
        if (cond) {
            console.log(`✅ ${name}: PASS ${detail ? `(${detail})` : ""}`);
            pass++;
        } else {
            console.error(`❌ ${name}: FAIL ${detail ? `(${detail})` : ""}`);
            fail++;
        }
    }

    function requestOptions(pathStr, origin = "https://camporastudent.vercel.app", method = "GET", headers = "content-type,authorization") {
        return new Promise((resolve, reject) => {
            const u = new URL(baseUrl + pathStr);
            const req = http.request(u, {
                method: 'OPTIONS',
                headers: {
                    'Origin': origin,
                    'Access-Control-Request-Method': method,
                    'Access-Control-Request-Headers': headers
                }
            }, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => resolve({ statusCode: res.statusCode, headers: res.headers, body }));
            });
            req.on('error', reject);
            req.end();
        });
    }

    try {
        // 1. OPTIONS /api/properties/search
        const pSearch = await requestOptions('/api/properties/search?sort=rating&limit=6', 'https://camporastudent.vercel.app', 'GET');
        assert(pSearch.statusCode === 204 || pSearch.statusCode === 200, "1. OPTIONS /api/properties/search status code", `Status ${pSearch.statusCode}`);
        assert(pSearch.headers['access-control-allow-origin'] === 'https://camporastudent.vercel.app', "1. Access-Control-Allow-Origin header", `Header: ${pSearch.headers['access-control-allow-origin']}`);
        assert(pSearch.headers['access-control-allow-credentials'] === 'true', "1. Access-Control-Allow-Credentials header", `Header: ${pSearch.headers['access-control-allow-credentials']}`);
        assert(pSearch.headers['access-control-allow-methods']?.includes('GET'), "1. Access-Control-Allow-Methods header", `Header: ${pSearch.headers['access-control-allow-methods']}`);

        // 2. OPTIONS /api/statistics
        const pStats = await requestOptions('/api/statistics', 'https://camporastudent.vercel.app', 'GET');
        assert(pStats.statusCode === 204 || pStats.statusCode === 200, "2. OPTIONS /api/statistics status code", `Status ${pStats.statusCode}`);
        assert(pStats.headers['access-control-allow-origin'] === 'https://camporastudent.vercel.app', "2. Access-Control-Allow-Origin header", `Header: ${pStats.headers['access-control-allow-origin']}`);

        // 3. OPTIONS /api/auth/google
        const pGoogle = await requestOptions('/api/auth/google', 'https://camporastudent.vercel.app', 'POST');
        assert(pGoogle.statusCode === 204 || pGoogle.statusCode === 200, "3. OPTIONS /api/auth/google status code", `Status ${pGoogle.statusCode}`);
        assert(pGoogle.headers['access-control-allow-origin'] === 'https://camporastudent.vercel.app', "3. Access-Control-Allow-Origin header", `Header: ${pGoogle.headers['access-control-allow-origin']}`);

        // 4. Unauthorized Origin Check (Must NOT match wildcard or unauthorized origin)
        const pUnauthorized = await requestOptions('/api/properties/search', 'https://evil-hacker-domain.com', 'GET');
        assert(pUnauthorized.headers['access-control-allow-origin'] !== 'https://evil-hacker-domain.com' && pUnauthorized.headers['access-control-allow-origin'] !== '*', "4. Reject Unauthorized Origin", `Header: ${pUnauthorized.headers['access-control-allow-origin'] || 'none'}`);

        // 5. Vercel Preview Deployments Matching
        const pPreview = await requestOptions('/api/properties/search', 'https://camporastudent-git-preview-test.vercel.app', 'GET');
        assert(pPreview.headers['access-control-allow-origin'] === 'https://camporastudent-git-preview-test.vercel.app', "5. Support Vercel preview domain pattern", `Header: ${pPreview.headers['access-control-allow-origin']}`);

    } finally {
        server.close();
    }

    console.log(`\n=========================================`);
    console.log(`CORS CONTRACT SUITE SUMMARY: ${pass} PASSED, ${fail} FAILED`);
    console.log(`=========================================\n`);

    if (fail > 0) {
        process.exit(1);
    }
}

runCorsProductionContractTest().catch(err => {
    console.error("Cors test error:", err);
    process.exit(1);
});
