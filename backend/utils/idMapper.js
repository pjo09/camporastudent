const fs = require('fs');
const path = require('path');

const mappingsPath = path.join(__dirname, '../../supabase/migration-reports/id_mappings.json');

let mongoToPgMap = new Map();
let pgToMongoMap = new Map();

function loadIdMappings() {
    try {
        if (fs.existsSync(mappingsPath)) {
            const raw = JSON.parse(fs.readFileSync(mappingsPath, 'utf8'));
            mongoToPgMap = new Map(Object.entries(raw));
            pgToMongoMap = new Map(Object.entries(raw).map(([mId, pId]) => [pId, mId]));
        }
    } catch (err) {
        console.warn("ID Mappings file load warning:", err.message);
    }
}

loadIdMappings();

function mongoIdToPostgresId(mongoId) {
    if (!mongoId) return null;
    const str = typeof mongoId === 'object' && mongoId.toString ? mongoId.toString() : String(mongoId);
    return mongoToPgMap.get(str) || null;
}

function postgresIdToMongoId(postgresId) {
    if (!postgresId) return null;
    return pgToMongoMap.get(String(postgresId)) || null;
}

module.exports = {
    mongoIdToPostgresId,
    postgresIdToMongoId,
    loadIdMappings
};
