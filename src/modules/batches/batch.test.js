"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const { connectDB, disconnectDB } = require("../../config/database");
const app = require("../../app");
const Batch = require("./batch.model");
const CoachShift = require("./coachShift.model");
const ScheduledClass = require("./scheduledClass.model");

describe("Batches Module Integration Suite", () => {
  const testBatchId = `BATCH-TEST-${Date.now().toString().slice(-4)}`;
  let testClassId = null;

  beforeAll(async () => {
    await connectDB();
    await Batch.deleteOne({ id: testBatchId });
  });

  afterAll(async () => {
    await Batch.deleteOne({ id: testBatchId });
    if (testClassId) {
      await ScheduledClass.deleteOne({ id: testClassId });
    }
    await disconnectDB();
  });

  // ── 1. Create Batch (POST /api/v1/batches)
  test("POST /api/v1/batches — creates a new batch with valid payload", async () => {
    const payload = {
      id: testBatchId,
      name: "TEST BATCH POWER",
      shortName: "Test Power",
      startTime: "07:00 AM",
      endTime: "08:00 AM",
      daysPattern: "MWF",
      maxPax: 25,
      status: "Active",
      description: "Integration test power batch.",
      trainerIds: ["TRN-101"],
    };

    const res = await request(app).post("/api/v1/batches").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testBatchId);
    expect(res.body.data.name).toBe("TEST BATCH POWER");
    expect(res.body.data.daysList).toEqual(["Monday", "Wednesday", "Friday"]);
    expect(res.body.data.timingLabel).toBe("07:00 AM - 08:00 AM");
  });

  // ── 2. Reject duplicate ID
  test("POST /api/v1/batches — rejects duplicate batch ID with 409", async () => {
    const payload = {
      id: testBatchId,
      name: "DUPLICATE BATCH",
      startTime: "07:00 AM",
      endTime: "08:00 AM",
    };

    const res = await request(app).post("/api/v1/batches").send(payload);
    expect(res.status).toBe(409);
  });

  // ── 3. GET /api/v1/batches
  test("GET /api/v1/batches — returns all batches", async () => {
    const res = await request(app).get("/api/v1/batches");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((b) => b.id === testBatchId)).toBe(true);
  });

  // ── 4. GET /api/v1/batches/:id
  test("GET /api/v1/batches/:id — retrieves single batch by ID", async () => {
    const res = await request(app).get(`/api/v1/batches/${testBatchId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(testBatchId);
  });

  // ── 5. PUT /api/v1/batches/:id — update batch
  test("PUT /api/v1/batches/:id — updates batch details", async () => {
    const updates = {
      name: "TEST BATCH POWER (UPDATED)",
      maxPax: 30,
      daysPattern: "TTS",
      description: "Updated description for test batch.",
    };

    const res = await request(app).put(`/api/v1/batches/${testBatchId}`).send(updates);
    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("TEST BATCH POWER (UPDATED)");
    expect(res.body.data.maxPax).toBe(30);
    expect(res.body.data.daysPattern).toBe("TTS");
    expect(res.body.data.daysList).toEqual(["Tuesday", "Thursday", "Saturday"]);
  });

  // ── 6. PATCH /api/v1/batches/:id/toggle-status
  test("PATCH /api/v1/batches/:id/toggle-status — toggles Active to Inactive and back", async () => {
    const res1 = await request(app).patch(`/api/v1/batches/${testBatchId}/toggle-status`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe("Inactive");

    const res2 = await request(app).patch(`/api/v1/batches/${testBatchId}/toggle-status`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe("Active");
  });

  // ── 7. Enroll & Unenroll Member
  test("PATCH /api/v1/batches/:id/enroll & unenroll — updates member list and pax count", async () => {
    const memberId = "MEM-TEST-999";

    const enrollRes = await request(app)
      .patch(`/api/v1/batches/${testBatchId}/enroll`)
      .send({ memberId });
    expect(enrollRes.status).toBe(200);
    expect(enrollRes.body.data.memberIds).toContain(memberId);
    expect(enrollRes.body.data.currentPax).toBeGreaterThanOrEqual(1);

    const unenrollRes = await request(app)
      .patch(`/api/v1/batches/${testBatchId}/unenroll`)
      .send({ memberId });
    expect(unenrollRes.status).toBe(200);
    expect(unenrollRes.body.data.memberIds).not.toContain(memberId);
  });

  // ── 8. Sync Trainers
  test("PATCH /api/v1/batches/:id/sync-trainers — synchronizes batch trainer IDs", async () => {
    const trainerIds = ["TRN-101", "TRN-103"];
    const res = await request(app)
      .patch(`/api/v1/batches/${testBatchId}/sync-trainers`)
      .send({ trainerIds });
    expect(res.status).toBe(200);
    expect(res.body.data.trainerIds).toEqual(trainerIds);
  });

  // ── 9. Coach Shifts
  test("GET /api/v1/batches/coach-shifts — retrieves coach shift matrix", async () => {
    const res = await request(app).get("/api/v1/batches/coach-shifts");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(5);
  });

  test("PATCH /api/v1/batches/coach-shifts/toggle — toggles a shift slot for a coach", async () => {
    const coachId = "TRN-101";
    const slotKey = "6_30_pm_mwf";

    const res = await request(app)
      .patch("/api/v1/batches/coach-shifts/toggle")
      .send({ coachId, slotKey });
    expect(res.status).toBe(200);
    expect(res.body.data.coachId).toBe(coachId);
    expect(res.body.data.shifts).toBeDefined();
  });

  // ── 10. Scheduled Classes
  test("GET /api/v1/batches/classes — retrieves all classes", async () => {
    const res = await request(app).get("/api/v1/batches/classes");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(18);
  });

  test("POST /api/v1/batches/:id/classes — creates a class for a batch", async () => {
    const classPayload = {
      day: "Monday",
      title: "Test Athletic Power Class",
      category: "Functional Fitness",
      focus: "Compound explosive training",
      intensity: "High",
      room: "Rig Area",
      coachName: "Dolliee Ellens",
      time: "07:00 AM - 08:00 AM",
    };

    const res = await request(app)
      .post(`/api/v1/batches/${testBatchId}/classes`)
      .send(classPayload);
    expect(res.status).toBe(201);
    expect(res.body.data.batchId).toBe(testBatchId);
    expect(res.body.data.title).toBe("Test Athletic Power Class");

    testClassId = res.body.data.id;
  });

  test("GET /api/v1/batches/:id/classes — retrieves classes for specific batch", async () => {
    const res = await request(app).get(`/api/v1/batches/${testBatchId}/classes`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.some((c) => c.id === testClassId)).toBe(true);
  });

  test("PUT /api/v1/batches/:id/classes/:classId — updates a scheduled class", async () => {
    const updates = {
      title: "Test Athletic Power Class (Updated)",
      intensity: "Medium",
    };

    const res = await request(app)
      .put(`/api/v1/batches/${testBatchId}/classes/${testClassId}`)
      .send(updates);
    expect(res.status).toBe(200);
    expect(res.body.data.title).toBe("Test Athletic Power Class (Updated)");
    expect(res.body.data.intensity).toBe("Medium");
  });

  test("DELETE /api/v1/batches/:id/classes/:classId — deletes a scheduled class", async () => {
    const res = await request(app).delete(
      `/api/v1/batches/${testBatchId}/classes/${testClassId}`
    );
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);
    testClassId = null;
  });

  // ── 11. Delete Batch
  test("DELETE /api/v1/batches/:id — deletes batch", async () => {
    const res = await request(app).delete(`/api/v1/batches/${testBatchId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const getRes = await request(app).get(`/api/v1/batches/${testBatchId}`);
    expect(getRes.status).toBe(404);
  });
});
