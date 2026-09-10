const https = require('https');

const liveHost = 'camporastudent.onrender.com';

function requestLiveEndpoint(path, method = 'GET', bodyData = null) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const options = {
            hostname: liveHost,
            port: 443,
            path: path,
            method: method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/json, text/plain, */*',
                'Accept-Language': 'en-US,en;q=0.9',
                'Connection': 'keep-alive'
            }
        };

        if (bodyData) {
            options.headers['Content-Type'] = 'application/json';
            options.headers['Content-Length'] = Buffer.byteLength(bodyData);
        }

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                const duration = Date.now() - start;
                let parsed = null;
                try {
                    parsed = JSON.parse(data);
                } catch (e) {}
                resolve({
                    statusCode: res.statusCode,
                    duration,
                    headers: res.headers,
                    data: parsed || data
                });
            });
        });

        req.on('error', (err) => reject(err));
        if (bodyData) req.write(bodyData);
        req.end();
    });
}

async function auditLiveProduction() {
    console.log("=========================================");
    console.log("CAMPORA LIVE PRODUCTION VERIFICATION SUITE");
    console.log("=========================================\n");

    // PHASE 1: Health Check
    console.log("--- PHASE 1: DEPLOYMENT HEALTH CHECK ---");
    const health = await requestLiveEndpoint('/api/health');
    console.log(`GET /api/health -> Status: ${health.statusCode} (${health.duration}ms), Data:`, health.data);

    await new Promise(r => setTimeout(r, 2000));

    // PHASE 3: Exact Failing Endpoints
    console.log("\n--- PHASE 3: FAILING ENDPOINTS VERIFICATION ---");
    
    // 3.1 Properties
    const p1 = await requestLiveEndpoint('/api/properties');
    console.log(`1. GET /api/properties -> Status: ${p1.statusCode} (${p1.duration}ms), Success: ${p1.data?.success}, Count: ${p1.data?.data?.properties?.length || p1.data?.properties?.length || 0}`);

    await new Promise(r => setTimeout(r, 2000));

    // 3.2 Search Rating Limit 6
    const p2 = await requestLiveEndpoint('/api/properties/search?sort=rating&limit=6');
    console.log(`2. GET /api/properties/search?sort=rating&limit=6 -> Status: ${p2.statusCode} (${p2.duration}ms), Success: ${p2.data?.success}, Count: ${p2.data?.properties?.length || 0}`);

    await new Promise(r => setTimeout(r, 2000));

    // 3.3 Search Rating Limit 1
    const p3 = await requestLiveEndpoint('/api/properties/search?sort=rating&limit=1');
    console.log(`3. GET /api/properties/search?sort=rating&limit=1 -> Status: ${p3.statusCode} (${p3.duration}ms), Success: ${p3.data?.success}, Count: ${p3.data?.properties?.length || 0}`);

    await new Promise(r => setTimeout(r, 2000));

    // 3.4 Search Limit 100
    const p4 = await requestLiveEndpoint('/api/properties/search?limit=100');
    console.log(`4. GET /api/properties/search?limit=100 -> Status: ${p4.statusCode} (${p4.duration}ms), Success: ${p4.data?.success}, Count: ${p4.data?.properties?.length || 0}`);

    await new Promise(r => setTimeout(r, 2000));

    // 3.5 Statistics
    const p5 = await requestLiveEndpoint('/api/statistics');
    console.log(`5. GET /api/statistics -> Status: ${p5.statusCode} (${p5.duration}ms), Success: ${p5.data?.success}, Stats:`, p5.data?.statistics);

    await new Promise(r => setTimeout(r, 2000));

    // PHASE 4: Google Auth Validation
    console.log("\n--- PHASE 4: GOOGLE AUTH VALIDATION & COOP ---");
    const gAuth = await requestLiveEndpoint('/api/auth/google', 'POST', JSON.stringify({ credential: "test_invalid_token" }));
    console.log(`POST /api/auth/google -> Status: ${gAuth.statusCode} (${gAuth.duration}ms), Response:`, gAuth.data);
    const coop = gAuth.headers['cross-origin-opener-policy'] || health.headers['cross-origin-opener-policy'];
    console.log("COOP Header:", coop);

    console.log("\n=========================================");
    console.log("LIVE AUDIT COMPLETED");
    console.log("=========================================");
}

auditLiveProduction().catch(err => {
    console.error("Live audit error:", err);
});
