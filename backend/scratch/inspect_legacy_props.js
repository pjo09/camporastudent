const fs = require('fs');
const path = require('path');
const { configureDnsResolvers } = require('../config/dns');
configureDnsResolvers();

const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config({ path: path.join(__dirname, '../../.env') });

const { getSupabaseClient } = require('../config/supabase');

async function inspectLegacyProps() {
    await mongoose.connect(process.env.MONGO_URI);
    const dbMongo = mongoose.connection.db;

    const ids = ['6a42881131898d22a9519805', '6a42881131898d22a9519806'];

    console.log("=== INSPECTING LEGACY PROPERTY RECORDS ===");

    for (const id of ids) {
        const mDoc = await dbMongo.collection('properties').findOne({ _id: new mongoose.Types.ObjectId(id) });
        console.log(`\nMongoDB Document (${id}):`);
        console.log(` - propertyName:`, mDoc ? mDoc.propertyName : 'N/A');
        console.log(` - title:`, mDoc ? mDoc.title : 'N/A');
        console.log(` - name:`, mDoc ? mDoc.name : 'N/A');
        console.log(` - Full Document:`, JSON.stringify(mDoc, null, 2));
    }

    const dbPg = await getSupabaseClient();
    for (const id of ids) {
        const res = await dbPg.query(`SELECT id, mongo_id, property_name, available_beds, total_beds FROM properties WHERE mongo_id = $1`, [id]);
        console.log(`\nCurrent Supabase Record (${id}):`);
        console.log(JSON.stringify(res.rows[0], null, 2));
    }

    await mongoose.disconnect();
}

inspectLegacyProps().catch(err => {
    console.error("Inspection error:", err);
    process.exit(1);
});
