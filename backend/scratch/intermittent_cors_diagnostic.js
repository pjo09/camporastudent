const https = require('https');

const liveHost = 'camporastudent.onrender.com';
const vercelOrigin = 'https://camporastudent.vercel.app';

function sendOptionsRequest(path, method = 'OPTIONS', requestHeaders = {}) {
    return new Promise((resolve) => {
        const start = Date.now();
        const req = https.request({
            hostname: liveHost,
            port: 443,
            path,
            method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                'Origin': vercelOrigin,
                'Access-Control-Request-Method': method === 'OPTIONS' ? 'GET' : undefined,
                'Access-Control-Request-Headers': method === 'OPTIONS' ? 'authorization,content-type' : undefined,
                ...requestHeaders
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                const duration = Date.now() - start;
                resolve({
                    statusCode: res.statusCode,
                    duration,
                    headers: res.headers,
                    bodySnippet: body.slice(0, 150).replace(/\r?\n|\r/g, " "),
                    serverHeader: res.headers['server'] || 'NONE',
                    renderId: res.headers['rndr-id'] || 'NONE',
                    renderRouting: res.headers['x-render-routing'] || 'NONE',
                    cfRay: res.headers['cf-ray'] || 'NONE',
                    allowOrigin: res.headers['access-control-allow-origin'] || null,
                    coop: res.headers['cross-origin-opener-policy'] || null
                });
            });
        });

        req.on('error', (err) => {
            resolve({
                statusCode: 0,
                duration: Date.now() - start,
                headers: {},
                bodySnippet: err.message,
                serverHeader: 'NETWORK_ERROR',
                allowOrigin: null
            });
        });

        req.end();
    });
}

async function runIntermittentCorsDiagnostic() {
    console.log("=========================================");
    console.log("CAMPORA INTERMITTENT PRODUCTION CORS AUDIT");
    console.log("=========================================\n");

    const results = [];
    let passCount = 0;
    let failCount = 0;
    let missingCorsCount = 0;
    const statusCounts = {};

    console.log("Executing 20 sequential OPTIONS preflight requests against live Render backend...\n");

    for (let i = 1; i <= 20; i++) {
        const res = await sendOptionsRequest('/api/properties/search?limit=100', 'OPTIONS');
        
        const hasCors = res.allowOrigin === vercelOrigin;
        const isPass = (res.statusCode === 204 || res.statusCode === 200) && hasCors;

        if (isPass) {
            passCount++;
        } else {
            failCount++;
            if (!hasCors) missingCorsCount++;
        }

        statusCounts[res.statusCode] = (statusCounts[res.statusCode] || 0) + 1;

        results.push({
            reqNum: i,
            statusCode: res.statusCode,
            hasCors,
            allowOrigin: res.allowOrigin,
            renderRouting: res.renderRouting,
            server: res.serverHeader,
            renderId: res.renderId
        });

        console.log(`REQUEST ${i}: Status=${res.statusCode} (${res.duration}ms) | Allow-Origin=${res.allowOrigin || 'MISSING'} | Render-Routing=${res.renderRouting} | Server=${res.serverHeader} | Verdict=${isPass ? 'PASS' : 'FAIL'}`);

        await new Promise(r => setTimeout(r, 1200));
    }

    console.log("\n--- 20-REQUEST PREFLIGHT SUMMARY ---");
    console.log(`TOTAL REQUESTS: 20`);
    console.log(`PASS COUNT: ${passCount}`);
    console.log(`FAIL COUNT: ${failCount}`);
    console.log(`MISSING CORS HEADERS COUNT: ${missingCorsCount}`);
    console.log(`STATUS BREAKDOWN:`, JSON.stringify(statusCounts));

    // Test GET /api/health
    console.log("\n--- TESTING GET /api/health ---");
    const healthRes = await sendOptionsRequest('/api/health', 'GET');
    console.log(`GET /api/health Status: ${healthRes.statusCode} (${healthRes.duration}ms), Allow-Origin: ${healthRes.allowOrigin || 'MISSING'}, Body: ${healthRes.bodySnippet}`);

    // Test GET /api/properties
    console.log("\n--- TESTING GET /api/properties ---");
    const propsRes = await sendOptionsRequest('/api/properties', 'GET');
    console.log(`GET /api/properties Status: ${propsRes.statusCode} (${propsRes.duration}ms), Allow-Origin: ${propsRes.allowOrigin || 'MISSING'}`);

    // Test GET /api/statistics
    console.log("\n--- TESTING GET /api/statistics ---");
    const statsRes = await sendOptionsRequest('/api/statistics', 'GET');
    console.log(`GET /api/statistics Status: ${statsRes.statusCode} (${statsRes.duration}ms), Allow-Origin: ${statsRes.allowOrigin || 'MISSING'}`);

    // Test OPTIONS /api/auth/google
    console.log("\n--- TESTING OPTIONS /api/auth/google ---");
    const gPreflight = await sendOptionsRequest('/api/auth/google', 'OPTIONS', {
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
    });
    console.log(`OPTIONS /api/auth/google Status: ${gPreflight.statusCode} (${gPreflight.duration}ms), Allow-Origin: ${gPreflight.allowOrigin || 'MISSING'}, COOP: ${gPreflight.coop || 'MISSING'}`);

    console.log("\n=========================================");
    console.log("INTERMITTENT DIAGNOSTIC COMPLETED");
    console.log("=========================================");
}

runIntermittentCorsDiagnostic().catch(console.error);
