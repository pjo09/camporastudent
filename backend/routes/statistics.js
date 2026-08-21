const express = require("express");
const router = express.Router();
const statisticsRepository = require("../repositories/statisticsRepository");

// =====================================================
// GET /api/statistics
// Public endpoint — returns aggregate database metrics.
// Provider-decoupled via statisticsRepository.
// =====================================================

router.get("/", async (req, res) => {
    try {
        const stats = await statisticsRepository.getPublicStatistics();

        return res.json({
            success: true,
            statistics: stats
        });
    } catch (err) {
        console.error("Statistics Error:", err);
        return res.status(500).json({
            success: false,
            message: err.message || "Failed to load statistics",
            statistics: {
                properties: 0,
                verifiedOwners: 0,
                students: 0,
                cities: 0,
                universities: 0,
                bookings: 0,
                reviews: 0
            }
        });
    }
});

module.exports = router;
