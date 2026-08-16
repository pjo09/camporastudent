const path = require("path");
const PROJECT_ROOT = path.join(__dirname, "../..");
require("dotenv").config({ path: path.join(PROJECT_ROOT, "backend/.env") });

const dns = require(path.join(__dirname, "../config/dns"));
dns.configureDnsResolvers();

const mongoose = require("mongoose");
const fs = require("fs");
const jwt = require("jsonwebtoken");
const puppeteer = require("puppeteer-core");

const User = require(path.join(PROJECT_ROOT, "backend/models/User"));
const Property = require(path.join(PROJECT_ROOT, "backend/models/Property"));
const ResidentRequest = require(path.join(PROJECT_ROOT, "backend/models/ResidentRequest"));
const Tenancy = require(path.join(PROJECT_ROOT, "backend/models/Tenancy"));
const PropertyInvite = require(path.join(PROJECT_ROOT, "backend/models/PropertyInvite"));

const JWT_SECRET = process.env.JWT_SECRET;
const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const BASE_API = "https://camporastudent.onrender.com/api";
const BASE_FE = "https://camporastudent.vercel.app";

const testSuffix = "_prod_audit_" + Date.now();
const emails = {
  student: `student${testSuffix}@campora.com`,
  student2: `student2${testSuffix}@campora.com`,
  owner: `owner${testSuffix}@campora.com`,
  owner2: `owner2${testSuffix}@campora.com`
};

let createdRecords = {
  users: [],
  properties: [],
  requests: [],
  tenancies: [],
  invites: []
};

async function setupDB() {
  console.log("Connecting to production MongoDB Atlas...");
  await mongoose.connect(process.env.MONGO_URI);
  console.log("Connected to MongoDB.");

  // Create temporary student
  const student = await User.create({
    name: "Audit Student",
    email: emails.student,
    password: "Password123!",
    role: "student",
    verified: true
  });
  createdRecords.users.push(student._id);

  // Create another student for cross-access boundary testing
  const student2 = await User.create({
    name: "Audit Student 2",
    email: emails.student2,
    password: "Password123!",
    role: "student",
    verified: true
  });
  createdRecords.users.push(student2._id);

  // Create temporary owner
  const owner = await User.create({
    name: "Audit Owner",
    email: emails.owner,
    password: "Password123!",
    role: "owner",
    verified: true,
    accountStatus: "ACTIVE"
  });
  createdRecords.users.push(owner._id);

  // Create another owner for authorization boundary testing
  const owner2 = await User.create({
    name: "Audit Owner 2",
    email: emails.owner2,
    password: "Password123!",
    role: "owner",
    verified: true,
    accountStatus: "ACTIVE"
  });
  createdRecords.users.push(owner2._id);

  // Create property for first owner
  const property = await Property.create({
    propertyName: `PG Stay ${testSuffix}`,
    owner: owner._id,
    address: "Audit Road 1",
    city: "Bangalore",
    state: "Karnataka",
    zipCode: "560001",
    rent: 9000,
    deposit: 18000,
    sharing: "Double",
    gender: "Boys",
    propertyType: "PG",
    status: "approved",
    published: true,
    available: true,
    verified: true
  });
  createdRecords.properties.push(property._id);

  // Expired Invite
  const expiredInvite = await PropertyInvite.create({
    property: property._id,
    token: `expired_${testSuffix}`,
    expiresAt: new Date(Date.now() - 3600 * 1000), // expired 1 hour ago
    status: "ACTIVE"
  });
  createdRecords.invites.push(expiredInvite._id);

  // Revoked Invite
  const revokedInvite = await PropertyInvite.create({
    property: property._id,
    token: `revoked_${testSuffix}`,
    expiresAt: new Date(Date.now() + 3600 * 1000),
    status: "REVOKED"
  });
  createdRecords.invites.push(revokedInvite._id);

  console.log("Database mock records setup complete.");
  return {
    expiredToken: expiredInvite.token,
    revokedToken: revokedInvite.token,
    studentToken: jwt.sign({ id: student._id, role: "student" }, JWT_SECRET),
    student2Token: jwt.sign({ id: student2._id, role: "student" }, JWT_SECRET),
    ownerToken: jwt.sign({ id: owner._id, role: "owner" }, JWT_SECRET),
    owner2Token: jwt.sign({ id: owner2._id, role: "owner" }, JWT_SECRET),
    propertyId: property._id,
    studentId: student._id,
    ownerId: owner._id
  };
}

async function cleanUp() {
  console.log("\nStarting database cleanup...");
  try {
    if (createdRecords.tenancies.length > 0) {
      await Tenancy.deleteMany({ _id: { $in: createdRecords.tenancies } });
      console.log(`Cleaned up ${createdRecords.tenancies.length} tenancies.`);
    }
    if (createdRecords.requests.length > 0) {
      await ResidentRequest.deleteMany({ _id: { $in: createdRecords.requests } });
      console.log(`Cleaned up ${createdRecords.requests.length} requests.`);
    }
    if (createdRecords.invites.length > 0) {
      await PropertyInvite.deleteMany({ _id: { $in: createdRecords.invites } });
      console.log(`Cleaned up ${createdRecords.invites.length} invites.`);
    }
    if (createdRecords.properties.length > 0) {
      await Property.deleteMany({ _id: { $in: createdRecords.properties } });
      console.log(`Cleaned up ${createdRecords.properties.length} properties.`);
    }
    if (createdRecords.users.length > 0) {
      await User.deleteMany({ _id: { $in: createdRecords.users } });
      console.log(`Cleaned up ${createdRecords.users.length} users.`);
    }
  } catch (err) {
    console.error("Cleanup error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB.");
  }
}

async function call(path, token, method = "GET", body = null) {
  const url = BASE_API + path;
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const dnsObj = require("dns");
  const urlObj = new URL(url);
  const ips = await dnsObj.promises.resolve(urlObj.hostname).catch(() => []);
  console.log(`[HTTP Call] ${method} ${url} -> Host resolved to:`, ips);

  const res = await fetch(url, {
    method,
    headers,
    body: body ? JSON.stringify(body) : null
  });

  const text = await res.text();
  let json = {};
  try {
    json = JSON.parse(text);
  } catch (e) {
    json = { rawText: text };
  }
  return { status: res.status, data: json };
}

function checkSensitiveData(obj) {
  const keys = ["password", "passwordhash", "hash", "otp", "resettoken", "jwt", "credential"];
  const str = JSON.stringify(obj).toLowerCase();
  for (const k of keys) {
    if (str.includes(`"${k}"`)) {
      return k;
    }
  }
  return null;
}

const auditResults = [];
function recordAudit(item, status, note = "") {
  auditResults.push({ item, status, note });
  console.log(`${status === "PASS" ? "✅" : "❌"} [${item}] ${note}`);
}

async function runApiAudit(tokens) {
  console.log("\n--- Running Live Production API Audit ---");

  // 1. Generate Invite Token
  let r = await call(`/owner/properties/${tokens.propertyId}/resident-invite`, tokens.ownerToken, "POST");
  if (r.status === 201 && r.data.success && r.data.invite && r.data.invite.token) {
    recordAudit("API_GENERATE_INVITE", "PASS", "Token generated successfully.");
    createdRecords.invites.push(r.data.invite._id);
    const inviteToken = r.data.invite.token;

    // 2. Resolve Invite Token Publicly
    let r2 = await call(`/join-pg/${inviteToken}`, null, "GET");
    recordAudit("API_RESOLVE_INVITE", r2.status === 200 && r2.data.success && String(r2.data.invite.property._id) === String(tokens.propertyId) ? "PASS" : "FAIL", `Token resolution returned property ${r2.data.invite?.property?.propertyName}`);
    
    const rHtml = await fetch(`${BASE_FE.replace(/\/$/, "")}/join-pg/${inviteToken}`);
    const htmlText = await rHtml.text();
    recordAudit("ROUTE_WILDCARD_SERVE", rHtml.status === 200 && htmlText.includes("join-pg.js") ? "PASS" : "FAIL", "Serving join-pg.html for /join-pg/:token path.");
  } else {
    recordAudit("API_GENERATE_INVITE", "FAIL", `Failed to generate invite token. Status: ${r.status}, Body: ${JSON.stringify(r.data)}`);
  }

  // 2b. Test expired and revoked invite resolutions
  let rExp = await call(`/join-pg/${tokens.expiredToken}`, null, "GET");
  recordAudit("API_RESOLVE_EXPIRED_INVITE", rExp.status === 410 ? "PASS" : "FAIL", `Expired token resolution returned status ${rExp.status} (expected: 410)`);

  let rRev = await call(`/join-pg/${tokens.revokedToken}`, null, "GET");
  recordAudit("API_RESOLVE_REVOKED_INVITE", rRev.status === 404 ? "PASS" : "FAIL", `Revoked token resolution returned status ${rRev.status} (expected: 404)`);

  // 2c. Student Request Validations
  let rValRoom = await call("/residents/requests", tokens.studentToken, "POST", {
    property: tokens.propertyId,
    moveInDate: new Date(),
    residenceSource: "DIRECT_OWNER"
  });
  recordAudit("VALIDATION_MISSING_ROOM", rValRoom.status === 400 ? "PASS" : "FAIL", "Prevented request submission with missing room (status: 400).");

  let rValDate = await call("/residents/requests", tokens.studentToken, "POST", {
    property: tokens.propertyId,
    room: "101",
    moveInDate: "invalid-date",
    residenceSource: "DIRECT_OWNER"
  });
  recordAudit("VALIDATION_INVALID_DATE", rValDate.status === 400 ? "PASS" : "FAIL", "Prevented request submission with invalid move-in date format (status: 400).");

  let rValOutDate = await call("/residents/requests", tokens.studentToken, "POST", {
    property: tokens.propertyId,
    room: "101",
    moveInDate: new Date(),
    expectedMoveOutDate: new Date(Date.now() - 86400 * 1000), // yesterday
    residenceSource: "DIRECT_OWNER"
  });
  recordAudit("VALIDATION_INVALID_OUT_DATE", rValOutDate.status === 400 ? "PASS" : "FAIL", "Prevented request submission with expectedMoveOutDate before moveInDate (status: 400).");

  // 3. Submit Resident Request
  let r3 = await call("/residents/requests", tokens.studentToken, "POST", {
    property: tokens.propertyId,
    room: "B-201",
    bed: "Bed A",
    moveInDate: new Date(),
    residenceSource: "DIRECT_OWNER",
    message: "Production verification test"
  });

  let requestId;
  if (r3.status === 201 && r3.data.success && r3.data.request) {
    requestId = r3.data.request._id;
    createdRecords.requests.push(requestId);
    recordAudit("API_SUBMIT_REQUEST", "PASS", "Verification request submitted successfully.");

    const leakage = checkSensitiveData(r3.data.request);
    recordAudit("SENSITIVE_DATA_LEAK_CHECK", leakage === null ? "PASS" : "FAIL", leakage ? `Leaked sensitive field: ${leakage}` : "No sensitive fields leaked.");
  } else {
    recordAudit("API_SUBMIT_REQUEST", "FAIL", `Failed to submit request. Status: ${r3.status}, Body: ${JSON.stringify(r3.data)}`);
  }

  if (requestId) {
    // 4. Duplicate Request check
    let rDup = await call("/residents/requests", tokens.studentToken, "POST", {
      property: tokens.propertyId,
      room: "B-201",
      moveInDate: new Date(),
      residenceSource: "DIRECT_OWNER"
    });
    recordAudit("VALIDATION_DUPLICATE_REQUEST", rDup.status === 400 && !rDup.data.success ? "PASS" : "FAIL", "Prevented submitting duplicate pending requests.");

    // 5. Fetch my requests (Student)
    let rMy = await call("/residents/requests/my", tokens.studentToken, "GET");
    recordAudit("API_GET_MY_REQUESTS", rMy.status === 200 && rMy.data.success && rMy.data.requests.length > 0 ? "PASS" : "FAIL", `Retrieved ${rMy.data.requests?.length} student requests.`);

    // 6. Access Boundary: Other student should not access this request
    let rCrossStud = await call(`/residents/requests/${requestId}`, tokens.student2Token, "GET");
    recordAudit("AUTH_PROOF_DOCUMENT_STUDENT", rCrossStud.status === 403 || rCrossStud.status === 401 ? "PASS" : "FAIL", `Blocked other student access to request details. Status: ${rCrossStud.status}`);

    // 7. Access Boundary: Other owner should not view/moderate this request
    let rCrossOwner = await call(`/owner/resident-requests`, tokens.owner2Token, "GET");
    const foundInCrossOwner = rCrossOwner.data.requests && rCrossOwner.data.requests.some(req => String(req._id) === String(requestId));
    recordAudit("AUTH_OWNER_ISOLATION", !foundInCrossOwner ? "PASS" : "FAIL", "Owner can only view requests for their own properties.");

    let rCrossApprove = await call(`/owner/resident-requests/${requestId}/approve`, tokens.owner2Token, "POST");
    recordAudit("AUTH_OWNER_MODERATION_ISOLATION", rCrossApprove.status === 403 || rCrossApprove.status === 404 ? "PASS" : "FAIL", "Owner blocked from approving another owner's property request.");

    // 8. Owner Moderation List Requests
    let rOwnerReqs = await call("/owner/resident-requests", tokens.ownerToken, "GET");
    recordAudit("API_OWNER_GET_REQUESTS", rOwnerReqs.status === 200 && rOwnerReqs.data.success && rOwnerReqs.data.requests.length > 0 ? "PASS" : "FAIL", `Owner retrieved ${rOwnerReqs.data.requests?.length} pending requests.`);

    // 9. Approve Request
    let rApprove = await call(`/owner/resident-requests/${requestId}/approve`, tokens.ownerToken, "POST");
    if (rApprove.status === 200 && rApprove.data.success) {
      recordAudit("API_APPROVE_REQUEST", "PASS", "Owner approved request successfully.");

      const tenancies = await Tenancy.find({ student: tokens.studentId, property: tokens.propertyId });
      recordAudit("TENANCY_CREATION_RULE", tenancies.length === 1 && tenancies[0].status === "ACTIVE" ? "PASS" : "FAIL", `Active tenancy verified in database. Count: ${tenancies.length}`);
      if (tenancies[0]) {
        createdRecords.tenancies.push(tenancies[0]._id);
      }

      // 9b. Prevent request submission with existing active tenancy
      let rActiveTenancy = await call("/residents/requests", tokens.studentToken, "POST", {
        property: tokens.propertyId,
        room: "B-201",
        moveInDate: new Date(),
        residenceSource: "DIRECT_OWNER"
      });
      recordAudit("VALIDATION_ACTIVE_TENANCY_SUBMIT", rActiveTenancy.status === 400 ? "PASS" : "FAIL", "Prevented request submission when student already has an active tenancy (status: 400).");

      // 10. Cancellation block after approval
      let rCancel = await call(`/residents/requests/${requestId}`, tokens.studentToken, "DELETE");
      recordAudit("VALIDATION_CANCELLATION_RULE", rCancel.status === 400 ? "PASS" : "FAIL", "Student blocked from cancelling request after approval.");

      // 11. Duplicate approval block
      let rApproveDup = await call(`/owner/resident-requests/${requestId}/approve`, tokens.ownerToken, "POST");
      recordAudit("VALIDATION_DUPLICATE_APPROVAL", rApproveDup.status === 400 ? "PASS" : "FAIL", "Blocked duplicate approval for already approved request.");
    } else {
      recordAudit("API_APPROVE_REQUEST", "FAIL", `Failed to approve request. Status: ${rApprove.status}`);
    }

    // 12. Validate Dashboard tenancy data
    let rStudDash = await call("/student/dashboard-v3", tokens.studentToken, "GET");
    recordAudit("DASHBOARD_STUDENT_METRICS", rStudDash.status === 200 && rStudDash.data.activeTenancy ? "PASS" : "FAIL", "Student dashboard returns activeTenancy data.");

    let rOwnerDash = await call("/owner/dashboard-v3", tokens.ownerToken, "GET");
    recordAudit("DASHBOARD_OWNER_METRICS", rOwnerDash.status === 200 && rOwnerDash.data.statistics.activeStudents === 1 ? "PASS" : "FAIL", `Owner dashboard returns correct resident count (expected: 1, got: ${rOwnerDash.data.statistics.activeStudents}).`);
  }
}

async function runBrowserAudit() {
  console.log("\n--- Running Live Browser UI Audit with Puppeteer ---");
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  const failedRequests = [];

  page.on("console", msg => {
    if (msg.type() === "error") consoleErrors.push(msg.text());
    else if (msg.type() === "warning") consoleWarnings.push(msg.text());
  });

  page.on("requestfailed", req => {
    failedRequests.push(`${req.url()} (${req.failure().errorText})`);
  });

  const viewports = [320, 360, 390, 430, 768, 1024, 1440, 1920];
  let overflowPass = true;

  for (const width of viewports) {
    await page.setViewport({ width, height: 800 });
    await page.goto(BASE_FE, { waitUntil: "networkidle2" });
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth;
    });
    if (overflow) {
      overflowPass = false;
      console.log(`⚠️ Horizontal overflow detected at viewport width ${width}px`);
    }
  }
  recordAudit("RESPONSIVE_OVERFLOW_CHECK", overflowPass ? "PASS" : "FAIL", "Zero horizontal overflow confirmed across all requested viewports.");

  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(`${BASE_FE}/join-pg/invalid-token-123`, { waitUntil: "networkidle2" });
  const errorMsgText = await page.evaluate(() => {
    const el = document.getElementById("errorMsg");
    return el ? el.textContent : "";
  });
  recordAudit("FRONTEND_RESOLVE_INVITE_INVALID", errorMsgText.length > 0 ? "PASS" : "FAIL", `Invalid invite landing page displays error: "${errorMsgText}"`);

  const appConsoleErrors = consoleErrors.filter(err => err.includes("campora"));
  const appFailedRequests = failedRequests.filter(req => req.includes("campora"));

  if (consoleErrors.length > 0) {
    console.log("Detailed Browser Console Errors (all):", consoleErrors);
  }
  if (failedRequests.length > 0) {
    console.log("Detailed Browser Failed Requests (all):", failedRequests);
  }

  recordAudit("CONOSLE_ERRORS_AUDIT", appConsoleErrors.length === 0 ? "PASS" : "FAIL", `Found ${appConsoleErrors.length} application console errors (${consoleErrors.length} total).`);
  recordAudit("NETWORK_FAILURES_AUDIT", appFailedRequests.length === 0 ? "PASS" : "FAIL", `Found ${appFailedRequests.length} application network failures (${failedRequests.length} total).`);

  await browser.close();
}

async function main() {
  let tokens;
  try {
    tokens = await setupDB();
    await runApiAudit(tokens);
    await runBrowserAudit();
  } catch (err) {
    console.error("Audit Execution Error:", err);
  } finally {
    await cleanUp();
  }

  console.log("\n==============================================");
  console.log("CAMPORA JOIN PG PRODUCTION AUDIT SUMMARY");
  console.log("==============================================");
  let allPass = true;
  for (const r of auditResults) {
    console.log(`${r.status === "PASS" ? "🟢" : "🔴"} [${r.item}] ${r.note}`);
    if (r.status !== "PASS") allPass = false;
  }
  console.log("==============================================");
  if (allPass) {
    console.log("JOIN PG FEATURE — PRODUCTION READY");
  } else {
    console.log("AUDIT FAILED: PRODUCTION ISSUES DETECTED");
  }
}

main();
