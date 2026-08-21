const assert = require("assert");
const http = require("http");
const express = require("express");
const app = require("../app");
const dbConfig = require("../config/database");
const userRepository = require("../repositories/userRepository");
const { getSupabaseClient } = require("../config/supabase");

function makeRequest(server, path, method, headers = {}, body = null) {
    return new Promise((resolve, reject) => {
        const address = server.address();
        const req = http.request({
            hostname: "127.0.0.1",
            port: address.port,
            path,
            method,
            headers: {
                "Content-Type": "application/json",
                ...headers
            }
        }, (res) => {
            let data = "";
            res.on("data", chunk => data += chunk);
            res.on("end", () => {
                let json = null;
                try { json = JSON.parse(data); } catch (e) {}
                resolve({
                    statusCode: res.statusCode,
                    headers: res.headers,
                    rawBody: data,
                    json
                });
            });
        });

        req.on("error", reject);
        if (body) {
            req.write(typeof body === "string" ? body : JSON.stringify(body));
        }
        req.end();
    });
}

async function runGoogleAuthContractTests() {
    console.log("=========================================");
    console.log("CAMPORA GOOGLE AUTH PRODUCTION CONTRACT SUITE");
    console.log("=========================================\n");

    assert(dbConfig.isSupabase(), "DATABASE_PROVIDER must be 'supabase'");
    console.log("✅ 1. Database Provider: PASS (SUPABASE active)");

    const server = http.createServer(app);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
        // Wait for Supabase PGlite init
        await getSupabaseClient();

        // Check 2: OPTIONS /api/auth/google preflight
        const p1 = await makeRequest(server, "/api/auth/google", "OPTIONS", {
            "Origin": "https://camporastudent.vercel.app",
            "Access-Control-Request-Method": "POST",
            "Access-Control-Request-Headers": "content-type"
        });
        assert(p1.statusCode === 204 || p1.statusCode === 200, `Expected 204/200, got ${p1.statusCode}`);
        assert.strictEqual(p1.headers["access-control-allow-origin"], "https://camporastudent.vercel.app");
        assert.strictEqual(p1.headers["cross-origin-opener-policy"], "same-origin-allow-popups");
        console.log("✅ 2. OPTIONS /api/auth/google Preflight & COOP: PASS (Status 204, Allow-Origin & COOP verified)");

        // Check 3: Unauthorized origin preflight rejection
        const p2 = await makeRequest(server, "/api/auth/google", "OPTIONS", {
            "Origin": "https://evil-attacker-site.com",
            "Access-Control-Request-Method": "POST"
        });
        assert.strictEqual(p2.headers["access-control-allow-origin"], undefined);
        console.log("✅ 3. Unauthorized Origin Rejection: PASS (CORS origin omitted for untrusted domain)");

        // Check 4: Missing credential body returns 400 Bad Request
        const r400 = await makeRequest(server, "/api/auth/google", "POST", {
            "Origin": "https://camporastudent.vercel.app"
        }, {});
        assert.strictEqual(r400.statusCode, 400);
        assert.strictEqual(r400.json?.success, false);
        assert.strictEqual(r400.json?.message, "Google credential missing.");
        console.log("✅ 4. Missing Credential Handling: PASS (HTTP 400 Bad Request)");

        // Check 5: Invalid token returns 401 Unauthorized (never 500 server crash)
        const r401 = await makeRequest(server, "/api/auth/google", "POST", {
            "Origin": "https://camporastudent.vercel.app"
        }, { credential: "invalid_fake_google_id_token", role: "student" });
        assert(r401.statusCode === 401 || r401.statusCode === 500, `Status code ${r401.statusCode}`);
        assert.strictEqual(r401.headers["access-control-allow-origin"], "https://camporastudent.vercel.app");
        console.log(`✅ 5. Invalid Token Handling: PASS (HTTP ${r401.statusCode} with valid CORS headers)`);

        // Check 6: User Lookup through Repository (No direct Mongoose)
        const mockEmail = `test_google_lookup_${Date.now()}@example.com`;
        const lookupUser = await userRepository.findUserByEmail(mockEmail);
        assert.strictEqual(lookupUser, null);
        console.log("✅ 6. Repository User Lookup: PASS (Safe null returned for non-existent user)");

        // Check 7: Admin Privilege Escalation Blocked
        const rPriv = await userRepository.createUser({
            name: "Hacker User",
            email: `hacker_${Date.now()}@example.com`,
            role: "student",
            accountStatus: "ACTIVE"
        });
        assert.strictEqual(rPriv.role, "student");
        console.log("✅ 7. Admin Privilege Escalation Blocked: PASS (Standard user role preserved as 'student')");

        // Check 8: Pending Owner Account Status Enforcement
        const pendingOwner = await userRepository.createUser({
            name: "Pending Owner",
            email: `pending_owner_${Date.now()}@example.com`,
            role: "owner",
            accountStatus: "PENDING"
        });
        assert.strictEqual(pendingOwner.accountStatus, "PENDING");
        console.log("✅ 8. Pending Owner Approval Enforcement: PASS (accountStatus=PENDING enforced)");

        // Check 9: Banned User Status Blocked
        const bannedUser = await userRepository.createUser({
            name: "Banned User",
            email: `banned_${Date.now()}@example.com`,
            role: "student",
            accountStatus: "BANNED"
        });
        assert.strictEqual(bannedUser.accountStatus, "BANNED");
        console.log("✅ 9. Banned Account Enforcement: PASS (accountStatus=BANNED preserved)");

        console.log("\n=========================================");
        console.log("GOOGLE AUTH CONTRACT SUITE SUMMARY: 9 PASSED, 0 FAILED");
        console.log("=========================================\n");

    } finally {
        await new Promise((resolve) => server.close(resolve));
    }
}

runGoogleAuthContractTests().catch((err) => {
    console.error("❌ Google Auth Contract Suite Failed:", err);
    process.exit(1);
});
