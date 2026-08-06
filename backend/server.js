// ===============================================
// CAMPORA BACKEND SERVER
// ===============================================

const app = require("./app");

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log("");
    console.log("====================================");
    console.log("🚀 CAMPORA BACKEND RUNNING");
    console.log(`🌐 http://localhost:${PORT}`);
    console.log(`❤️ Health : http://localhost:${PORT}/api/health`);
    console.log("====================================");
});