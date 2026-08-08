// =============================================
// CAMPORA FULL VERIFICATION SCRIPT
// Checks all items in the verification checklist
// =============================================
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const results = [];
function record(id, pass, note) {
  results.push({ id, pass, note });
  console.log(`${pass ? "✅ PASS" : "❌ FAIL"}  [${id}] ${note}`);
}

// -------------------------------
// TEST 13: CORS origins in app.js
// -------------------------------
function testCors() {
  const app = fs.readFileSync(path.join(ROOT, "backend/app.js"), "utf8");
  // app.js uses pattern-based CORS matching. Replicate that logic to assert
  // whether the required origins would be allowed.
  const allow = (origin) => {
    if (!origin) return true;
    if (origin.startsWith("http://localhost") || origin.startsWith("http://127.0.0.1")) return true;
    if (origin.includes("vercel.app")) return true;
    if (origin.includes("onrender.com")) return true;
    return false;
  };
  const required = [
    "https://camporastudent.vercel.app",
    "https://camporastudent-ocuvrii1b-pjo09s-projects.vercel.app",
    "http://localhost:5500",
    "http://localhost:5000",
    "http://127.0.0.1:3000"
  ];
  const allAllowed = required.every(allow);
  const patternPresent = app.includes('includes("vercel.app")') && app.includes('includes("onrender.com")') && (app.includes('startsWith("http://localhost")') || app.includes('origin.startsWith("http://localhost")'));
  record("13-CORS", patternPresent && allAllowed, `pattern-based CORS present; allows localhost any port + vercel.app + onrender.com (incl. camporastudent-ocuvrii1b-pjo09s-projects.vercel.app)`);
}

// -------------------------------
// TEST 14: no old domain references
// -------------------------------
function testNoOldDomain() {
  const targets = ["camporastudents2.onrender.com", "camporastudents.vercel.app"];
  const jsDirs = [
    "frontend/js",
    "backend/routes",
    "backend/config",
    "backend/middleware",
    "backend/controllers",
    "backend/utils",
    "backend/models"
  ];
  let found = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const f of fs.readdirSync(dir)) {
      const full = path.join(dir, f);
      const stat = fs.statSync(full);
      if (stat.isDirectory()) walk(full);
      else if (/\.js$/.test(f)) {
        const content = fs.readFileSync(full, "utf8");
        for (const t of targets) {
          if (content.includes(t)) found.push(`${full} -> ${t}`);
        }
      }
    }
  };
  jsDirs.forEach((d) => walk(path.join(ROOT, d)));
  // Also check the primary frontend config
  const cfg = fs.readFileSync(path.join(ROOT, "frontend/js/config.js"), "utf8");
  for (const t of targets) if (cfg.includes(t)) found.push(`config.js -> ${t}`);
  record("14-NoOldDomain", found.length === 0, found.length ? found.join("; ") : "No camporastudents2.onrender.com / camporastudents.vercel.app refs in JS");
}

// -------------------------------
// TEST 15: frontend API base
// -------------------------------
function testApiBase() {
  const cfg = fs.readFileSync(path.join(ROOT, "frontend/js/config.js"), "utf8");
  const prod = cfg.includes('"https://camporastudent.onrender.com/api"');
  const file = cfg.includes('"http://localhost:5000/api"');
  record("15-APIConfig", prod && file, `prod=https://camporastudent.onrender.com/api, dev=http://localhost:5000/api`);
}

// -------------------------------
// TEST 16: redirect paths in session.js
// -------------------------------
function testRedirects() {
  const s = fs.readFileSync(path.join(ROOT, "frontend/js/session.js"), "utf8");
  const student = s.includes('/pages/student/dashboard.html');
  const owner = s.includes('/pages/owner/dashboard.html');
  const admin = s.includes('/pages/admin/dashboard.html');
  record("09-StudentRedirect", student, "student -> /pages/student/dashboard.html");
  record("10-OwnerRedirect", owner, "owner -> /pages/owner/dashboard.html");
  record("11-AdminRedirect", admin, "admin -> /pages/admin/dashboard.html");
}

// -------------------------------
// TEST 8: admin gate in auth.js
// -------------------------------
function testAdminGate() {
  const auth = fs.readFileSync(path.join(ROOT, "backend/routes/auth.js"), "utf8");
  const email = auth.includes("camporaforstudents@gmail.com");
  const adminLogin = auth.includes('"/admin/login"') || auth.includes("/admin/login");
  const authz = auth.includes("Unauthorized Admin Access") || auth.includes("Unauthorized");
  record("08-AdminGate", email && adminLogin && authz, `admin/login route + camporaforstudents@gmail.com gate present`);
}

// -------------------------------
// TEST 5/6: login password-only, OTP login disabled
// -------------------------------
function testLoginModes() {
  const otp = fs.readFileSync(path.join(ROOT, "backend/routes/otp.js"), "utf8");
  const otpLoginDisabled = /type\s*===\s*"login"/.test(otp) === false || otp.includes("OTP login disabled") || otp.includes("authProvider") || otp.includes('authProvider: "password"');
  // Check login.js doesn't call /api/otp/verify for login
  const loginJs = fs.readFileSync(path.join(ROOT, "frontend/js/login.js"), "utf8");
  const loginUsesOtp = loginJs.includes("/otp/verify");
  record("06-OTPLoginDisabled", !loginUsesOtp, `login.js does NOT use /api/otp/verify (uses email+password)`);
  record("05-LoginPassword", loginJs.includes("/auth/login"), `login.js calls /auth/login`);
}

// -------------------------------
// TEST 17: node --check syntax on backend files
// -------------------------------
const { execSync } = require("child_process");
function testSyntax() {
  const files = [
    "backend/routes/auth.js",
    "backend/routes/otp.js",
    "backend/routes/admin.js",
    "backend/routes/google.js",
    "backend/routes/statistics.js",
    "backend/middleware/auth.js",
    "backend/middleware/role.js",
    "backend/app.js",
    "backend/server.js",
    "backend/config/db.js"
  ];
  let allOk = true;
  files.forEach((f) => {
    const full = path.join(ROOT, f);
    try {
      execSync(`node --check "${full}"`, { stdio: "pipe" });
      console.log(`   OK syntax: ${f}`);
    } catch (e) {
      allOk = false;
      console.log(`   SYNTAX ERROR: ${f}`, e.stderr ? e.stderr.toString() : "");
    }
  });
  record("17-Syntax", allOk, `node --check on ${files.length} backend files (auth, otp, admin, google, statistics, middleware, app, server)`);
}

// -------------------------------
// TEST: register weak/mismatch validation present
// -------------------------------
function testRegisterValidation() {
  const auth = fs.readFileSync(path.join(ROOT, "backend/routes/auth.js"), "utf8");
  const strong = auth.includes("PASSWORD_REGEX") || (auth.includes("(?=.*[a-z])") && auth.includes("(?=.*[A-Z])"));
  const registerRoute = auth.includes('"/register"') || auth.includes("/register");
  const registerJs = fs.readFileSync(path.join(ROOT, "frontend/js/register.js"), "utf8");
  const confirmMatch = registerJs.includes("Passwords do not match") || registerJs.includes("confirmPassword");
  record("03-RegisterValidation", strong && confirmMatch, `strong password regex + confirm-password match check present`);

  // Student & Owner registration support
  const roleStudent = auth.includes('"student"');
  const roleOwner = auth.includes('"owner"');
  record("03-Roles", roleStudent && roleOwner, `register supports student + owner roles`);
}
// -------------------------------
// TEST: forgot password flow present
// -------------------------------
function testForgotPassword() {
  const auth = fs.readFileSync(path.join(ROOT, "backend/routes/auth.js"), "utf8");
  const fp = auth.includes("/forgot-password");
  const vru = auth.includes("/verify-reset-otp");
  const rp = auth.includes("/reset-password");
  const fpJs = fs.existsSync(path.join(ROOT, "frontend/js/forgot-password.js"));
  const fpHtml = fs.existsSync(path.join(ROOT, "frontend/forgot-password.html"));
  record("07-ForgotPassword", fp && vru && rp && fpJs && fpHtml, `forgot-password, verify-reset-otp, reset-password routes + frontend present`);
}
// -------------------------------
// TEST: google login route + frontend
// -------------------------------
function testGoogle() {
  const g = fs.readFileSync(path.join(ROOT, "backend/routes/google.js"), "utf8");
  const hasVerify = g.includes("verifyIdToken") || g.includes("OAuth2Client");
  const appJs = fs.readFileSync(path.join(ROOT, "backend/app.js"), "utf8");
  const mounted = appJs.includes("/api/auth/google");
  const loginJs = fs.readFileSync(path.join(ROOT, "frontend/js/login.js"), "utf8");
  const frontend = loginJs.includes("/auth/google");
  record("12-GoogleLogin", hasVerify && mounted && frontend, `google route + OAuth2 verify + mounted + login.js wired`);
}

// -------------------------------
// TEST 16: auth pages reference valid assets
// -------------------------------
function testAuthPages() {
  const pages = [
    { html: "frontend/login.html", js: ["frontend/js/session.js", "frontend/js/login.js"], css: ["frontend/css/theme.css", "frontend/css/style.css", "frontend/css/auth.css"] },
    { html: "frontend/register.html", js: ["frontend/js/register.js"], css: ["frontend/css/theme.css", "frontend/css/style.css", "frontend/css/auth.css"] },
    { html: "frontend/admin-login.html", js: ["frontend/js/admin-login.js"], css: ["frontend/css/theme.css", "frontend/css/style.css", "frontend/css/auth.css"] },
    { html: "frontend/forgot-password.html", js: ["frontend/js/forgot-password.js"], css: ["frontend/css/theme.css", "frontend/css/style.css", "frontend/css/auth.css"] }
  ];
  let allOk = true;
  const missing = [];
  for (const p of pages) {
    if (!fs.existsSync(path.join(ROOT, p.html))) { allOk = false; missing.push(p.html); }
    for (const j of p.js) if (!fs.existsSync(path.join(ROOT, j))) { allOk = false; missing.push(j); }
    for (const c of p.css) if (!fs.existsSync(path.join(ROOT, c))) { allOk = false; missing.push(c); }
  }
  record("16-AuthPagesAssets", allOk, missing.length ? "MISSING: " + missing.join(", ") : "login/register/admin-login/forgot-password HTML + JS + CSS all exist");
}

// -------------------------------
// TEST 2: statistics route present
// -------------------------------
function testStatistics() {
  const stats = fs.readFileSync(path.join(ROOT, "backend/routes/statistics.js"), "utf8");
  const app = fs.readFileSync(path.join(ROOT, "backend/app.js"), "utf8");
  const mounted = app.includes("/api/statistics");
  const route = stats.includes('router.get("/"');
  record("02-Statistics", mounted && route, `/api/statistics mounted in app.js + GET / handler present`);
}

// =============================================
// RUN
// =============================================
testCors();
testNoOldDomain();
testApiBase();
testRedirects();
testAdminGate();
testLoginModes();
testSyntax();
testRegisterValidation();
testForgotPassword();
testGoogle();
testStatistics();
testAuthPages();

console.log("\n============================================");
const fails = results.filter((r) => !r.pass);
console.log(`TOTAL: ${results.length}  PASS: ${results.length - fails.length}  FAIL: ${fails.length}`);
fails.forEach((f) => console.log(`  ❌ ${f.id}: ${f.note}`));
console.log("============================================");
