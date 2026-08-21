const dbConfig = require('../config/database');
const mongoPropertyAdapter = require('../database/mongodb/propertyAdapter');
const supabasePropertyAdapter = require('../database/supabase/propertyAdapter');
const { executeShadowRead } = require('../services/shadowReadService');

function comparePropertyFields(mongoProp, supabaseProp) {
    const mismatches = [];

    if (!mongoProp && !supabaseProp) return mismatches;

    if (mongoProp && !supabaseProp) {
        mismatches.push({ field: 'existence', mongoValue: 'EXISTS', supabaseValue: 'MISSING', mongoId: mongoProp._id?.toString() });
        return mismatches;
    }

    if (!mongoProp && supabaseProp) {
        mismatches.push({ field: 'existence', mongoValue: 'MISSING', supabaseValue: 'EXISTS', mongoId: supabaseProp.id });
        return mismatches;
    }

    const mId = mongoProp._id ? mongoProp._id.toString() : 'N/A';

    // Property Name (supporting legacy title/name fallback resolution)
    const mName = (mongoProp.propertyName || mongoProp.title || mongoProp.name || '').trim();
    const sName = (supabaseProp.propertyName || supabaseProp.title || supabaseProp.name || '').trim();

    if (mName !== sName) {
        mismatches.push({ field: 'propertyName', mongoValue: mName, supabaseValue: sName, mongoId: mId, severity: 'HIGH' });
    }

    // Available Beds & Total Beds Inventory Preservation
    const mTotal = mongoProp.totalBeds || 0;
    const sTotal = supabaseProp.totalBeds || 0;
    if (mTotal !== sTotal) {
        mismatches.push({ field: 'totalBeds', mongoValue: mTotal, supabaseValue: sTotal, mongoId: mId, severity: 'CRITICAL' });
    }

    const mAvail = mongoProp.availableBeds || 0;
    const sAvail = supabaseProp.availableBeds || 0;
    if (mAvail !== sAvail) {
        mismatches.push({ field: 'availableBeds', mongoValue: mAvail, supabaseValue: sAvail, mongoId: mId, severity: 'CRITICAL' });
    }

    // Rent
    if (parseFloat(mongoProp.rent || mongoProp.price || 0) !== parseFloat(supabaseProp.rent || 0)) {
        mismatches.push({ field: 'rent', mongoValue: mongoProp.rent || mongoProp.price, supabaseValue: supabaseProp.rent, mongoId: mId, severity: 'HIGH' });
    }

    return mismatches;
}

async function findPropertyById(id) {
    return await executeShadowRead({
        domain: 'properties',
        operation: 'findPropertyById',
        mongoRead: async () => await mongoPropertyAdapter.findPropertyById(id),
        supabaseRead: async () => await supabasePropertyAdapter.findPropertyById(id),
        compareFields: comparePropertyFields
    });
}

async function listProperties(filter = {}) {
    return await executeShadowRead({
        domain: 'properties',
        operation: 'listProperties',
        mongoRead: async () => await mongoPropertyAdapter.listProperties(filter),
        supabaseRead: async () => await supabasePropertyAdapter.listProperties(filter),
        compareFields: (mList, sList) => {
            const mismatches = [];
            if ((mList || []).length !== (sList || []).length) {
                mismatches.push({ field: 'listCount', mongoValue: (mList || []).length, supabaseValue: (sList || []).length, severity: 'HIGH' });
            }
            return mismatches;
        }
    });
}

async function searchProperties(options = {}) {
    if (dbConfig.isSupabase()) {
        return await supabasePropertyAdapter.searchProperties(options);
    }
    return await mongoPropertyAdapter.searchProperties(options);
}

module.exports = {
    findPropertyById,
    listProperties,
    searchProperties
};
