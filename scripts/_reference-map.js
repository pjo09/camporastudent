#!/usr/bin/env node
// ============================================================
// CAMPORA REFERENCE MAPPER
// Scans all HTML/JS/CSS under frontend/ and maps which files
// reference which local resources. Outputs JSON + a human summary.
// Does NOT modify any file.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FE = path.join(ROOT, "frontend");

const results = {
  scanned: [],
  references: {}, // file -> array of referenced relative paths (resolved to FE-relative)
  broken: [],      // references that resolve to nothing
  unreferencedFiles: [],
};

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".git") continue;
      walk(full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

const allFiles = walk(FE).map((f) => path.relative(FE, f).split(path.sep).join("/"));
const fileSet = new Set(allFiles);

// ---------- helpers ----------
function resolveRef(fromFile, ref) {
  // strip query/hash
  const clean = ref.split("?")[0].split("#")[0];
  if (!clean) return null;
  // external / absolute URL
  if (/^https?:\/\//i.test(clean) || clean.startsWith("//") || clean.startsWith("data:") || clean.startsWith("mailto:") || clean.startsWith("tel:")) {
    return null;
  }
  if (clean.startsWith("/")) {
    // root-absolute -> relative to FE
    return clean.replace(/^\/+/, "");
  }
  const fromDir = path.posix.dirname(fromFile);
  const resolved = path.posix.normalize(path.posix.join(fromDir, clean));
  return resolved;
}

function addRef(fromFile, ref) {
  const resolved = resolveRef(fromFile, ref);
  if (!resolved) return;
  if (!results.references[fromFile]) results.references[fromFile] = [];
  results.references[fromFile].push(resolved);
}

// ---------- HTML scan ----------
function scanHtml(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(FE, filePath).split(path.sep).join("/");

  // src="..." href="..." poster="..." (skip external handled by resolveRef)
  const attrRe = /(?:src|href|poster)=["']([^"']+)["']/g;
  let m;
  while ((m = attrRe.exec(content))) addRef(rel, m[1]);

  // CSS url(...) inside inline <style>
  const cssRe = /url\((['"]?)([^'")]+)\1\)/g;
  while ((m = cssRe.exec(content))) addRef(rel, m[2]);

  // JS string navigation .html refs
  const navRe = /(["'])([^"']+\.(?:html|js|css))\1/g;
  while ((m = navRe.exec(content))) {
    if (!m[2].startsWith(".") && !m[2].startsWith("/") && !/^https?:/.test(m[2])) {
      addRef(rel, m[2]);
    }
  }

  results.scanned.push(rel);
}

// ---------- JS scan ----------
function scanJs(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(FE, filePath).split(path.sep).join("/");

  // import ... from "./x.js"
  const importRe = /from\s*["']([^"']+)["']/g;
  let m;
  while ((m = importRe.exec(content))) addRef(rel, m[1]);

  // import("./x.js")
  const dynImportRe = /import\(["']([^"']+)["']\)/g;
  while ((m = dynImportRe.exec(content))) addRef(rel, m[1]);

  // new URL(...) / fetch("...") local
  const strRe = /["']((?:\.{1,2}\/[^"']*)|(?:[^"']*\.(?:html|js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|otf)))["']/g;
  while ((m = strRe.exec(content))) {
    if (m[1].startsWith("./") || m[1].startsWith("../") || m[1].startsWith("/") || /\.(html|js|css|png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf|eot|otf)$/.test(m[1])) {
      addRef(rel, m[1]);
    }
  }

  // window.location.href / location.href = "page.html"
  const locRe = /location\.href\s*=\s*["']([^"']+)["']/g;
  while ((m = locRe.exec(content))) addRef(rel, m[1]);

  results.scanned.push(rel);
}

// ---------- CSS scan ----------
function scanCss(filePath) {
  const content = fs.readFileSync(filePath, "utf8");
  const rel = path.relative(FE, filePath).split(path.sep).join("/");

  const urlRe = /url\((['"]?)([^'")]+)\1\)/g;
  let m;
  while ((m = urlRe.exec(content))) {
    const u = m[2];
    if (/^https?:\/\//i.test(u) || u.startsWith("data:") || u.startsWith("#")) continue;
    addRef(rel, u);
  }

  const importRe = /@import\s+["']([^"']+)["']/g;
  while ((m = importRe.exec(content))) addRef(rel, m[1]);

  results.scanned.push(rel);
}

// ---------- run ----------
for (const file of allFiles) {
  if (file.endsWith(".html")) scanHtml(path.join(FE, file));
  else if (file.endsWith(".js")) scanJs(path.join(FE, file));
  else if (file.endsWith(".css")) scanCss(path.join(FE, file));
}

// ---------- dedupe + detect broken ----------
for (const [from, refs] of Object.entries(results.references)) {
  const uniq = [...new Set(refs)];
  results.references[from] = uniq;
  for (const r of uniq) {
    if (!fileSet.has(r)) {
      results.broken.push({ from, ref: r });
    }
  }
}

// ---------- unreferenced files ----------
const referencedSet = new Set();
for (const refs of Object.values(results.references)) {
  for (const r of refs) referencedSet.add(r);
}
for (const f of allFiles) {
  if (!referencedSet.has(f)) {
    results.unreferencedFiles.push(f);
  }
}

// ---------- output ----------
const outFile = path.join(ROOT, "scripts", "_reference-map-output.json");
fs.writeFileSync(outFile, JSON.stringify(results, null, 2), "utf8");

console.log("=== CAMPORA REFERENCE MAP SUMMARY ===");
console.log(`Scanned files: ${results.scanned.length}`);
console.log(`Files with references: ${Object.keys(results.references).length}`);
console.log(`Total unique reference edges: ${Object.values(results.references).reduce((a, r) => a + r.length, 0)}`);
console.log(`Broken references: ${results.broken.length}`);
console.log(`Unreferenced files (potential dead): ${results.unreferencedFiles.length}`);

console.log("\n--- BROKEN REFERENCES (resolve to non-existent files) ---");
if (results.broken.length === 0) {
  console.log("(none)");
} else {
  const seen = new Set();
  for (const b of results.broken) {
    const key = b.ref;
    if (!seen.has(key)) {
      seen.add(key);
      console.log(`  MISSING: ${b.ref}`);
      const froms = results.broken.filter((x) => x.ref === b.ref).map((x) => x.from);
      console.log(`    referenced by: ${froms.slice(0, 5).join(", ")}${froms.length > 5 ? ` (+${froms.length - 5} more)` : ""}`);
    }
  }
}

console.log("\n--- UNREFERENCED FILES (candidate dead files) ---");
const grouped = {};
for (const f of results.unreferencedFiles) {
  const dir = path.posix.dirname(f);
  if (!grouped[dir]) grouped[dir] = [];
  grouped[dir].push(f);
}
for (const [dir, files] of Object.entries(grouped)) {
  console.log(`  [${dir}/]`);
  for (const f of files) console.log(`    ${f}`);
}
console.log("\nFull JSON at scripts/_reference-map-output.json");

