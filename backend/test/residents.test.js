const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, "../.env") });

const app = require("../app");
const User = require("../models/User");
const Property = require("../models/Property");
const ResidentRequest = require("../models/ResidentRequest");
const Tenancy = require("../models/Tenancy");
const jwt = require("jsonwebtoken");

const JWT_SECRET = process.env.JWT_SECRET || "fallback_secret";
const PORT = 5099;
let server;
let studentToken;
let ownerToken;
let studentUser;
let ownerUser;
let testProperty;
let requestId;

async function setup() {
  console.log("Setting up integration test database records...");
  
  if (mongoose.connection.readyState === 0) {
    await mongoose.connect(process.env.MONGO_URI || "mongodb://127.0.0.1:27017/campora");
  }

  const testSuffix = "_test_residents";
  await User.deleteMany({ email: { $regex: testSuffix } });
  await Property.deleteMany({ propertyName: { $regex: testSuffix } });
  await ResidentRequest.deleteMany({});
  await Tenancy.deleteMany({});

  studentUser = await User.create({
    name: "Student Test",
    email: `student${testSuffix}@test.com`,
    password: "Password123!",
    role: "student",
    verified: true
  });

  ownerUser = await User.create({
    name: "Owner Test",
    email: `owner${testSuffix}@test.com`,
    password: "Password123!",
    role: "owner",
    verified: true,
    accountStatus: "ACTIVE"
  });

  studentToken = jwt.sign({ id: studentUser._id, role: "student" }, JWT_SECRET);
  ownerToken = jwt.sign({ id: ownerUser._id, role: "owner" }, JWT_SECRET);

  testProperty = await Property.create({
    propertyName: `PG Stay ${testSuffix}`,
    owner: ownerUser._id,
    address: "Test Street 1",
    city: "Bangalore",
    state: "Karnataka",
    zipCode: "560001",
    rent: 8000,
    deposit: 16000,
    sharing: "Double",
    gender: "Boys",
    propertyType: "PG",
    status: "approved",
    published: true,
    available: true
  });

  return new Promise((resolve) => {
    server = app.listen(PORT, () => {
      console.log(`Test server running on port ${PORT}`);
      resolve();
    });
  });
}

const base = `http://localhost:${PORT}/api`;

async function runTests() {
  let pass = 0, fail = 0;

  function assert(msg, ok) {
    if (ok) {
      console.log(`   PASS: ${msg}`);
      pass++;
    } else {
      console.log(`   FAIL: ${msg}`);
      fail++;
    }
  }

  try {
    // 1. Submit Resident Request (Student)
    let res = await fetch(`${base}/residents/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        property: testProperty._id,
        room: "101",
        bed: "Bed A",
        moveInDate: new Date(),
        residenceSource: "DIRECT_OWNER",
        message: "Hello owner"
      })
    });
    let data = await getJson(res);
    assert("Student submits resident request successfully", res.status === 201 && data.success && data.request);
    requestId = data.request?._id;

    // 2. Fetch requests (Student)
    res = await fetch(`${base}/residents/requests/my`, {
      headers: { "Authorization": `Bearer ${studentToken}` }
    });
    data = await getJson(res);
    assert("Student retrieves their resident requests", res.status === 200 && data.success && data.requests.length > 0);

    // 3. Fetch requests (Owner)
    res = await fetch(`${base}/owner/resident-requests`, {
      headers: { "Authorization": `Bearer ${ownerToken}` }
    });
    data = await getJson(res);
    assert("Owner retrieves requests for their properties", res.status === 200 && data.success && data.requests.length > 0);

    // 4. Submit duplicate request (Student) -> should be blocked
    res = await fetch(`${base}/residents/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${studentToken}`
      },
      body: JSON.stringify({
        property: testProperty._id,
        room: "101",
        residenceSource: "DIRECT_OWNER",
        moveInDate: new Date()
      })
    });
    data = await getJson(res);
    assert("Duplicate resident request submission is blocked", res.status === 400 && !data.success);

    // 5. Generate Resident Invite Token (Owner)
    res = await fetch(`${base}/owner/properties/${testProperty._id}/resident-invite`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${ownerToken}` }
    });
    data = await getJson(res);
    assert("Owner generates property invite link successfully", res.status === 201 && data.success && data.invite && data.invite.token);
    const token = data.invite.token;

    // 6. Resolve Invite Token Publicly
    res = await fetch(`${base}/join-pg/${token}`);
    data = await getJson(res);
    assert("Public resolve invite token matches property info", res.status === 200 && data.success && String(data.invite.property._id) === String(testProperty._id));

    // 7. Approve Resident Request (Owner)
    res = await fetch(`${base}/owner/resident-requests/${requestId}/approve`, {
      method: "POST",
      headers: { "Authorization": `Bearer ${ownerToken}` }
    });
    data = await getJson(res);
    assert("Owner approves resident request successfully", res.status === 200 && data.success);

    // 8. Verify Active Tenancy Created
    const tenancy = await Tenancy.findOne({ student: studentUser._id, property: testProperty._id });
    assert("Active tenancy record is created after approval", tenancy && tenancy.status === "ACTIVE" && tenancy.room === "101");

    // 9. Cancellation block after approval (Student)
    res = await fetch(`${base}/residents/requests/${requestId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${studentToken}` }
    });
    data = await getJson(res);
    assert("Cannot cancel request after it has been approved", res.status === 400 && !data.success);

  } catch (err) {
    console.error("Test execution threw error:", err);
  }

  console.log(`\n=== Test Results: ${pass} passed, ${fail} failed ===`);
  if (fail > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

async function main() {
  await setup();
  await runTests();
}

async function getJson(res) {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch (err) {
    console.error(`Failed to parse JSON (Status: ${res.status}). Body text:\n`, text);
    throw err;
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
