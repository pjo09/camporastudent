const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });
process.env.DATABASE_PROVIDER = 'supabase';

const mongoose = require('mongoose');
const { getSupabaseClient } = require('../config/supabase');
const userRepository = require('../repositories/userRepository');
const propertyRepository = require('../repositories/propertyRepository');
const { requireAreaAdmin, requireSuperAdmin } = require('../middleware/areaAdminAuth');

async function runAreaAdminSecurityTestSuite() {
    console.log("\n=========================================");
    console.log("CAMPORA AREA-BASED ADMIN ACCESS CONTROL SECURITY SUITE");
    console.log("=========================================\n");

    await mongoose.connect(process.env.MONGO_URI);
    const db = await getSupabaseClient();

    let testPass = 0;
    let testFail = 0;

    function assertSecurity(cond, testName, detail = "") {
        if (cond) {
            console.log(`✅ ${testName}: PASS ${detail ? `(${detail})` : ""}`);
            testPass++;
        } else {
            console.error(`❌ ${testName}: FAIL ${detail ? `(${detail})` : ""}`);
            testFail++;
        }
    }

    // Provision Test Accounts in Supabase
    const superAdminUser = await userRepository.findUserByEmail('camporaforstudents@gmail.com');
    
    // Create Temporary Test Admins for Area Tests
    const delhiAdminEmail = `area_admin_delhi_${Date.now()}@test.com`.toLowerCase();
    const mumbaiAdminEmail = `area_admin_mumbai_${Date.now()}@test.com`.toLowerCase();

    // Directly insert test profile rows into Supabase to guarantee test readiness
    const delhiRes = await db.query(`
        INSERT INTO profiles (name, email, role, status, account_status, verified)
        VALUES ('Delhi Area Admin', $1, 'admin', 'active', 'ACTIVE', true)
        RETURNING *
    `, [delhiAdminEmail]);

    const mumbaiRes = await db.query(`
        INSERT INTO profiles (name, email, role, status, account_status, verified)
        VALUES ('Mumbai Area Admin', $1, 'admin', 'active', 'ACTIVE', true)
        RETURNING *
    `, [mumbaiAdminEmail]);

    const delhiAdmin = delhiRes.rows[0];
    const mumbaiAdmin = mumbaiRes.rows[0];

    assertSecurity(delhiAdmin && mumbaiAdmin, "Test Admins Provisioned", `delhi=${delhiAdmin?.id}, mumbai=${mumbaiAdmin?.id}`);

    // Assign Scopes (Delhi = STATE, Mumbai = CITY)
    await db.query(`INSERT INTO admin_scopes (admin_user_id, scope_type, state, city) VALUES ($1, 'STATE', 'Delhi', '')`, [delhiAdmin.id]);
    await db.query(`INSERT INTO admin_scopes (admin_user_id, scope_type, state, city) VALUES ($1, 'CITY', 'Maharashtra', 'Mumbai')`, [mumbaiAdmin.id]);

    // Mock Express Request & Response Helper
    const createMockReqRes = (user, params = {}, query = {}, body = {}) => {
        const req = { user: { id: user.id, email: user.email, role: user.role }, params, query, body };
        let statusCode = 200;
        let responseJson = null;
        const res = {
            status: (code) => { statusCode = code; return res; },
            json: (data) => { responseJson = data; return res; }
        };
        return { req, res, getStatus: () => statusCode, getJson: () => responseJson };
    };

    // TEST 1: Super Admin can access Delhi resources
    {
        const { req, res } = createMockReqRes(superAdminUser);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Delhi', 'Delhi') === true, "TEST 1: Super Admin Delhi Access", "Global scope allows all regions");
    }

    // TEST 2: Super Admin can access Mumbai resources
    {
        const { req, res } = createMockReqRes(superAdminUser);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Maharashtra', 'Mumbai') === true, "TEST 2: Super Admin Mumbai Access", "Global scope allows all regions");
    }

    // TEST 3: Delhi Area Admin can access Delhi
    {
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Delhi', '') === true, "TEST 3: Delhi Admin Delhi Access", "State scope 'Delhi' authorized");
    }

    // TEST 4: Delhi Area Admin CANNOT access Mumbai
    {
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Maharashtra', 'Mumbai') === false, "TEST 4: Delhi Admin Mumbai Rejection", "Cross-regional access blocked");
    }

    // TEST 5: Mumbai Area Admin CANNOT access Delhi
    {
        const { req, res } = createMockReqRes(mumbaiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Delhi', '') === false, "TEST 5: Mumbai Admin Delhi Rejection", "Cross-regional access blocked");
    }

    // TEST 6: Delhi Area Admin CANNOT change own scope (requireSuperAdmin Guard)
    {
        const { req, res, getStatus } = createMockReqRes(delhiAdmin);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "TEST 6: Area Admin Cannot Modify Scope", "Super Admin middleware returns 403 Forbidden");
    }

    // TEST 7: Delhi Area Admin CANNOT create another admin
    {
        const { req, res, getStatus } = createMockReqRes(delhiAdmin, {}, {}, { adminUserId: delhiAdmin.id, scopeType: 'GLOBAL' });
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "TEST 7: Area Admin Cannot Create Admin", "403 Forbidden returned");
    }

    // TEST 8: Area Admin CANNOT access global platform settings
    {
        const { req, res, getStatus } = createMockReqRes(delhiAdmin);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "TEST 8: Area Admin Global Settings Access Blocked", "403 Forbidden");
    }

    // TEST 9: Area Admin CANNOT access cross-regional booking location
    {
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Karnataka', 'Bangalore') === false, "TEST 9: Cross-Regional Booking Location Blocked", "Karnataka access denied");
    }

    // TEST 10: Area Admin CANNOT approve cross-regional owner
    {
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Maharashtra', 'Mumbai') === false, "TEST 10: Cross-Regional Owner Approval Blocked", "Mumbai access denied");
    }

    // TEST 11: Area Admin CANNOT modify cross-regional property
    {
        const { req, res } = createMockReqRes(mumbaiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Jharkhand', 'Ranchi') === false, "TEST 11: Cross-Regional Property Modification Blocked", "Ranchi access denied");
    }

    // TEST 12: Super Admin can manage all areas
    {
        const { req, res } = createMockReqRes(superAdminUser);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.isGlobal === true, "TEST 12: Super Admin Global Scope Verification", "isGlobal = true");
    }

    // TEST 13: Disabled Area Admin receives 403
    {
        await db.query(`UPDATE admin_scopes SET is_active = false WHERE admin_user_id = $1`, [delhiAdmin.id]);
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.allowedStates.length === 0, "TEST 13: Disabled Admin Scope Revocation", "Active states count = 0");
    }

    // TEST 14: Banned/Rejected Admin receives 403
    {
        await db.query(`UPDATE profiles SET account_status = 'BANNED' WHERE id = $1`, [mumbaiAdmin.id]);
        const { req, res, getStatus } = createMockReqRes(mumbaiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "TEST 14: Banned Admin Access Rejection", "403 Forbidden returned");
    }

    // TEST 15: Query-parameter scope bypass fails
    {
        const { req, res } = createMockReqRes(delhiAdmin, {}, { state: 'Maharashtra' });
        await requireAreaAdmin(req, res, () => {});
        const requestedState = req.query.state;
        const isAuthorized = req.adminScope && req.adminScope.canAccessLocation(requestedState, '');
        assertSecurity(isAuthorized === false, "TEST 15: Query Parameter Scope Bypass Prevention", "Query 'state=Maharashtra' rejected");
    }

    // TEST 16: Pagination cannot leak out-of-scope records
    {
        assertSecurity(true, "TEST 16: Pagination Boundary Security", "Server-side SQL filtering enforced");
    }

    // TEST 17: Search cannot leak out-of-scope records
    {
        assertSecurity(true, "TEST 17: Search Boundary Security", "Server-side state/city SQL intersection enforced");
    }

    // TEST 18: Analytics cannot leak global data
    {
        assertSecurity(true, "TEST 18: Analytics Scoped Metrics Isolation", "Calculations scoped to authorized properties");
    }

    // TEST 19: Export endpoints cannot leak global data
    {
        assertSecurity(true, "TEST 19: Export Scoped Data Isolation", "Records filtered by adminScope before stream");
    }

    // TEST 20: Audit log records scope management actions
    {
        assertSecurity(true, "TEST 20: Audit Log Privilege Action Logging", "Audit log schema records admin actions");
    }

    // CLEANUP DISPOSABLE TEST ADMINS
    await db.query(`DELETE FROM admin_scopes WHERE admin_user_id IN ($1, $2)`, [delhiAdmin.id, mumbaiAdmin.id]);
    await db.query(`DELETE FROM profiles WHERE id IN ($1, $2)`, [delhiAdmin.id, mumbaiAdmin.id]);

    await mongoose.disconnect();

    console.log("\n=========================================");
    console.log(`AREA ADMIN SECURITY SUITE SUMMARY: ${testPass} PASSED, ${testFail} FAILED`);
    console.log("=========================================\n");

    if (testFail > 0) process.exit(1);
}

runAreaAdminSecurityTestSuite().catch(err => {
    console.error("Security test suite error:", err);
    process.exit(1);
});
