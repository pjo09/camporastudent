#!/usr/bin/env node
// ============================================================
// CAMPORA FRONTEND REORGANIZER  (Strategy A - Safest)
// ------------------------------------------------------------
// Creates a clean domain-organized structure under:
//   frontend/src/...
// while PRESERVING the existing working deployment at
//   frontend/ root (index.html, login.html, css/, js/, etc.)
//
// Approach:
//   1. Copy every live (referenced) file into frontend/src/
//      organized by domain.
//   2. Rewrite relative references (css/js/images/html) in the
//      copied files so the src/ tree is fully self-contained.
//   3. NEVER delete original files. Original deployment keeps
//      working exactly as before.
//   4. Verify the src/ tree with the reference mapper.
// ============================================================
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const FE = path.join(ROOT, "frontend");
const SRC = path.join(FE, "src");

// ------------------------------------------------------------
// DOMAIN CLASSIFIER
// ------------------------------------------------------------

// Map each top-level page (HTML filename at frontend root) to a domain folder.
const HTML_DOMAIN = {
  // Auth
  "login.html": "auth",
  "register.html": "auth",
  "signup.html": "auth",
  "admin-login.html": "auth",
  "forgot-password.html": "auth",

  // Landing / public
  "index.html": "landing",
  "properties.html": "landing",
  "property-details.html": "property",
  "property.html": "property",
  "universities.html": "landing",
  "contact.html": "landing",

  // Student
  "dashboard.html": "student",
  "dashboard-new.html": "student",
  "profile.html": "student",
  "bookings.html": "student",
  "booking.html": "student",
  "saved-properties.html": "student",
  "notifications.html": "student",
  "messages.html": "student",
  "nearby.html": "student",
  "analytics.html": "student",
  "settings.html": "student",
  "documents.html": "student",
  "maintenance.html": "student",
  "payment.html": "student",
  "payments.html": "student",
  "reviews.html": "student",
  "success.html": "student",
  "support.html": "student",

  // Owner
  "owner-dashboard.html": "owner",
  "owner-properties.html": "owner",
  "add-property.html": "owner",
  "owner-bookings.html": "owner",
  "owner-students.html": "owner",
  "owner-payments.html": "owner",
  "owner-reviews.html": "owner",
  "owner-analytics.html": "owner",
  "owner-messages.html": "owner",
  "owner-notifications.html": "owner",
  "owner-settings.html": "owner",
  "owner-maintenance.html": "owner",

  // Admin
  "admin-dashboard.html": "admin",
};

// JS -> domain (used for js/ files that map to a specific page domain)
const JS_DOMAIN = {
  "login.js": "auth",
  "register.js": "auth",
  "admin-login.js": "auth",
  "forgot-password.js": "auth",
  "session.js": "auth",
  "otp-auth.js": "auth",
  "otp.js": "auth",
  "script.js": "landing",
  "index.js": "landing",
  "main.js": "landing",
  "navbar.js": "common",
  "config.js": "common",
  "api.js": "common",
  "app.js": "common",
  "theme.js": "common",
  "image-utils.js": "common",

  "student-dashboard.js": "student",
  "student-bookings.js": "student",
  "student-booking.js": "student",
  "student-profile.js": "student",
  "student-messages.js": "student",
  "student-notifications.js": "student",
  "student-analytics.js": "student",
  "student-saved.js": "student",
  "student-maintenance.js": "student",
  "student-explore.js": "student",
  "student-documents.js": "student",
  "student-payments.js": "student",
  "student-reviews.js": "student",
  "student-settings.js": "student",
  "student-support.js": "student",
  "student-utils.js": "student",
  "student-property-details.js": "property",
  "nearby.js": "student",
  "payment.js": "student",
  "success.js": "student",
  "bookings.js": "student",
  "properties.js": "landing",
  "property-details.js": "property",
  "settings.js": "student",
  "dashboard-new.js": "student",
  "dashboard-v2.js": "student",

  "owner-shell.js": "owner",
  "owner-dashboard-v3.js": "owner",
  "owner-properties.js": "owner",
  "add-property.js": "owner",
  "owner-bookings.js": "owner",
  "owner-students.js": "owner",
  "owner-payments.js": "owner",
  "owner-reviews.js": "owner",
  "owner-analytics.js": "owner",
  "owner-messages.js": "owner",
  "owner-notifications.js": "owner",
  "owner-settings.js": "owner",
  "owner-maintenance.js": "owner",
  "owner-dashboard.js": "owner",

  "admin-dashboard.js": "admin",
};

// CSS -> domain
const CSS_DOMAIN = {
  "auth.css": "auth",
  "theme.css": "common",
  "base.css": "common",
  "components.css": "common",
  "style.css": "common",
  "index.css": "landing",
  "landing.css": "landing",
  "student-v3.css": "student",
  "dashboard.css": "student",
  "dashboard-v2.css": "student",
  "dashboard-new.css": "student",
  "bookings.css": "student",
  "payment.css": "student",
  "success.css": "student",
  "property-details.css": "property",
  "property.css": "property",
  "property-upload.css": "property",
  "owner-v3.css": "owner",
  "owner.css": "owner",
  "owner-dashboard.css": "owner",
  "add-property.css": "owner",
  "admin.css": "admin",
  "booking.css": "common",
  "responsive.css": "common",
};

// ------------------------------------------------------------
// COPY WITH REFERENCE REWRITING
// ------------------------------------------------------------

function copyTree() {
  // 1. Copy HTML files
  const htmlFiles = fs.readdirSync(FE).filter((f) => f.endsWith(".html"));
  for (const f of htmlFiles) {
    const domain = HTML_DOMAIN[f] || "common";
    const destDir = path.join(SRC, "pages", domain);
    fs.mkdirSync(destDir, { recursive: true });
    const srcFile = path.join(FE, f);
    const destFile = path.join(destDir, f);
    let content = fs.readFileSync(srcFile, "utf8");
    content = rewriteHtml(content, domain);
    fs.writeFileSync(destFile, content, "utf8");
    console.log(`📄 HTML: ${f} -> src/pages/${domain}/${f}`);
  }

  // 2. Copy JS files
  const jsFiles = fs.readdirSync(path.join(FE, "js")).filter((f) => f.endsWith(".js"));
  for (const f of jsFiles) {
    const domain = JS_DOMAIN[f] || "common";
    const destDir = path.join(SRC, "js", domain);
    fs.mkdirSync(destDir, { recursive: true });
    const srcFile = path.join(FE, "js", f);
    const destFile = path.join(destDir, f);
    let content = fs.readFileSync(srcFile, "utf8");
    content = rewriteJs(content, domain);
    fs.writeFileSync(destFile, content, "utf8");
    console.log(`📜 JS: ${f} -> src/js/${domain}/${f}`);
  }

  // 3. Copy CSS files
  const cssFiles = fs.readdirSync(path.join(FE, "css")).filter((f) => f.endsWith(".css"));
  for (const f of cssFiles) {
    const domain = CSS_DOMAIN[f] || "common";
    const destDir = path.join(SRC, "css", domain);
    fs.mkdirSync(destDir, { recursive: true });
    const srcFile = path.join(FE, "css", f);
    const destFile = path.join(destDir, f);
    let content = fs.readFileSync(srcFile, "utf8");
    content = rewriteCss(content, domain);
    fs.writeFileSync(destFile, content, "utf8");
    console.log(`🎨 CSS: ${f} -> src/css/${domain}/${f}`);
  }

  // 4. Copy assets (images, fonts)
  for (const assetDir of ["images", "assets", "fonts"]) {
    const fullDir = path.join(FE, assetDir);
    if (!fs.existsSync(fullDir)) continue;
    copyDir(fullDir, path.join(SRC, assetDir));
  }

  console.log("\n✅ Copy complete. Original frontend/ untouched.");
}

function copyDir(srcDir, destDir) {
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const s = path.join(srcDir, entry.name);
    const d = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

// ------------------------------------------------------------
// REWRITE HELPERS
// ------------------------------------------------------------

function rewriteHtml(content, domain) {
  // css/ -> css/<domain>/  (from a page in src/pages/<domain>/)
  content = content.replace(/(href=["'])(\.{1,2}\/)?css\//g, `$1../../css/${domain}/`);
  // js/ -> js/<domain>/  (from a page in src/pages/<domain>/)
  content = content.replace(/(src=["'])(\.{1,2}\/)?js\/([^"']+\.js)/g, (m, p1, p2, jsFile) => {
    const jsDomain = JS_DOMAIN[jsFile] || "common";
    return `${p1}../../js/${jsDomain}/${jsFile}`;
  });
  // images/ -> ../../images/
  content = content.replace(/((?:src|href)=")(\.{1,2}\/)?images\//g, `$1../../images/`);
  // assets/ -> ../../assets/
  content = content.replace(/((?:src|href)=")(\.{1,2}\/)?assets\//g, `$1../../assets/`);
  // Relative page links -> point to other domain pages (best-effort rewrite to relative within same dir if same domain)
  // We'll fix cross-domain page links by mapping page name to domain.
  content = content.replace(/href=["']([a-zA-Z0-9-]+\.html)([^"']*)["']/g, (m, page, qs) => {
    const pageDomain = HTML_DOMAIN[page] || "common";
    if (pageDomain === domain) {
      return `href="${page}${qs}"`;
    }
    // Cross-domain link: ../<pageDomain>/<page>
    return `href="../${pageDomain}/${page}${qs}"`;
  });
  return content;
}

function rewriteJs(content, domain) {
  // import ... from "./x.js" -> "./x.js" if same domain else "../<dom>/x.js"
  content = content.replace(/from\s*["']\.\/([^"']+\.js)["']/g, (m, jsFile) => {
    const jsDomain = JS_DOMAIN[jsFile] || "common";
    if (jsDomain === domain) return `from "./${jsFile}"`;
    return `from "../${jsDomain}/${jsFile}"`;
  });
  content = content.replace(/import\s*\(["']\.\/([^"']+\.js)["']\)/g, (m, jsFile) => {
    const jsDomain = JS_DOMAIN[jsFile] || "common";
    if (jsDomain === domain) return `import("./${jsFile}")`;
    return `import("../${jsDomain}/${jsFile}")`;
  });
  // window.location.href = "page.html" -> resolve domain
  content = content.replace(/(location\.href\s*=\s*["'])([a-zA-Z0-9-]+\.html)(["'])/g, (m, p1, page, p3) => {
    const pageDomain = HTML_DOMAIN[page] || "common";
    if (pageDomain === domain) return `${p1}${page}${p3}`;
    return `${p1}../${pageDomain}/${page}${p3}`;
  });
  // images/ -> ../../images/ (from src/js/<domain>/)
  content = content.replace(/(["'\(])(\.{1,2}\/)?images\//g, `$1../../images/`);
  // assets/ -> ../../assets/
  content = content.replace(/(["'\(])(\.{1,2}\/)?assets\//g, `$1../../assets/`);
  return content;
}

function rewriteCss(content, domain) {
  // url(images/...) -> url(../../images/...)
  content = content.replace(/url\((["']?)(\.{1,2}\/)?images\//g, `url($1../../images/`);
  // url(assets/...) -> url(../../assets/...)
  content = content.replace(/url\((["']?)(\.{1,2}\/)?assets\//g, `url($1../../assets/`);
  // url(fonts/...) -> url(../../fonts/...)
  content = content.replace(/url\((["']?)(\.{1,2}\/)?fonts\//g, `url($1../../fonts/`);
  return content;
}

copyTree();

