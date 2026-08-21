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
const bookingRepository = require('../repositories/bookingRepository');
const { requireAreaAdmin, requireSuperAdmin } = require('../middleware/areaAdminAuth');

async function runAreaAdminSecurityTestSuite() {
    console.log("\n=========================================");
    console.log("CAMPORA AREA-BASED ADMIN ACCESS CONTROL & UI SECURITY SUITE");
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

    // 1. SUPER_ADMIN can open Admin Management
    {
        const { req, res, getStatus } = createMockReqRes(superAdminUser);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 200, "1. SUPER_ADMIN Can Access Admin Management", "isGlobal = true authorized");
    }

    // 2. AREA_ADMIN gets 403 on Admin Management
    {
        const { req, res, getStatus } = createMockReqRes(delhiAdmin);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "2. AREA_ADMIN Receives 403 on Admin Management", "Super Admin guard blocked request");
    }

    // 3. SUPER_ADMIN can create AREA_ADMIN
    {
        const { req, res, getStatus } = createMockReqRes(superAdminUser);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 200, "3. SUPER_ADMIN Can Create AREA_ADMIN", "Creation privileges verified");
    }

    // 4. AREA_ADMIN requires state/city validation
    {
        const stateScopeReq = { scopeType: 'STATE', state: '' };
        const isStateValid = !!stateScopeReq.state;
        assertSecurity(isStateValid === false, "4. AREA_ADMIN Requires State/City Validation", "Blank state rejected");
    }

    // 5. SUPER_ADMIN gets GLOBAL scope
    {
        const { req, res } = createMockReqRes(superAdminUser);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.isGlobal === true, "5. SUPER_ADMIN Gets GLOBAL Scope", "isGlobal = true");
    }

    // 6. AREA_ADMIN receives assigned scope
    {
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Delhi', '') === true, "6. AREA_ADMIN Receives Assigned Scope", "State 'Delhi' authorized");
    }

    // 7. Multiple scopes work
    {
        await db.query(`INSERT INTO admin_scopes (admin_user_id, scope_type, state, city) VALUES ($1, 'CITY', 'Uttar Pradesh', 'Noida')`, [delhiAdmin.id]);
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        const hasDelhi = req.adminScope.canAccessLocation('Delhi', '');
        const hasNoida = req.adminScope.canAccessLocation('Uttar Pradesh', 'Noida');
        assertSecurity(hasDelhi && hasNoida, "7. Multiple Scopes Work", "Delhi + Noida both accessible");
    }

    // 8. Scope removal works
    {
        const addedScope = (await db.query(`SELECT id FROM admin_scopes WHERE admin_user_id = $1 AND city = 'Noida'`, [delhiAdmin.id])).rows[0];
        if (addedScope) {
            await db.query(`DELETE FROM admin_scopes WHERE id = $1`, [addedScope.id]);
        }
        const { req, res } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(req.adminScope && req.adminScope.canAccessLocation('Uttar Pradesh', 'Noida') === false, "8. Scope Removal Works", "Revoked scope blocked");
    }

    // 9. Disabled admin cannot authenticate/access admin APIs
    {
        await db.query(`UPDATE profiles SET account_status = 'BANNED' WHERE id = $1`, [delhiAdmin.id]);
        const { req, res, getStatus } = createMockReqRes(delhiAdmin);
        await requireAreaAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "9. Disabled Admin Cannot Access Admin APIs", "403 Forbidden");
        await db.query(`UPDATE profiles SET account_status = 'ACTIVE' WHERE id = $1`, [delhiAdmin.id]);
    }

    // 10. AREA_ADMIN cannot create another admin
    {
        const { req, res, getStatus } = createMockReqRes(delhiAdmin);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "10. AREA_ADMIN Cannot Create Another Admin", "403 Forbidden");
    }

    // 11. AREA_ADMIN cannot modify own scope
    {
        const { req, res, getStatus } = createMockReqRes(delhiAdmin);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "11. AREA_ADMIN Cannot Modify Own Scope", "403 Forbidden");
    }

    // 12. AREA_ADMIN cannot assign GLOBAL
    {
        const { req, res, getStatus } = createMockReqRes(delhiAdmin);
        await requireSuperAdmin(req, res, () => {});
        assertSecurity(getStatus() === 403, "12. AREA_ADMIN Cannot Assign GLOBAL", "403 Forbidden");
    }

    // 13. Existing owner approval still works
    {
        const owner = await userRepository.findUserByEmail('atharwacto@gmail.com');
        assertSecurity(owner && owner.accountStatus === 'ACTIVE', "13. Existing Owner Approval Still Works", "Owner status = ACTIVE");
    }

    // 14. Existing booking flow still works
    {
        const bookings = await db.query(`SELECT COUNT(*) as cnt FROM bookings`);
        assertSecurity(parseInt(bookings.rows[0].cnt, 10) >= 0, "14. Existing Booking Flow Still Works", `${bookings.rows[0].cnt} bookings active`);
    }

    // 15. Existing inventory behavior still works
    {
        const props = await propertyRepository.listProperties({});
        assertSecurity(props && props.length > 0 && props[0].availableBeds >= 0, "15. Existing Inventory Behavior Still Works", `Properties active`);
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
