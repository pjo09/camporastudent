const dbConfig = require('../config/database');
const mongoStatisticsAdapter = require('../database/mongodb/statisticsAdapter');
const supabaseStatisticsAdapter = require('../database/supabase/statisticsAdapter');

async function getPublicStatistics() {
    if (dbConfig.isSupabase()) {
        return await supabaseStatisticsAdapter.getPublicStatistics();
    }
    return await mongoStatisticsAdapter.getPublicStatistics();
}

module.exports = {
    getPublicStatistics
};
