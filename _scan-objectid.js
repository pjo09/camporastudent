// =============================================
// CAMPORA ObjectId SCANNER
// Finds all mongoose ObjectId invocations and
// flags ones called WITHOUT `new` (the bug).
// =============================================
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "backend");
const results = [];

const skipDirs = new Set(["node_modules", ".git", "uploads"]);

function walk(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name.startsWith(".")) continue;
    if (skipDirs.has(e.name)) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full);
    else if (e.name.endsWith(".js")) scanFile(full);
  }
}

function scanFile(file) {
  const src = fs.readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    // Match ObjectId( with optional mongoose.Types./Types. prefix
    const re = /(?:mongoose\.Types\.|Types\.)?ObjectId\s*\(/g;
    let m;
    while ((m = re.exec(line)) !== null) {
      const col = line.indexOf(m[0]);
      // Check if preceded by `new ` (word boundary)
      const before = line.slice(0, col);
      const hasNew = /\bnew\s*$/.test(before);
      results.push({
        file: path.relative(__dirname, file),
        line: i + 1,
        code: line.trim(),
        hasNew,
        col
      });
    }
  });
}

walk(root);

console.log("=== ObjectId invocations found in backend ===\n");
let flagged = 0;
for (const r of results) {
  const flag = r.hasNew ? "OK  " : "BUG ";
  if (!r.hasNew) flagged++;
  console.log(`${flag} ${r.file}:${r.line}  ${r.code}`);
}
console.log("\n============================================");
console.log(`TOTAL ObjectId calls: ${results.length}`);
console.log(`Calls WITHOUT 'new' (BUG candidates): ${flagged}`);
