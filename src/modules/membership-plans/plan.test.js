"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const { connectDB, disconnectDB } = require("../../config/database");
const app = require("../../app");
const MembershipPlan = require("./plan.model");

describe("Membership Plans Module Integration Suite", () => {
  const testPlanId = `plan-test-${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    await connectDB();
    await MembershipPlan.deleteOne({ id: testPlanId });
  });

  afterAll(async () => {
    await MembershipPlan.deleteOne({ id: testPlanId });
    await disconnectDB();
  });

  // ── 1. Create Plan (POST /api/v1/plans)
  test("POST /api/v1/plans — creates a new plan with valid payload", async () => {
    const payload = {
      id: testPlanId,
      name: "Test Ultimate Athlete Plan",
      durationMonths: 6,
      price: 24000,
      period: "/6mo",
      description: "6-month comprehensive strength curriculum with athlete recovery.",
      badge: "Best Value",
      popular: true,
      features: ["All batch access", "Nutrition guidance", "Locker access"],
    };

    const res = await request(app).post("/api/v1/plans").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testPlanId);
    expect(res.body.data.name).toBe("Test Ultimate Athlete Plan");
    expect(res.body.data.price).toBe(24000);
    expect(res.body.data.formattedPrice).toBe("₹24,000");
    expect(res.body.data.popular).toBe(true);
  });

  // ── 2. Validation: Missing required fields (422)
  test("POST /api/v1/plans — rejects plan missing required fields with 422", async () => {
    const res = await request(app).post("/api/v1/plans").send({ description: "Missing name and price" });
    expect(res.status).toBe(422);
  });

  // ── 3. GET /api/v1/plans
  test("GET /api/v1/plans — returns all active membership plans", async () => {
    const res = await request(app).get("/api/v1/plans");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((p) => p.id === testPlanId)).toBe(true);
  });

  // ── 4. GET /api/v1/plans/:id
  test("GET /api/v1/plans/:id — retrieves specific plan by ID", async () => {
    const res = await request(app).get(`/api/v1/plans/${testPlanId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testPlanId);
    expect(res.body.data.name).toBe("Test Ultimate Athlete Plan");
  });

  // ── 5. PUT /api/v1/plans/:id — updates plan
  test("PUT /api/v1/plans/:id — updates plan details and formatted price", async () => {
    const updates = {
      name: "Test Ultimate Athlete Plan (Updated)",
      price: 26000,
      description: "Updated description for test plan.",
    };

    const res = await request(app).put(`/api/v1/plans/${testPlanId}`).send(updates);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Test Ultimate Athlete Plan (Updated)");
    expect(res.body.data.price).toBe(26000);
    expect(res.body.data.formattedPrice).toBe("₹26,000");
  });

  // ── 6. PATCH /api/v1/plans/:id/toggle-status
  test("PATCH /api/v1/plans/:id/toggle-status — toggles Active to Inactive and back", async () => {
    const res1 = await request(app).patch(`/api/v1/plans/${testPlanId}/toggle-status`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe("Inactive");

    const res2 = await request(app).patch(`/api/v1/plans/${testPlanId}/toggle-status`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe("Active");
  });

  // ── 7. PATCH /api/v1/plans/:id/soft-delete & restore
  test("PATCH /api/v1/plans/:id/soft-delete and restore — archives and unarchives plan", async () => {
    const delRes = await request(app).patch(`/api/v1/plans/${testPlanId}/soft-delete`);
    expect(delRes.status).toBe(200);
    expect(delRes.body.data.isDeleted).toBe(true);

    const restoreRes = await request(app).patch(`/api/v1/plans/${testPlanId}/restore`);
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.data.isDeleted).toBe(false);
  });

  // ── 8. DELETE /api/v1/plans/:id — permanent deletion
  test("DELETE /api/v1/plans/:id — permanently removes plan", async () => {
    const res = await request(app).delete(`/api/v1/plans/${testPlanId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const getRes = await request(app).get(`/api/v1/plans/${testPlanId}`);
    expect(getRes.status).toBe(404);
  });
});
