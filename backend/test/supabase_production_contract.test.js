const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });
process.env.DATABASE_PROVIDER = 'supabase';

const http = require('http');
const https = require('https');

async function runProductionContractTest() {
    console.log("\n=========================================");
    console.log("CAMPORA SUPABASE PRODUCTION CONTRACT TEST");
    console.log("=========================================\n");

    // Local express app setup to test endpoints directly or live server
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

    console.log(`Testing production contract locally against port ${server.address().port} (DATABASE_PROVIDER=supabase)...`);

    let pass = 0;
    let fail = 0;

    function assertContract(cond, name, detail = "") {
        if (cond) {
            console.log(`✅ ${name}: PASS ${detail ? `(${detail})` : ""}`);
            pass++;
        } else {
            console.error(`❌ ${name}: FAIL ${detail ? `(${detail})` : ""}`);
            fail++;
        }
    }

    async function fetchJson(url, options = {}) {
        return new Promise((resolve, reject) => {
            const req = http.request(url, options, (res) => {
                let body = '';
                res.on('data', chunk => body += chunk);
                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(body);
                        resolve({ status: res.statusCode, headers: res.headers, body: parsed, rawBody: body });
                    } catch (e) {
                        resolve({ status: res.statusCode, headers: res.headers, rawBody: body });
                    }
                });
            });
            req.on('error', reject);
            if (options.body) {
                req.write(options.body);
            }
            req.end();
        });
    }

    // 1. Health check
    {
        const res = await fetchJson(`${baseUrl}/api/health`);
        assertContract(res.status === 200 && res.body?.status === "UP", "1. GET /api/health", `Status ${res.status}`);
    }

    // 2. GET /api/properties
    {
        const res = await fetchJson(`${baseUrl}/api/properties`);
        const ok = res.status === 200 && res.body?.success === true && Array.isArray(res.body?.data?.properties);
        assertContract(ok, "2. GET /api/properties", `Retrieved ${res.body?.data?.properties?.length || 0} properties`);
    }

    // 3. GET /api/properties/search?sort=rating&limit=6
    {
        const res = await fetchJson(`${baseUrl}/api/properties/search?sort=rating&limit=6`);
        const props = res.body?.properties || [];
        const ok = res.status === 200 && res.body?.success === true && props.length > 0;
        assertContract(ok, "3. GET /api/properties/search?sort=rating&limit=6", `Retrieved ${props.length} properties sorted by rating`);
    }

    // 4. GET /api/properties/search?sort=rating&limit=1
    {
        const res = await fetchJson(`${baseUrl}/api/properties/search?sort=rating&limit=1`);
        const props = res.body?.properties || [];
        const ok = res.status === 200 && res.body?.success === true && props.length === 1;
        assertContract(ok, "4. GET /api/properties/search?sort=rating&limit=1", `Retrieved ${props.length} property`);
    }

    // 5. GET /api/properties/search?limit=100
    {
        const res = await fetchJson(`${baseUrl}/api/properties/search?limit=100`);
        const props = res.body?.properties || [];
        const ok = res.status === 200 && res.body?.success === true && props.length >= 1;
        assertContract(ok, "5. GET /api/properties/search?limit=100", `Retrieved ${props.length} properties`);
    }

    // 6. GET /api/statistics
    {
        const res = await fetchJson(`${baseUrl}/api/statistics`);
        const stats = res.body?.statistics || {};
        const ok = res.status === 200 && res.body?.success === true && stats.properties > 0 && stats.cities > 0;
        assertContract(ok, "6. GET /api/statistics", `props=${stats.properties}, cities=${stats.cities}, unis=${stats.universities}, owners=${stats.verifiedOwners}`);
    }

    // 7. POST /api/auth/google
    {
        const res = await fetchJson(`${baseUrl}/api/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential: 'test_invalid_token' })
        });
        const ok = res.status !== 500 && (res.status === 400 || res.status === 401 || res.status === 500 && res.body?.errorCode === 'GOOGLE_CONFIG_ERROR');
        assertContract(ok, "7. POST /api/auth/google Validation", `Status ${res.status} (No buffering timeout or 500 server crash)`);
    }

    // 8. COOP Header check
    {
        const res = await fetchJson(`${baseUrl}/api/health`);
        const coopHeader = res.headers['cross-origin-opener-policy'];
        assertContract(coopHeader === 'same-origin-allow-popups', "8. Cross-Origin-Opener-Policy Header", `Header: ${coopHeader}`);
    }

    server.close();

    console.log("\n=========================================");
    console.log(`PRODUCTION CONTRACT SUITE SUMMARY: ${pass} PASSED, ${fail} FAILED`);
    console.log("=========================================\n");

    if (fail > 0) process.exit(1);
}

runProductionContractTest().catch(err => {
    console.error("Contract test error:", err);
    process.exit(1);
});
