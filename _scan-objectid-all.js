const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "backend");
const results = [];

function walk(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const full = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            if (entry.name === "node_modules" || entry.name === "uploads") continue;
            walk(full);
        } else if (entry.name.endsWith(".js")) {
            results.push(full);
        }
    }
}
walk(root);

console.log("=== Mongoose ObjectId usage audit (whole backend) ===\n");
let total = 0;
let withoutNew = 0;
let staticCalls = 0;

for (const file of results) {
    const src = fs.readFileSync(file, "utf8");
    const lines = src.split("\n");
    lines.forEach((line, i) => {
        const num = i + 1;
        // Match mongoose.Types.ObjectId( or Types.ObjectId(
        const calls = line.match(/mongoose\.Types\.ObjectId\s*\(/g);
        if (calls) {
            total += calls.length;
            const trimmed = line.trim();
            const nonNew = new RegExp("(?!new\\s+)mongoose\\.Types\\.ObjectId\\s*\\(").test(trimmed);
            if (!/new\s+mongoose\.Types\.ObjectId/.test(trimmed)) {
                withoutNew++;
                console.log(`⚠️  WITHOUT 'new'  ${path.relative(__dirname, file)}:${num}  ${trimmed}`);
            } else {
                console.log(`✅ with 'new'      ${path.relative(__dirname, file)}:${num}  ${trimmed}`);
            }
        }
        // Static isValid calls (fine)
        if (/mongoose\.Types\.ObjectId\.isValid\s*\(/.test(line)) {
            staticCalls++;
        }
    });
}

console.log("\n=== SUMMARY ===");
console.log("Total mongoose.Types.ObjectId( constructor usages:", total);
console.log("  - with 'new':", total - withoutNew);
console.log("  - WITHOUT 'new' (BUG):", withoutNew);
console.log("Static .isValid() usages (correct, no 'new' needed):", staticCalls);
