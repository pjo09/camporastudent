// ===============================================
// CAMPORA — PRODUCTION CORS VERIFICATION TEST SUITE
// ===============================================
// Verifies CORS and OPTIONS preflight behavior against
// Express app instance directly (in-memory HTTP server).
// ===============================================

const http = require("http");
const app = require("../app");

let server;
let port;

function request(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    body: data
                });
            });
        });
        req.on("error", reject);
        if (body) req.write(body);
        req.end();
    });
}

async function runTests() {
    console.log("=========================================");
    console.log("CAMPORA PRODUCTION CORS & PREFLIGHT SUITE");
    console.log("=========================================\n");

    // Start ephemeral server
    server = http.createServer(app);
    await new Promise((res) => server.listen(0, "127.0.0.1", res));
    port = server.address().port;

    const prodOrigin = "https://camporastudent.vercel.app";
    const unauthorizedOrigin = "https://evil.example.com";

    let passedCount = 0;
    let totalCount = 0;

    function assert(condition, message) {
        totalCount++;
        if (condition) {
            console.log(`✅ [PASS] ${message}`);
            passedCount++;
        } else {
            console.error(`❌ [FAIL] ${message}`);
        }
    }

    try {
        // TEST 1: OPTIONS /api/properties/search
        {
            const res = await request({
                hostname: "127.0.0.1",
                port,
                path: "/api/properties/search?limit=1",
                method: "OPTIONS",
                headers: {
                    "Origin": prodOrigin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "Content-Type, Authorization"
                }
            });

            assert(res.statusCode === 204 || res.statusCode === 200, `OPTIONS /api/properties/search status=${res.statusCode}`);
            assert(res.headers["access-control-allow-origin"] === prodOrigin, `OPTIONS /api/properties/search allow-origin equals prod origin`);
            assert(res.headers["access-control-allow-credentials"] === "true", `OPTIONS /api/properties/search allow-credentials equals true`);
            assert(res.headers["access-control-allow-methods"]?.includes("GET"), `OPTIONS /api/properties/search allow-methods includes GET`);
        }

        // TEST 2: OPTIONS /api/statistics
        {
            const res = await request({
                hostname: "127.0.0.1",
                port,
                path: "/api/statistics",
                method: "OPTIONS",
                headers: {
                    "Origin": prodOrigin,
                    "Access-Control-Request-Method": "GET",
                    "Access-Control-Request-Headers": "Content-Type, Authorization"
                }
            });

            assert(res.statusCode === 204 || res.statusCode === 200, `OPTIONS /api/statistics status=${res.statusCode}`);
            assert(res.headers["access-control-allow-origin"] === prodOrigin, `OPTIONS /api/statistics allow-origin equals prod origin`);
            assert(res.headers["access-control-allow-credentials"] === "true", `OPTIONS /api/statistics allow-credentials equals true`);
        }

        // TEST 3: OPTIONS /api/auth/google
        {
            const res = await request({
                hostname: "127.0.0.1",
                port,
                path: "/api/auth/google",
                method: "OPTIONS",
                headers: {
                    "Origin": prodOrigin,
                    "Access-Control-Request-Method": "POST",
                    "Access-Control-Request-Headers": "Content-Type"
                }
            });

            assert(res.statusCode === 204 || res.statusCode === 200, `OPTIONS /api/auth/google status=${res.statusCode}`);
            assert(res.headers["access-control-allow-origin"] === prodOrigin, `OPTIONS /api/auth/google allow-origin equals prod origin`);
            assert(res.headers["access-control-allow-credentials"] === "true", `OPTIONS /api/auth/google allow-credentials equals true`);
        }

        // TEST 4: GET /api/properties/search?limit=1 with Origin
        {
            const res = await request({
                hostname: "127.0.0.1",
                port,
                path: "/api/properties/search?limit=1",
                method: "GET",
                headers: {
                    "Origin": prodOrigin
                }
            });

            assert(res.headers["access-control-allow-origin"] === prodOrigin, `GET /api/properties/search CORS origin equals prod origin`);
            assert(res.headers["access-control-allow-credentials"] === "true", `GET /api/properties/search CORS credentials equals true`);
        }

        // TEST 5: GET /api/statistics with Origin
        {
            const res = await request({
                hostname: "127.0.0.1",
                port,
                path: "/api/statistics",
                method: "GET",
                headers: {
                    "Origin": prodOrigin
                }
            });

            assert(res.headers["access-control-allow-origin"] === prodOrigin, `GET /api/statistics CORS origin equals prod origin`);
            assert(res.headers["access-control-allow-credentials"] === "true", `GET /api/statistics CORS credentials equals true`);
        }

        // TEST 6: Unauthorized Origin Rejection
        {
            const res = await request({
                hostname: "127.0.0.1",
                port,
                path: "/api/properties/search?limit=1",
                method: "GET",
                headers: {
                    "Origin": unauthorizedOrigin
                }
            });

            assert(res.headers["access-control-allow-origin"] !== unauthorizedOrigin, `Unauthorized origin evil.example.com rejected (no Access-Control-Allow-Origin header)`);
        }

        // TEST 7: COOP Header Check
        {
            const res = await request({
                hostname: "127.0.0.1",
                port,
                path: "/api/health",
                method: "GET"
            });

            assert(res.headers["cross-origin-opener-policy"] === "same-origin-allow-popups", `Helmet COOP policy equals same-origin-allow-popups`);
        }

    } finally {
        server.close();
    }

    console.log("\n=========================================");
    console.log(`CORS TEST SUITE SUMMARY: ${passedCount}/${totalCount} PASSED`);
    console.log("=========================================");

    if (passedCount < totalCount) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
});
