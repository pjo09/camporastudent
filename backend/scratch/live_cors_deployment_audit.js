const https = require('https');

const liveHost = 'camporastudent.onrender.com';
const targetOrigin = 'https://camporastudent.vercel.app';

function requestEndpoint(path, method, customHeaders = {}) {
    return new Promise((resolve, reject) => {
        const startTime = Date.now();
        const options = {
            hostname: liveHost,
            port: 443,
            path: path,
            method: method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                ...customHeaders
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const duration = Date.now() - startTime;
                let parsed = null;
                try {
                    parsed = JSON.parse(body);
                } catch (e) {}
                resolve({
                    statusCode: res.statusCode,
                    duration,
                    headers: res.headers,
                    rawBody: body,
                    json: parsed
                });
            });
        });

        req.on('error', err => reject(err));
        req.end();
    });
}

async function verifyLiveCorsDeployment() {
    console.log("=========================================");
    console.log("CAMPORA FINAL LIVE CORS DEPLOYMENT AUDIT");
    console.log("=========================================\n");

    // 1. Warm up Render instance via GET /api/health
    console.log("1. Checking Live Backend Health (GET /api/health)...");
    let health = await requestEndpoint('/api/health', 'GET');
    let attempts = 0;
    while ((health.statusCode === 503 || health.statusCode === 502) && attempts < 6) {
        attempts++;
        console.log(`Live Render waking up (Status ${health.statusCode}). Waiting 5s (attempt ${attempts}/6)...`);
        await new Promise(r => setTimeout(r, 5000));
        health = await requestEndpoint('/api/health', 'GET');
    }
    console.log(`GET /api/health Status: ${health.statusCode} (${health.duration}ms), Body:`, health.json || health.rawBody);

    await new Promise(r => setTimeout(r, 1000));

    // 2. Preflight Test 1: OPTIONS /api/properties/search?sort=rating&limit=6
    console.log("\n--- 2. REAL PREFLIGHT: OPTIONS /api/properties/search ---");
    const p1 = await requestEndpoint('/api/properties/search?sort=rating&limit=6', 'OPTIONS', {
        'Origin': targetOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type'
    });
    console.log(`HTTP Status: ${p1.statusCode} (${p1.duration}ms)`);
    console.log(`Access-Control-Allow-Origin: ${p1.headers['access-control-allow-origin'] || 'NONE'}`);
    console.log(`Access-Control-Allow-Methods: ${p1.headers['access-control-allow-methods'] || 'NONE'}`);
    console.log(`Access-Control-Allow-Headers: ${p1.headers['access-control-allow-headers'] || 'NONE'}`);
    console.log(`Access-Control-Allow-Credentials: ${p1.headers['access-control-allow-credentials'] || 'NONE'}`);

    await new Promise(r => setTimeout(r, 1000));

    // 3. Preflight Test 2: OPTIONS /api/statistics
    console.log("\n--- 3. REAL PREFLIGHT: OPTIONS /api/statistics ---");
    const p2 = await requestEndpoint('/api/statistics', 'OPTIONS', {
        'Origin': targetOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'content-type'
    });
    console.log(`HTTP Status: ${p2.statusCode} (${p2.duration}ms)`);
    console.log(`Access-Control-Allow-Origin: ${p2.headers['access-control-allow-origin'] || 'NONE'}`);
    console.log(`Access-Control-Allow-Methods: ${p2.headers['access-control-allow-methods'] || 'NONE'}`);

    await new Promise(r => setTimeout(r, 1000));

    // 4. Preflight Test 3: OPTIONS /api/auth/google
    console.log("\n--- 4. REAL PREFLIGHT: OPTIONS /api/auth/google ---");
    const p3 = await requestEndpoint('/api/auth/google', 'OPTIONS', {
        'Origin': targetOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
    });
    console.log(`HTTP Status: ${p3.statusCode} (${p3.duration}ms)`);
    console.log(`Access-Control-Allow-Origin: ${p3.headers['access-control-allow-origin'] || 'NONE'}`);
    console.log(`COOP Header: ${p3.headers['cross-origin-opener-policy'] || 'NONE'}`);

    await new Promise(r => setTimeout(r, 1000));

    // 5. Live GET Endpoints with Origin header
    console.log("\n--- 5. LIVE CROSS-ORIGIN GET REQUESTS ---");

    const e1 = await requestEndpoint('/api/properties', 'GET', { 'Origin': targetOrigin });
    console.log(`GET /api/properties -> Status: ${e1.statusCode} (${e1.duration}ms), Allow-Origin: ${e1.headers['access-control-allow-origin'] || 'NONE'}, Count: ${e1.json?.data?.properties?.length || e1.json?.properties?.length || 0}`);

    await new Promise(r => setTimeout(r, 1000));

    const e2 = await requestEndpoint('/api/properties/search?sort=rating&limit=6', 'GET', { 'Origin': targetOrigin });
    console.log(`GET /api/properties/search?sort=rating&limit=6 -> Status: ${e2.statusCode} (${e2.duration}ms), Allow-Origin: ${e2.headers['access-control-allow-origin'] || 'NONE'}, Count: ${e2.json?.properties?.length || 0}`);

    await new Promise(r => setTimeout(r, 1000));

    const e3 = await requestEndpoint('/api/properties/search?limit=100', 'GET', { 'Origin': targetOrigin });
    console.log(`GET /api/properties/search?limit=100 -> Status: ${e3.statusCode} (${e3.duration}ms), Allow-Origin: ${e3.headers['access-control-allow-origin'] || 'NONE'}, Count: ${e3.json?.properties?.length || 0}`);

    await new Promise(r => setTimeout(r, 1000));

    const e4 = await requestEndpoint('/api/statistics', 'GET', { 'Origin': targetOrigin });
    console.log(`GET /api/statistics -> Status: ${e4.statusCode} (${e4.duration}ms), Allow-Origin: ${e4.headers['access-control-allow-origin'] || 'NONE'}, Stats:`, e4.json?.statistics);

    console.log("\n=========================================");
    console.log("LIVE AUDIT COMPLETED");
    console.log("=========================================");
}

verifyLiveCorsDeployment().catch(console.error);
