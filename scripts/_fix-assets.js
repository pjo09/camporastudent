#!/usr/bin/env node
// ============================================================
// CAMPORA ASSET & NAV FIXER
// Permanently fixes broken relative asset refs and corrupted
// nav links in frontend/pages/**/*.html
//
// The css/, js/, images/, fonts/, assets/ folders live ONLY in
// frontend/. Pages under frontend/pages/<section>/ must climb
// two levels (../../) to reach them.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FE = path.join(ROOT, "frontend");
const PAGES = path.join(FE, "pages");

const changed = [];
const skipped = [];

function walk(dir) {
  const out = [];
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) out.push(...walk(full));
    else if (e.name.endsWith(".html")) out.push(full);
  }
  return out;
}

function fixPage(htmlPath) {
  const rel = path.relative(FE, htmlPath).split(path.sep).join("/");
  // Only handle files under pages/<section>/
  const m = rel.match(/^pages\/([^/]+)\//);
  if (!m) return;

  const section = m[1];
  let content = fs.readFileSync(htmlPath, "utf8");
  const original = content;

  // ---- 1. Asset paths: ./css|js|images → ../../css|js|images ----
  for (const kind of ["css", "js", "images", "fonts", "assets"]) {
    content = content
      .replace(new RegExp(`(href|src|poster)=["']\\./${kind}/`, "g"), `$1="../../${kind}/`)
      .replace(new RegExp(`(href|src|poster)=["']${kind}/`, "g"), `$1="../../${kind}/`);
  }

  const stripOwner = (name) => name.replace(/^owner-/, "");

  // ---- 2. Fix corrupted nav links in owner section ----
  if (section === "owner") {
    // owner-../../properties.html → properties.html
    content = content.replace(/owner-\.\.\/\.\.\/([A-Za-z0-9_-]+\.html)/g, "$1");
    // owner-<name>.html → <name>.html  (e.g. owner-bookings.html → bookings.html)
    const ownerNav = ["messages", "analytics", "bookings", "reviews", "maintenance",
                      "payments", "settings", "notifications", "dashboard", "properties"];
    // owner-students.html → tenants.html
    content = content.replace(/owner-students\.html/g, "tenants.html");
    content = content.replace(/owner-properties\.html/g, "properties.html");
    for (const name of ownerNav) {
      if (name === "students" || name === "properties") continue;
      content = content.replace(new RegExp(`owner-${name}\\.html`, "g"), `${name}.html`);
    }
    // Fix module import path for owner-shell.js
    content = content.replace(/from ["']\.\/js\/owner-shell\.js["']/g, 'from "../../js/owner-shell.js"');
  }

  // ---- 3. Fix corrupted nav links in student section ----
  if (section === "student") {
    // saved-../../properties.html → saved-properties.html
    content = content.replace(/saved-\.\.\/\.\.\/properties\.html/g, "saved-properties.html");
    // properties.html (literal, missing) → ../../properties.html
    content = content.replace(/href=["']properties\.html["']/g, 'href="../../properties.html"');
    // payment.html references booking.html (does not exist in student/) → ../../booking.html
    content = content.replace(/href=["']booking\.html["']/g, 'href="../../booking.html"');
    content = content.replace(/src=["'](?:\.\.\/)?\.\/js\/([A-Za-z0-9_-]+\.js)["']/g, 'src="../../js/$1"');
    // owner-<...> stray in student section
    content = content.replace(/owner-\.\.\/\.\.\//g, "../");
  }

  // ---- 4. Fix property section nav to student pages ----
  if (section === "property") {
    const studentNav = ["dashboard", "bookings", "payments", "messages", "notifications",
                        "maintenance", "reviews", "documents", "analytics", "support",
                        "profile", "settings", "saved-properties"];
    for (const name of studentNav) {
      content = content.replace(new RegExp(`href=["']${name}\\.html`, "g"), `href="../student/${name}.html`);
    }
    // login.html → ../../login.html  (already relative-independent)
    content = content.replace(/href=["']login\.html["']/g, 'href="../../login.html"');
  }

  // ---- 5. Fix stray "../../" corruption that produced owner-../../ ----
  content = content.replace(/owner-\.\.\/\.\.\//g, "../");

  if (content !== original) {
    fs.writeFileSync(htmlPath, content, "utf8");
    changed.push(rel);
  }
}

// Also fix the shared JS nav redirects: when a dashboard JS lives in
// frontend/js/ but is used by pages/student/*, its "login.html" redirect
// resolves to pages/student/login.html (404). We keep root copies working
// by leaving JS untouched here — the HTML pages themselves are the source
// of truth for navigation.

for (const f of walk(PAGES)) {
  fixPage(f);
}

console.log("=== CAMPORA ASSET FIXER ===");
console.log(`Modified files: ${changed.length}`);
changed.forEach((f) => console.log("  UPDATED:", f));
