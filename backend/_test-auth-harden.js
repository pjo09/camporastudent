// =============================================
// AUTH HARDENING E2E TEST SCRIPT
// Run: node _test-auth-harden.js
// Requires: backend running on :5000
// =============================================

const base = "http://localhost:5000/api";
const results = [];
let pass = 0, fail = 0;

function log(name, ok, detail = "") {
  results.push({ name, ok, detail });
  if (ok) pass++; else fail++;
  console.log(`${ok ? "✅" : "❌"} ${name}${detail ? " — " + detail : ""}`);
}

async function call(path, body, method = "POST") {
  const res = await fetch(base + path, {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  let data = {};
  try { data = await res.json(); } catch { data = {}; }
  return { status: res.status, ...data };
}

// Unique test emails
const ts = Date.now();
const studentEmail = `student_harden_${ts}@test.com`;
const ownerEmail = `owner_harden_${ts}@test.com`;
const adminEmail = "camporaforstudents@gmail.com";
const strangerEmail = `stranger_${ts}@test.com`;

const strongPwd = "Str0ng@Pass1";

async function main() {
  console.log("=== AUTH HARDENING E2E ===\n");

  // 1. Admin login — denied email (must NOT reveal existence)
  let r = await call("/auth/admin/login", { email: strangerEmail, password: strongPwd });
  log("Admin login denied email → generic message", r.status === 403 && !r.success && /Unauthorized/.test(r.message || ""), r.message);

  // 2. Admin login — no password
  r = await call("/auth/admin/login", { email: adminEmail });
  log("Admin login missing password rejected", r.status === 400 && !r.success, r.message);

  // 3. Forgot password — unknown email returns generic success (no enumeration)
  r = await call("/auth/forgot-password", { email: strangerEmail });
  log("Forgot password (unknown email) generic 200", r.status === 200 && r.success, r.message);

  // 4. Verify-reset-otp with no valid OTP → error
  r = await call("/auth/verify-reset-otp", { email: strangerEmail, code: "000000" });
  log("Verify-reset-otp invalid code rejected", r.status === 400 && !r.success, r.message);

  // 5. Register student with weak password → rejected
  r = await call("/auth/register", { name: "Test Student", email: studentEmail, password: "weak", role: "student" });
  log("Student register weak password rejected", r.status === 400 && !r.success, r.message);

  // 6. Register student with strong password → success
  r = await call("/auth/register", { name: "Test Student", email: studentEmail, password: strongPwd, role: "student" });
  log("Student register (strong pwd) success", r.status === 201 && r.success && r.user && r.token, r.message);

  // 7. Duplicate email → 409
  r = await call("/auth/register", { name: "Test Student", email: studentEmail, password: strongPwd, role: "student" });
  log("Duplicate student email → 409", r.status === 409 && !r.success, r.message);

  // 8. Owner register → PENDING, no token
  r = await call("/auth/register", { name: "Test Owner", email: ownerEmail, password: strongPwd, role: "owner" });
  log("Owner register → PENDING (no token)", r.status === 201 && r.success && r.user && !r.token && /approval/.test(r.message || ""), r.message);

  // 9. Owner login while PENDING → forbidden
  r = await call("/auth/login", { email: ownerEmail, password: strongPwd });
  log("Owner login while PENDING blocked", r.status === 403 && !r.success, r.message);

  // 10. Student login correct → success
  r = await call("/auth/login", { email: studentEmail, password: strongPwd });
  const studentToken = r.token;
  log("Student login (correct pwd) success", r.status === 200 && r.success && r.token, r.message);

  // 11. Student login wrong password → 401
  r = await call("/auth/login", { email: studentEmail, password: "Wrong@Pass9" });
  log("Student login (wrong pwd) → 401", r.status === 401 && !r.success, r.message);

  // 12. GET /me with valid token
  r = await (await fetch(base + "/auth/me", { headers: { Authorization: `Bearer ${studentToken}` } })).json();
  log("GET /me with valid token works", r.success && r.user && r.user.email === studentEmail, r.message);

  // 13. GET /me with invalid token → 401
  const badRes = await fetch(base + "/auth/me", { headers: { Authorization: "Bearer invalid.token.here" } });
  r = await badRes.json();
  log("GET /me with invalid token → 401", badRes.status === 401 && !r.success, r.message);

  // 14. OTP resend cooldown — send OTP twice quickly
  r = await call("/otp/send", { name: "Test Student", email: studentEmail });
  log("OTP send (1st) success", r.status === 200 && r.success, r.message);
  r = await call("/otp/send", { name: "Test Student", email: studentEmail });
  log("OTP resend cooldown enforced (429)", r.status === 429 && !r.success, r.message);

  // 15. OTP verify with wrong code → invalid
  r = await call("/otp/verify", { type: "login", email: studentEmail, code: "000000" });
  log("OTP invalid code rejected", r.status === 400 && !r.success, r.message);

  // 16. OTP verify with no code → 400
  r = await call("/otp/verify", { type: "login", email: studentEmail });
  log("OTP missing code → 400", r.status === 400 && !r.success, r.message);

  // 17. Reset password flow
  // - forgot-password for the student (fresh cooldown wait)
  await new Promise(res => setTimeout(res, 31000));
  r = await call("/auth/forgot-password", { email: studentEmail });
  log("Forgot password (existing student) success", r.status === 200 && r.success, r.message);

  // Since we can't read the emailed OTP, we directly insert/read from DB not possible here.
  // Instead verify the reset-password rejects without a valid otp:
  r = await call("/auth/reset-password", { email: studentEmail, code: "999999", password: strongPwd });
  log("Reset password (no valid OTP) rejected", r.status === 400 && !r.success, r.message);

  console.log(`\n=== RESULTS: ${pass} passed, ${fail} failed ===`);
  process.exit(fail === 0 ? 0 : 1);
}

main().catch(e => { console.error(e); process.exit(1); });
