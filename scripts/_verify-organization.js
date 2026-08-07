#!/usr/bin/env node
// ============================================================
// CAMPORA ORGANIZATION VERIFIER
// Scans frontend/src/ and checks that all internal references
// resolve correctly within the organized tree.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "frontend", "src");

if (!fs.existsSync(SRC)) {
  console.error("❌ frontend/src/ does not exist. Run the reorganizer first.");
  process.exit(1);
}

const results = {
  scanned: 0,
  filesWithRefs: 0,
  totalRefs: 0,
  broken: [],
  allFiles: [],
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const allFiles = walk(SRC).map((f) => path.relative(SRC, f).split(path.sep).join("/"));
const fileSet = new Set(allFiles);
results.allFiles = allFiles;

function resolveRef(fromFile, ref) {
  const clean = ref.split("?")[0].split("#")[0];
  if (!clean) return null;
  if (/^https?:\/\//i.test(clean) || clean.startsWith("//") || clean.startsWith("data:") || clean.startsWith("mailto:") || clean.startsWith("tel:") || clean.startsWith("#")) {
    return null;
  }
  if (clean.startsWith("/")) {
    return clean.replace(/^\/+/, "");
  }
  const fromDir = path.posix.dirname(fromFile);
  const resolved = path.posix.normalize(path.posix.join(fromDir, clean));
  return resolved;
}

function scanFile(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(SRC, filePath).split(path.sep).join("/");
  const refs = [];

  // HTML: src="..." href="..."
  if (filePath.endsWith(".html")) {
    const attrRe = /(?:src|href)=["']([^"']+)["']/g;
    let m;
    while ((m = attrRe.exec(content))) refs.push(m[1]);
    const cssRe = /url\((['"]?)([^'")]+)\1\)/g;
    while ((m = cssRe.exec(content))) refs.push(m[2]);
  }

  // JS: import/from, location.href, string URLs
  if (filePath.endsWith(".js")) {
    const importRe = /from\s*["']([^"']+)["']/g;
    let m;
    while ((m = importRe.exec(content))) refs.push(m[1]);
    const dynRe = /import\(["']([^"']+)["']\)/g;
    while ((m = dynRe.exec(content))) refs.push(m[1]);
    const locRe = /location\.href\s*=\s*["']([^"']+)["']/g;
    while ((m = locRe.exec(content))) refs.push(m[1]);
    const strRe = /["']((?:\.{1,2}\/[^"']*\.(?:html|js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|otf)))["']/g;
    while ((m = strRe.exec(content))) refs.push(m[1]);
  }

  // CSS: url()
  if (filePath.endsWith(".css")) {
    const urlRe = /url\((['"]?)([^'")]+)\1\)/g;
    let m;
    while ((m = urlRe.exec(content))) refs.push(m[2]);
    const importRe = /@import\s+["']([^"']+)["']/g;
    while ((m = importRe.exec(content))) refs.push(m[1]);
  }

  results.scanned++;
  if (refs.length > 0) results.filesWithRefs++;
  results.totalRefs += refs.length;

  for (const ref of refs) {
    const resolved = resolveRef(rel, ref);
    if (!resolved) continue;
    if (!fileSet.has(resolved)) {
      results.broken.push({ from: rel, ref: resolved, original: ref });
    }
  }
}

// Scan all files
for (const f of allFiles) {
  scanFile(path.join(SRC, f));
}

// Print summary
console.log("=== CAMPORA ORGANIZATION VERIFICATION ===");
console.log(`Scanned files: ${results.scanned}`);
console.log(`Files with references: ${results.filesWithRefs}`);
console.log(`Total reference edges: ${results.totalRefs}`);
console.log(`Broken references: ${results.broken.length}`);

if (results.broken.length === 0) {
  console.log("\n✅ ALL REFERENCES VALID. The organized tree is self-consistent.");
} else {
  console.log("\n--- BROKEN REFERENCES ---");
  const grouped = {};
  for (const b of results.broken) {
    if (!grouped[b.ref]) grouped[b.ref] = [];
    grouped[b.ref].push(b.from);
  }
  for (const [ref, froms] of Object.entries(grouped)) {
    console.log(`  MISSING: ${ref}`);
    console.log(`    from: ${froms.slice(0, 3).join(", ")}${froms.length > 3 ? ` (+${froms.length - 3} more)` : ""}`);
  }

  // Check if they're broken because they reference files that exist in the original frontend/ but not in src/
  console.log("\n--- CHECKING IF REFS EXIST IN ORIGINAL frontend/ ---");
  const FE = path.join(ROOT, "frontend");
  for (const [ref] of Object.entries(grouped)) {
    const fePath = path.join(FE, ref);
    if (fs.existsSync(fePath)) {
      console.log(`  🔸 ${ref} exists in original frontend/ but not in src/`);
    } else {
      console.log(`  ❌ ${ref} truly missing (not even in original frontend/)`);
    }
  }
}

console.log("\n=== FILE COUNT BY DOMAIN FOLDER ===");
const counts = {};
for (const f of allFiles) {
  const parts = f.split("/");
  const root = parts[0]; // pages, js, css, images, assets, fonts
  if (!counts[root]) counts[root] = { total: 0, sub: {} };
  counts[root].total++;
  if (parts.length > 1) {
    const sub = parts[1];
    if (!counts[root].sub[sub]) counts[root].sub[sub] = 0;
    counts[root].sub[sub]++;
  }
}
for (const [root, data] of Object.entries(counts)) {
  console.log(`  ${root}/ (${data.total} files)`);
  for (const [sub, count] of Object.entries(data.sub)) {
    console.log(`    ${sub}/ (${count})`);
  }
}
