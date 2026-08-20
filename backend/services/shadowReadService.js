const fs = require('fs');
const path = require('path');
const shadowConfig = require('../config/shadowReadConfig');
const dbConfig = require('../config/database');

const mismatchesLogPath = path.join(__dirname, '../../supabase/migration-reports/shadow-read-mismatches.json');

const shadowMetrics = {
    totalReads: 0,
    totalMatches: 0,
    totalMismatches: 0,
    totalErrors: 0,
    byDomain: {}
};

function getDomainMetrics(domain) {
    if (!shadowMetrics.byDomain[domain]) {
        shadowMetrics.byDomain[domain] = { reads: 0, matches: 0, mismatches: 0, errors: 0 };
    }
    return shadowMetrics.byDomain[domain];
}

function logMismatch(mismatchEntry) {
    let existingLogs = [];
    try {
        if (fs.existsSync(mismatchesLogPath)) {
            existingLogs = JSON.parse(fs.readFileSync(mismatchesLogPath, 'utf8'));
        }
    } catch (e) {
        existingLogs = [];
    }

    // Filter out any potential secrets before logging
    const safeEntry = { ...mismatchEntry };
    if (safeEntry.mongoValue && safeEntry.mongoValue.password) delete safeEntry.mongoValue.password;
    if (safeEntry.supabaseValue && safeEntry.supabaseValue.password) delete safeEntry.supabaseValue.password;

    existingLogs.push(safeEntry);

    const dir = path.dirname(mismatchesLogPath);
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(mismatchesLogPath, JSON.stringify(existingLogs, null, 2), 'utf8');
}

async function executeShadowRead({ domain, operation, mongoRead, supabaseRead, compareFields }) {
    // In Supabase production mode, Supabase PostgreSQL is authoritative. Skip Mongo reads.
    if (dbConfig.isSupabase()) {
        return await supabaseRead();
    }

    // 1. ALWAYS execute MongoDB read (Authoritative Production Result in Mongo mode)
    const authoritativeResult = await mongoRead();

    // 2. Check if Shadow Reads are enabled for this domain
    if (!shadowConfig.isEnabledForDomain(domain)) {
        return authoritativeResult;
    }

    shadowMetrics.totalReads++;
    const domainStats = getDomainMetrics(domain);
    domainStats.reads++;

    // 3. Execute Supabase Shadow Read inside safe Exception Guard
    let shadowResult = null;
    let shadowError = null;

    try {
        shadowResult = await supabaseRead();
    } catch (err) {
        shadowError = err.message;
        shadowMetrics.totalErrors++;
        domainStats.errors++;
        console.warn(`[SHADOW_READ_ERROR] Domain: ${domain}, Operation: ${operation} - ${err.message}`);
        // NEVER BLOCK PRODUCTION ON SUPABASE ERROR
        return authoritativeResult;
    }

    // 4. Compare Normalized Results
    try {
        const mismatches = compareFields(authoritativeResult, shadowResult);

        if (mismatches.length === 0) {
            shadowMetrics.totalMatches++;
            domainStats.matches++;
        } else {
            shadowMetrics.totalMismatches++;
            domainStats.mismatches++;

            for (const m of mismatches) {
                logMismatch({
                    timestamp: new Date().toISOString(),
                    domain,
                    operation,
                    mongoId: m.mongoId || 'N/A',
                    field: m.field,
                    mongoValue: m.mongoValue,
                    supabaseValue: m.supabaseValue,
                    severity: m.severity || 'WARNING'
                });
            }
        }
    } catch (cmpErr) {
        shadowMetrics.totalErrors++;
        domainStats.errors++;
        console.warn(`[SHADOW_COMPARE_ERROR] Domain: ${domain}, Operation: ${operation} - ${cmpErr.message}`);
    }

    // 5. Always return Authoritative MongoDB Result
    return authoritativeResult;
}

function getShadowMetrics() {
    return shadowMetrics;
}

function resetShadowMetrics() {
    shadowMetrics.totalReads = 0;
    shadowMetrics.totalMatches = 0;
    shadowMetrics.totalMismatches = 0;
    shadowMetrics.totalErrors = 0;
    shadowMetrics.byDomain = {};
}

module.exports = {
    executeShadowRead,
    getShadowMetrics,
    resetShadowMetrics
};
