const fs = require("fs");
const path = require("path");

const cssPath = path.join(__dirname, "frontend", "css", "student-v3.css");
const css = fs.readFileSync(cssPath, "utf8");

console.log("=== RESPONSIVE MEDIA QUERIES in student-v3.css ===");
const mediaRe = /@media[^{]+\{/g;
let m;
while ((m = mediaRe.exec(css))) {
    console.log(" -", m[0].trim());
}

console.log("\n=== GRID / FLEX / OVERFLOW checks ===");
["sv3-property-grid", "sv3-stats-grid", "sv3-main", "grid-template-columns", "overflow-x", "min-width", "max-width"].forEach((word) => {
    const count = (css.match(new RegExp(word, "g")) || []).length;
    console.log(` ${word}: ${count} occurrence(s)`);
});

console.log("\n=== Check for overflow-x hidden on body/html ===");
const bodyRule = css.match(/html\s*\{[^}]*\}/);
const mainRule = css.match(/\.sv3-main\s*\{[^}]*\}/);
console.log("html rule:", bodyRule ? bodyRule[0].slice(0, 200) : "none found");
console.log(".sv3-main rule:", mainRule ? mainRule[0].slice(0, 200) : "none found");

// Asset path check
console.log("\n=== Frontend JS asset references (relative to pages/student/) ===");
const feDir = path.join(__dirname, "frontend", "js");
const files = ["student-dashboard.js", "student-utils.js", "student-saved.js", "student-bookings.js"];
for (const f of files) {
    const p = path.join(feDir, f);
    if (!fs.existsSync(p)) continue;
    const src = fs.readFileSync(p, "utf8");
    const refs = src.match(/["'`]\.?\/?(?:assets|images|css|js)\/[^"'`]+\.(?:png|jpg|svg|js|css)[^"'`]*["'`]/g) || [];
    console.log(`\n${f}:`);
    refs.forEach((r) => console.log("   ", r));
}
