const https = require('https');

const liveHost = 'camporastudent.onrender.com';

function requestEndpoint(path, method, reqHeaders = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: liveHost,
            port: 443,
            path: path,
            method: method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                ...reqHeaders
            }
        };

        const req = https.request(options, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body
                });
            });
        });

        req.on('error', err => reject(err));
        req.end();
    });
}

async function runPreflightRepro() {
    console.log("=========================================");
    console.log("PHASE 2 — REPRODUCE PREFLIGHT AGAINST LIVE RENDER");
    console.log("=========================================\n");

    // Wake up container
    console.log("Waking up Render container via GET /api/health...");
    let health = await requestEndpoint('/api/health', 'GET');
    let attempts = 0;
    while (health.statusCode === 503 && attempts < 5) {
        attempts++;
        console.log(`Render sleeping (503). Waiting 5s (attempt ${attempts}/5)...`);
        await new Promise(r => setTimeout(r, 5000));
        health = await requestEndpoint('/api/health', 'GET');
    }
    console.log(`Health Status: ${health.statusCode}, Body: ${health.body}\n`);

    const tests = [
        {
            name: "1. OPTIONS /api/properties/search?sort=rating&limit=6",
            path: "/api/properties/search?sort=rating&limit=6",
            method: "GET",
            headers: "content-type,authorization"
        },
        {
            name: "2. OPTIONS /api/statistics",
            path: "/api/statistics",
            method: "GET",
            headers: "content-type,authorization"
        },
        {
            name: "3. OPTIONS /api/auth/google",
            path: "/api/auth/google",
            method: "POST",
            headers: "content-type"
        }
    ];

    for (const t of tests) {
        console.log(`--- Testing ${t.name} ---`);
        try {
            const res = await requestEndpoint(t.path, 'OPTIONS', {
                'Origin': 'https://camporastudent.vercel.app',
                'Access-Control-Request-Method': t.method,
                'Access-Control-Request-Headers': t.headers
            });
            console.log(`HTTP Status: ${res.statusCode}`);
            console.log(`Access-Control-Allow-Origin: ${res.headers['access-control-allow-origin']}`);
            console.log(`Access-Control-Allow-Methods: ${res.headers['access-control-allow-methods']}`);
            console.log(`Access-Control-Allow-Headers: ${res.headers['access-control-allow-headers']}`);
            console.log(`Access-Control-Allow-Credentials: ${res.headers['access-control-allow-credentials']}`);
            console.log(`COOP Header: ${res.headers['cross-origin-opener-policy']}`);
            if (res.statusCode !== 204 && res.statusCode !== 200) {
                console.log(`Response Body Snippet: ${res.body.slice(0, 300)}`);
            }
        } catch (e) {
            console.error(`Error:`, e.message);
        }
        console.log("\n");
        await new Promise(r => setTimeout(r, 1000));
    }
}

runPreflightRepro().catch(console.error);
