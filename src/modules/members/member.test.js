"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const { connectDB, disconnectDB } = require("../../config/database");
const app = require("../../app");
const Member = require("./member.model");
const Batch = require("../batches/batch.model");
const MembershipPlan = require("../membership-plans/plan.model");

describe("Phase 3 — Members Module Integration Suite", () => {
  const testBatchId = "BATCH-TEST-01";
  const testPlanId = "plan-quarterly";
  let createdMemberId = null;
  const testEmail = `test.member.${Date.now()}@strengthway.test`;
  const testMobile = `9840${Math.floor(100000 + Math.random() * 900000)}`;

  beforeAll(async () => {
    await connectDB();
    await Member.deleteMany({ email: { $regex: /@strengthway\.test$/ } });

    // Setup a test batch
    await Batch.findOneAndUpdate(
      { id: testBatchId },
      {
        id: testBatchId,
        name: "Test Morning Batch",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
        timingLabel: "06:00 AM - 07:00 AM",
        daysPattern: "MWF",
        daysLabel: "Mon, Wed, Fri",
        maxPax: 30,
        currentPax: 0,
        status: "Active",
      },
      { upsert: true, returnDocument: "after" }
    );

    // Setup a test plan
    await MembershipPlan.findOneAndUpdate(
      { id: testPlanId },
      {
        id: testPlanId,
        name: "Quarterly Pro",
        durationMonths: 3,
        price: 18000,
        formattedPrice: "₹18,000",
        status: "Active",
      },
      { upsert: true, returnDocument: "after" }
    );
  });

  afterAll(async () => {
    // Clean up test data
    await Member.deleteMany({ email: { $regex: /@strengthway\.test$/ } });
    await Batch.deleteOne({ id: testBatchId });
    await disconnectDB();
  });

  // ── 1. Create Member (POST /api/v1/members)
  test("POST /api/v1/members — registers a new member with valid payload", async () => {
    const payload = {
      firstName: "Rohan",
      lastName: "Kapoor",
      email: testEmail,
      mobile: testMobile,
      gender: "Male",
      dob: "1995-05-15",
      height: 175,
      weight: 72,
      bloodGroup: "O+",
      address: "123 Indiranagar 100ft Road",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      pincode: "560038",
      emergencyName: "Ananya Kapoor",
      emergencyRelationship: "Spouse",
      emergencyNumber: "9840112233",
      bio: "Software engineer aiming for barbell strength and conditioning.",
      batchId: testBatchId,
      paymentPlanId: testPlanId,
      paymentMethod: "UPI",
    };

    const res = await request(app).post("/api/v1/members").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toMatch(/^MEM-\d+$/);
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data.status).toBe("Active");
    expect(res.body.data.physicalStats.bmi).toBe("23.5");
    expect(res.body.data.batchId).toBe(testBatchId);
    expect(res.body.data.membershipPlan.id).toBe(testPlanId);

    createdMemberId = res.body.data.id;
  });

  // ── 2. Validation: Underage Rejection
  test("POST /api/v1/members — rejects registration if age is under 18", async () => {
    const payload = {
      firstName: "Minor",
      lastName: "User",
      email: `minor.${Date.now()}@strengthway.test`,
      mobile: "9840999888",
      gender: "Male",
      dob: "2015-01-01", // under 18
      address: "Some address",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      emergencyName: "Parent",
      emergencyNumber: "9840111111",
    };

    const res = await request(app).post("/api/v1/members").send(payload);
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  // ── 3. Conflict: Duplicate Email
  test("POST /api/v1/members — rejects duplicate email with 409 Conflict", async () => {
    const duplicatePayload = {
      firstName: "Duplicate",
      lastName: "User",
      email: testEmail, // same email
      mobile: "9840111222",
      gender: "Female",
      dob: "1994-01-01",
      address: "Another address",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560001",
      emergencyName: "Emergency Person",
      emergencyNumber: "9840111111",
    };

    const res = await request(app).post("/api/v1/members").send(duplicatePayload);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // ── 4. Get All Members (GET /api/v1/members)
  test("GET /api/v1/members — returns paginated list of members", async () => {
    const res = await request(app).get("/api/v1/members?page=1&pageSize=5");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  // ── 5. Get Member By ID (GET /api/v1/members/:id)
  test("GET /api/v1/members/:id — retrieves specific member", async () => {
    const res = await request(app).get(`/api/v1/members/${createdMemberId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdMemberId);
  });

  // ── 6. Update Member (PUT /api/v1/members/:id)
  test("PUT /api/v1/members/:id — updates member details and recalculates BMI", async () => {
    const res = await request(app)
      .put(`/api/v1/members/${createdMemberId}`)
      .send({ weight: 80 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.physicalStats.weight).toBe("80 kg");
    expect(res.body.data.physicalStats.bmi).toBe("26.1");
  });

  // ── 7. Toggle Status (PATCH /api/v1/members/:id/toggle-status)
  test("PATCH /api/v1/members/:id/toggle-status — toggles Active to Inactive and back", async () => {
    const res1 = await request(app).patch(`/api/v1/members/${createdMemberId}/toggle-status`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe("Inactive");

    const res2 = await request(app).patch(`/api/v1/members/${createdMemberId}/toggle-status`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe("Active");
  });

  // ── 8. Soft-Delete (PATCH /api/v1/members/:id/soft-delete)
  test("PATCH /api/v1/members/:id/soft-delete — archives member", async () => {
    const res = await request(app).patch(`/api/v1/members/${createdMemberId}/soft-delete`);
    expect(res.status).toBe(200);
    expect(res.body.data.isDeleted).toBe(true);
    expect(res.body.data.status).toBe("Archived");
  });

  // ── 9. Restore (PATCH /api/v1/members/:id/restore)
  test("PATCH /api/v1/members/:id/restore — restores archived member", async () => {
    const res = await request(app).patch(`/api/v1/members/${createdMemberId}/restore`);
    expect(res.status).toBe(200);
    expect(res.body.data.isDeleted).toBe(false);
    expect(res.body.data.status).toBe("Active");
  });

  // ── 10. Lead Creation & Conversion
  test("PATCH /api/v1/members/:id/convert — converts Lead member to Active", async () => {
    const leadEmail = `lead.${Date.now()}@strengthway.test`;
    // Create member in Lead status
    const leadRes = await request(app).post("/api/v1/members").send({
      firstName: "Pooja",
      lastName: "Bose",
      email: leadEmail,
      mobile: `9840${Math.floor(100000 + Math.random() * 900000)}`,
      gender: "Female",
      dob: "1998-07-20",
      address: "Park View Road",
      city: "Bengaluru",
      state: "Karnataka",
      pincode: "560002",
      emergencyName: "Relative",
      emergencyNumber: "9840222333",
      status: "Lead",
    });

    const leadId = leadRes.body.data.id;
    expect(leadRes.body.data.status).toBe("Lead");

    // Convert Lead
    const convertRes = await request(app)
      .patch(`/api/v1/members/${leadId}/convert`)
      .send({
        paymentPlanId: testPlanId,
        paymentMethod: "Card",
        paymentAmount: 18000,
        batchId: testBatchId,
      });

    expect(convertRes.status).toBe(200);
    expect(convertRes.body.data.status).toBe("Active");
    expect(convertRes.body.data.convertedAt).toBeDefined();
    expect(convertRes.body.data.membershipPlan.id).toBe(testPlanId);
    expect(convertRes.body.data.paymentDetails.method).toBe("Card");

    // Clean up
    await Member.deleteOne({ id: leadId });
  });

  // ── 11. Permanent Delete (DELETE /api/v1/members/:id)
  test("DELETE /api/v1/members/:id — permanently removes member", async () => {
    const res = await request(app).delete(`/api/v1/members/${createdMemberId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    // Verify lookup returns 404
    const checkRes = await request(app).get(`/api/v1/members/${createdMemberId}`);
    expect(checkRes.status).toBe(404);
  });
});

