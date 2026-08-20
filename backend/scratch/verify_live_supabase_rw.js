const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { getSupabaseClient } = require('../config/supabase');

async function runLiveSupabaseVerification() {
    console.log("\n=========================================");
    console.log("CAMPORA LIVE SUPABASE READ/WRITE VERIFICATION");
    console.log("=========================================\n");

    const dbPg = await getSupabaseClient();
    let testPass = true;

    // 1. Verify 29/29 PostgreSQL Tables
    const tablesRes = await dbPg.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`1. SUPABASE TABLES ACCESSIBLE (${tableNames.length}/29 tables):`);
    console.log(tableNames.join(', '));

    if (tableNames.length < 29) {
        console.error(`❌ Expected 29 tables, found ${tableNames.length}`);
        testPass = false;
    } else {
        console.log("  ✅ 29/29 Tables Verified (PASS)");
    }

    // 2. Safe Data READ Verification
    console.log("\n2. SAFE DATA READ VERIFICATION:");
    const countTable = async (t) => {
        try {
            const res = await dbPg.query(`SELECT COUNT(*) as cnt FROM ${t}`);
            return parseInt(res.rows[0].cnt, 10);
        } catch (e) {
            return -1;
        }
    };

    const readCounts = {
        profiles: await countTable('profiles'),
        properties: await countTable('properties'),
        bookings: await countTable('bookings'),
        reviews: await countTable('reviews'),
        conversations: await countTable('conversations'),
        messages: await countTable('messages'),
        notifications: await countTable('notifications'),
        audit_logs: await countTable('audit_logs'),
        contacts: await countTable('contacts'),
        property_invites: await countTable('property_invites'),
        tenancies: await countTable('tenancies'),
        resident_requests: await countTable('resident_requests'),
        platform_settings: await countTable('platform_settings')
    };

    for (const [k, v] of Object.entries(readCounts)) {
        console.log(`  - ${k}: ${v} records`);
    }

    // 3. Relational Foreign Key Integrity Check
    console.log("\n3. FOREIGN KEY INTEGRITY CHECK:");
    const checkFK = async (table, col, refTable, refCol = 'id') => {
        const res = await dbPg.query(`
            SELECT COUNT(*) as cnt FROM ${table} t
            WHERE t.${col} IS NOT NULL
              AND NOT EXISTS (SELECT 1 FROM ${refTable} r WHERE r.${refCol} = t.${col})
        `);
        return parseInt(res.rows[0].cnt, 10);
    };

    const fkChecks = [
        { table: 'properties', col: 'owner_id', refTable: 'profiles' },
        { table: 'bookings', col: 'property_id', refTable: 'properties' },
        { table: 'bookings', col: 'user_id', refTable: 'profiles' },
        { table: 'bookings', col: 'owner_id', refTable: 'profiles' },
        { table: 'reviews', col: 'property_id', refTable: 'properties' },
        { table: 'reviews', col: 'user_id', refTable: 'profiles' },
        { table: 'conversations', col: 'owner_id', refTable: 'profiles' },
        { table: 'conversations', col: 'student_id', refTable: 'profiles' },
        { table: 'messages', col: 'conversation_id', refTable: 'conversations' },
        { table: 'messages', col: 'sender_id', refTable: 'profiles' },
        { table: 'tenancies', col: 'student_id', refTable: 'profiles' },
        { table: 'tenancies', col: 'property_id', refTable: 'properties' },
        { table: 'resident_requests', col: 'student_id', refTable: 'profiles' },
        { table: 'resident_requests', col: 'property_id', refTable: 'properties' },
        { table: 'notifications', col: 'receiver_id', refTable: 'profiles' },
        { table: 'property_invites', col: 'property_id', refTable: 'properties' }
    ];

    let totalOrphans = 0;
    for (const fk of fkChecks) {
        const orphanCount = await checkFK(fk.table, fk.col, fk.refTable);
        totalOrphans += orphanCount;
    }

    if (totalOrphans === 0) {
        console.log("  ✅ Relational Integrity: 0 ORPHANS (PASS)");
    } else {
        console.error(`  ❌ Relational Integrity: ${totalOrphans} ORPHANS FOUND`);
        testPass = false;
    }

    // 4. Safe Transaction-Safe Write -> Read-Back -> Delete Test
    console.log("\n4. SAFE TRANSACTION WRITE -> READ -> DELETE TEST:");
    const testMarker = `DISPOSABLE_VERIFICATION_${Date.now()}`;
    const testDetailsJson = JSON.stringify({ marker: testMarker, note: "Disposable test record" });

    // Step A: BEGIN TRANSACTION & INSERT
    await dbPg.query("BEGIN");
    const insertRes = await dbPg.query(`
        INSERT INTO audit_logs (action, resource, role, details)
        VALUES ('ADMIN_LOGIN', $1, 'system', $2)
        RETURNING id, resource
    `, [testMarker, testDetailsJson]);

    const insertedId = insertRes.rows[0]?.id;
    console.log(`  - INSERT step: Created test record id=${insertedId}`);

    // Step B: READ-BACK
    const readBackRes = await dbPg.query(`
        SELECT * FROM audit_logs WHERE id = $1
    `, [insertedId]);

    const readBackResource = readBackRes.rows[0]?.resource;
    const writeReadMatch = readBackResource === testMarker;
    console.log(`  - READ-BACK step: Retrieved resource='${readBackResource}' (Match=${writeReadMatch})`);

    // Step C: DELETE
    await dbPg.query(`
        DELETE FROM audit_logs WHERE id = $1
    `, [insertedId]);

    await dbPg.query("COMMIT");
    console.log("  - DELETE step: Cleaned up test record");

    // Step D: CONFIRM FINAL COUNT = 0
    const finalCheckRes = await dbPg.query(`
        SELECT COUNT(*) as cnt FROM audit_logs WHERE id = $1
    `, [insertedId]);
    const finalCount = parseInt(finalCheckRes.rows[0].cnt, 10);
    console.log(`  - FINAL CHECK step: Remaining test records = ${finalCount}`);

    if (writeReadMatch && finalCount === 0) {
        console.log("  ✅ Transaction Write -> Read -> Delete Test: PASS");
    } else {
        console.error("  ❌ Transaction Write -> Read -> Delete Test: FAIL");
        testPass = false;
    }

    console.log("\n=========================================");
    console.log(`VERIFICATION RESULT: ${testPass ? '✅ ALL CHECKS PASSED' : '❌ CHECKS FAILED'}`);
    console.log("=========================================\n");

    if (!testPass) process.exit(1);
}

runLiveSupabaseVerification().catch(err => {
    console.error("Verification script error:", err);
    process.exit(1);
});
