const fs = require('fs');
const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { getSupabaseClient } = require('../config/supabase');

async function investigateMismatch() {
    console.log("\n=========================================");
    console.log("CAMPORA PHASE 5.5 — PROPERTY MISMATCH INVESTIGATION");
    console.log("=========================================\n");

    const targetId = '6a42881131898d22a9519805';

    // 1. Inspect MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    const dbMongo = mongoose.connection.db;

    const mongoDoc = await dbMongo.collection('properties').findOne({ _id: new mongoose.Types.ObjectId(targetId) });
    console.log("1. MONGODB DOCUMENT FOR", targetId, ":");
    console.log(JSON.stringify(mongoDoc, null, 2));

    // 2. Inspect Supabase
    const dbPg = await getSupabaseClient();
    const pgRes = await dbPg.query(`SELECT * FROM properties WHERE mongo_id = $1`, [targetId]);
    console.log("\n2. SUPABASE POSTGRESQL RECORD FOR", targetId, ":");
    console.log(JSON.stringify(pgRes.rows[0], null, 2));

    // 3. Inspect All 12 Properties in MongoDB & Supabase
    console.log("\n3. AUDITING ALL 12 PROPERTIES:");
    const allMongoProps = await dbMongo.collection('properties').find({}).toArray();
    const allPgPropsRes = await dbPg.query(`SELECT * FROM properties`);
    const allPgProps = allPgPropsRes.rows;

    const pgMap = new Map();
    for (const p of allPgProps) {
        if (p.mongo_id) pgMap.set(p.mongo_id, p);
    }

    let missingNameCount = 0;
    let nameMappingDiffCount = 0;
    let noIssueCount = 0;

    for (const mProp of allMongoProps) {
        const mId = mProp._id.toString();
        const pProp = pgMap.get(mId);

        const mName = mProp.propertyName;
        const pName = pProp ? pProp.property_name : null;

        const hasMissingNameInMongo = mName === undefined || mName === null || mName === '';
        if (hasMissingNameInMongo) missingNameCount++;

        const isDiff = (mName || '').trim() !== (pName || '').trim();
        if (isDiff) {
            nameMappingDiffCount++;
            console.log(` - Diff found on property ${mId}: Mongo propertyName='${mName}', Supabase property_name='${pName}'`);
        } else {
            noIssueCount++;
        }
    }

    console.log(`\nAUDIT SUMMARY FOR ALL 12 PROPERTIES:`);
    console.log(`- Total Properties: ${allMongoProps.length}`);
    console.log(`- Properties with missing name field in MongoDB: ${missingNameCount}`);
    console.log(`- Properties with name mapping differences: ${nameMappingDiffCount}`);
    console.log(`- Properties with no issue: ${noIssueCount}`);

    await mongoose.disconnect();
}

investigateMismatch().catch(err => {
    console.error("Investigation Error:", err);
    process.exit(1);
});
