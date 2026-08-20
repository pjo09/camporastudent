const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { getSupabaseClient } = require('../config/supabase');

async function fixSupabasePropertyNames() {
    console.log("\n=========================================");
    console.log("CAMPORA PHASE 5.5 — SUPABASE PROPERTY DATA CORRECTION");
    console.log("=========================================\n");

    // Connect MongoDB in READ-ONLY mode
    await mongoose.connect(process.env.MONGO_URI);
    const dbMongo = mongoose.connection.db;

    const dbPg = await getSupabaseClient();

    const targets = [
        { mongoId: '6a42881131898d22a9519805' },
        { mongoId: '6a42881131898d22a9519806' }
    ];

    console.log("--- TASK 3: SAFETY CHECKS BEFORE UPDATE ---");

    for (const t of targets) {
        const mDoc = await dbMongo.collection('properties').findOne({ _id: new mongoose.Types.ObjectId(t.mongoId) });
        t.verifiedMongoName = mDoc.propertyName || mDoc.title || mDoc.name || 'Property';

        const pgBefore = (await dbPg.query(`SELECT * FROM properties WHERE mongo_id = $1`, [t.mongoId])).rows[0];
        t.pgBefore = pgBefore;

        console.log(`\nTARGET MONGO_ID: ${t.mongoId}`);
        console.log(` - MongoDB Source Legacy Title: "${mDoc.title || mDoc.propertyName}"`);
        console.log(` - Verified Intended Property Name: "${t.verifiedMongoName}"`);
        console.log(` - Old Supabase property_name: "${pgBefore.property_name}"`);
        console.log(` - Supabase Owner ID: ${pgBefore.owner_id}`);
        console.log(` - Supabase Inventory (available/total): ${pgBefore.available_beds}/${pgBefore.total_beds}`);
    }

    console.log("\n--- TASK 2: EXECUTING SUPABASE UPDATE ---");

    for (const t of targets) {
        await dbPg.query(
            `UPDATE properties SET property_name = $1, updated_at = NOW() WHERE mongo_id = $2`,
            [t.verifiedMongoName, t.mongoId]
        );
        console.log(`✅ Updated Supabase property_name for mongo_id=${t.mongoId} to "${t.verifiedMongoName}"`);
    }

    console.log("\n--- TASK 3: VERIFICATION AFTER UPDATE ---");

    for (const t of targets) {
        const pgAfter = (await dbPg.query(`SELECT * FROM properties WHERE mongo_id = $1`, [t.mongoId])).rows[0];
        
        const nameChanged = pgAfter.property_name === t.verifiedMongoName;
        const mongoIdUnchanged = pgAfter.mongo_id === t.mongoId;
        const ownerUnchanged = pgAfter.owner_id === t.pgBefore.owner_id;
        const inventoryUnchanged = pgAfter.available_beds === t.pgBefore.available_beds && pgAfter.total_beds === t.pgBefore.total_beds;

        console.log(`\nVERIFICATION FOR MONGO_ID ${t.mongoId}:`);
        console.log(` - New property_name: "${pgAfter.property_name}" -> ${nameChanged ? '✅ CORRECT' : '❌ MISMATCH'}`);
        console.log(` - mongo_id: ${pgAfter.mongo_id} -> ${mongoIdUnchanged ? '✅ UNCHANGED' : '❌ CHANGED'}`);
        console.log(` - owner_id: ${pgAfter.owner_id} -> ${ownerUnchanged ? '✅ UNCHANGED' : '❌ CHANGED'}`);
        console.log(` - inventory (beds): ${pgAfter.available_beds}/${pgAfter.total_beds} -> ${inventoryUnchanged ? '✅ UNCHANGED' : '❌ CHANGED'}`);
    }

    await mongoose.disconnect();
    console.log("\n=========================================");
    console.log("SUPABASE PROPERTY CORRECTION COMPLETED");
    console.log("=========================================\n");
}

fixSupabasePropertyNames().catch(err => {
    console.error("Correction error:", err);
    process.exit(1);
});
