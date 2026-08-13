// =====================================================
// CAMPORA Owner ↔ Student Communication Test Suite Wrapper
// =====================================================

const { spawn } = require("child_process");
const path = require("path");

console.log("Delegating test execution to backend directory for node_modules resolution...");

const child = spawn("node", ["test-communication.js"], {
    stdio: "inherit",
    cwd: path.join(__dirname, "../backend"),
    shell: true
});

child.on("exit", (code) => {
    process.exit(code);
});
