const https = require('https');

const liveHost = 'camporastudent.onrender.com';
const vercelOrigin = 'https://camporastudent.vercel.app';

function sendExactRequest(path, method, headers = {}) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: liveHost,
            port: 443,
            path,
            method,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
                ...headers
            }
        };

        const req = https.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });

        req.on('error', reject);
        req.end();
    });
}

async function runDiagnosis() {
    console.log("=========================================");
    console.log("CAMPORA DEFINITIVE CORS DIAGNOSTIC SUITE");
    console.log("=========================================\n");

    // 1. Check Container Readiness
    let health = await sendExactRequest('/api/health', 'GET');
    console.log("Container Health Check:", health.statusCode, health.body);

    await new Promise(r => setTimeout(r, 1000));

    // 2. Exact Browser Preflight 1: GET search with Content-Type & Authorization
    console.log("\n--- TEST 1: OPTIONS /api/properties/search?sort=rating&limit=6 ---");
    const p1 = await sendExactRequest('/api/properties/search?sort=rating&limit=6', 'OPTIONS', {
        'Origin': vercelOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type'
    });
    console.log("HTTP Status:", p1.statusCode);
    console.log("Access-Control-Allow-Origin:", p1.headers['access-control-allow-origin'] || 'MISSING');
    console.log("Access-Control-Allow-Methods:", p1.headers['access-control-allow-methods'] || 'MISSING');
    console.log("Access-Control-Allow-Headers:", p1.headers['access-control-allow-headers'] || 'MISSING');
    console.log("Access-Control-Allow-Credentials:", p1.headers['access-control-allow-credentials'] || 'MISSING');

    await new Promise(r => setTimeout(r, 1000));

    // 3. Exact Browser Preflight 2: GET statistics
    console.log("\n--- TEST 2: OPTIONS /api/statistics ---");
    const p2 = await sendExactRequest('/api/statistics', 'OPTIONS', {
        'Origin': vercelOrigin,
        'Access-Control-Request-Method': 'GET',
        'Access-Control-Request-Headers': 'authorization,content-type'
    });
    console.log("HTTP Status:", p2.statusCode);
    console.log("Access-Control-Allow-Origin:", p2.headers['access-control-allow-origin'] || 'MISSING');

    await new Promise(r => setTimeout(r, 1000));

    // 4. Exact Browser Preflight 3: POST google auth
    console.log("\n--- TEST 3: OPTIONS /api/auth/google ---");
    const p3 = await sendExactRequest('/api/auth/google', 'OPTIONS', {
        'Origin': vercelOrigin,
        'Access-Control-Request-Method': 'POST',
        'Access-Control-Request-Headers': 'content-type'
    });
    console.log("HTTP Status:", p3.statusCode);
    console.log("Access-Control-Allow-Origin:", p3.headers['access-control-allow-origin'] || 'MISSING');

    await new Promise(r => setTimeout(r, 1000));

    // 5. Test Actual GET with Origin header
    console.log("\n--- TEST 4: GET /api/properties/search?sort=rating&limit=6 (With Origin) ---");
    const g1 = await sendExactRequest('/api/properties/search?sort=rating&limit=6', 'GET', {
        'Origin': vercelOrigin,
        'Content-Type': 'application/json'
    });
    console.log("HTTP Status:", g1.statusCode);
    console.log("Access-Control-Allow-Origin:", g1.headers['access-control-allow-origin'] || 'MISSING');
    console.log("Content-Type:", g1.headers['content-type']);
    if (g1.statusCode !== 200) {
        console.log("Error Body:", g1.body.slice(0, 300));
    }

    console.log("\n=========================================");
    console.log("DIAGNOSTIC COMPLETE");
    console.log("=========================================");
}

runDiagnosis().catch(console.error);
