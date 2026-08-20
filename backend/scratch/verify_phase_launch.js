const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { getSupabaseClient } = require('../config/supabase');

async function verifySupabaseDatabase() {
    console.log("\n=========================================");
    console.log("CAMPORA FINAL PRODUCTION VERIFICATION");
    console.log("=========================================\n");

    const dbPg = await getSupabaseClient();

    // 1. Verify all 29 PostgreSQL tables exist
    const tablesRes = await dbPg.query(`
        SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'
    `);
    const tableNames = tablesRes.rows.map(r => r.table_name);
    console.log(`1. SUPABASE TABLES FOUND (${tableNames.length}/29):`);
    console.log(tableNames.join(', '));

    // 2. Document Row Counts for Key Tables
    const countTable = async (t) => {
        try {
            const res = await dbPg.query(`SELECT COUNT(*) as cnt FROM ${t}`);
            return parseInt(res.rows[0].cnt, 10);
        } catch (e) {
            return -1;
        }
    };

    console.log("\n2. TABLE RECORD COUNTS:");
    const counts = {
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

    for (const [k, v] of Object.entries(counts)) {
        console.log(` - ${k}: ${v}`);
    }

    // 3. PHASE 4: Foreign Key & Data Integrity Audit (16 Integrity Checks)
    console.log("\n3. FOREIGN KEY & RELATIONAL INTEGRITY CHECK:");

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
        if (orphanCount > 0) {
            console.error(`❌ Orphan FK found in ${fk.table}.${fk.col} -> ${fk.refTable}: ${orphanCount}`);
        } else {
            console.log(`  ✅ ${fk.table}.${fk.col} -> ${fk.refTable}: 0 Orphans`);
        }
    }

    console.log(`\nFOREIGN KEY AUDIT RESULT: ${totalOrphans === 0 ? '✅ 0 ORPHANS (PASS)' : '❌ ORPHANS FOUND'}`);
}

verifySupabaseDatabase().catch(err => {
    console.error("Verification error:", err);
    process.exit(1);
});
