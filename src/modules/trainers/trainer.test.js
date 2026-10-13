"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const { connectDB, disconnectDB } = require("../../config/database");
const app = require("../../app");
const Trainer = require("./trainer.model");

describe("Phase 4 — Trainers Module Integration Suite", () => {
  let createdTrainerId = null;
  const testEmail = `test.trainer.${Date.now()}@strengthway.test`;
  const testPhone = `9820${Math.floor(100000 + Math.random() * 900000)}`;

  beforeAll(async () => {
    await connectDB();
    await Trainer.deleteMany({ email: { $regex: /@strengthway\.test$/ } });
  });

  afterAll(async () => {
    await Trainer.deleteMany({ email: { $regex: /@strengthway\.test$/ } });
    await disconnectDB();
  });

  // ── 1. Create Trainer (POST /api/v1/trainers)
  test("POST /api/v1/trainers — creates a new trainer with valid payload", async () => {
    const payload = {
      name: "Marcus Aurelius Vance",
      gender: "Male",
      experience: "8 Years",
      phone: testPhone,
      email: testEmail,
      shift: "Morning (06:00 - 14:00)",
      bio: "Former national weightlifting competitor specializing in clean & jerk, snatch technique, and compound hypertrophy splits.",
      quote: "Technique is the foundation of true power.",
      certifications: ["USAW Level 2 Coach", "CSCS Certified", "ISSA Master Trainer"],
      programs: ["Barbell Strength", "Hypertrophy Foundations"],
      batchIds: ["BATCH-01", "BATCH-02"],
    };

    const res = await request(app).post("/api/v1/trainers").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toMatch(/^TRN-\d+$/);
    expect(res.body.data.name).toBe("Marcus Aurelius Vance");
    expect(res.body.data.email).toBe(testEmail);
    expect(res.body.data.status).toBe("Active");
    expect(res.body.data.batchIds).toContain("BATCH-01");
    expect(res.body.data.stats).toBeDefined();

    createdTrainerId = res.body.data.id;
  });

  // ── 2. Validation: Missing Required Fields
  test("POST /api/v1/trainers — rejects request missing required fields with 422", async () => {
    const payload = {
      name: "Incomplete Trainer",
      // missing email, phone, bio, experience
    };

    const res = await request(app).post("/api/v1/trainers").send(payload);
    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ field: "email" }),
        expect.objectContaining({ field: "phone" }),
        expect.objectContaining({ field: "bio" }),
        expect.objectContaining({ field: "experience" }),
      ])
    );
  });

  // ── 3. Conflict: Duplicate Email
  test("POST /api/v1/trainers — rejects duplicate email with 409 Conflict", async () => {
    const duplicatePayload = {
      name: "Another Trainer",
      email: testEmail,
      phone: "9820999888",
      experience: "3 Years",
      bio: "Experienced functional fitness and kettlebell trainer.",
    };

    const res = await request(app).post("/api/v1/trainers").send(duplicatePayload);
    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toMatch(/already exists/i);
  });

  // ── 4. Get All Trainers (GET /api/v1/trainers)
  test("GET /api/v1/trainers — returns paginated list of trainers", async () => {
    const res = await request(app).get("/api/v1/trainers?page=1&pageSize=10");
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.pagination).toBeDefined();
    expect(res.body.pagination.page).toBe(1);
  });

  // ── 5. Get Trainer By ID (GET /api/v1/trainers/:id)
  test("GET /api/v1/trainers/:id — retrieves specific trainer", async () => {
    const res = await request(app).get(`/api/v1/trainers/${createdTrainerId}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(createdTrainerId);
  });

  // ── 6. Update Trainer (PUT /api/v1/trainers/:id)
  test("PUT /api/v1/trainers/:id — updates shift and experience", async () => {
    const res = await request(app)
      .put(`/api/v1/trainers/${createdTrainerId}`)
      .send({
        shift: "Evening (14:00 - 22:00)",
        experience: "9 Years",
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.shift).toBe("Evening (14:00 - 22:00)");
    expect(res.body.data.experience).toBe("9 Years");
  });

  // ── 7. Toggle Status (PATCH /api/v1/trainers/:id/toggle-status)
  test("PATCH /api/v1/trainers/:id/toggle-status — toggles Active to Inactive and back", async () => {
    const res1 = await request(app).patch(`/api/v1/trainers/${createdTrainerId}/toggle-status`);
    expect(res1.status).toBe(200);
    expect(res1.body.data.status).toBe("Inactive");

    const res2 = await request(app).patch(`/api/v1/trainers/${createdTrainerId}/toggle-status`);
    expect(res2.status).toBe(200);
    expect(res2.body.data.status).toBe("Active");
  });

  // ── 8. Sync Batches (PATCH /api/v1/trainers/:id/sync-batches)
  test("PATCH /api/v1/trainers/:id/sync-batches — synchronizes trainer assigned batch IDs", async () => {
    const newBatches = ["BATCH-03", "BATCH-04"];
    const res = await request(app)
      .patch(`/api/v1/trainers/${createdTrainerId}/sync-batches`)
      .send({ batchIds: newBatches });

    expect(res.status).toBe(200);
    expect(res.body.data.batchIds).toEqual(newBatches);
  });

  // ── 9. Soft-Delete (PATCH /api/v1/trainers/:id/soft-delete)
  test("PATCH /api/v1/trainers/:id/soft-delete — deactivates trainer", async () => {
    const res = await request(app).patch(`/api/v1/trainers/${createdTrainerId}/soft-delete`);
    expect(res.status).toBe(200);
    expect(res.body.data.isDeleted).toBe(true);
    expect(res.body.data.status).toBe("Inactive");
  });

  // ── 10. Restore (PATCH /api/v1/trainers/:id/restore)
  test("PATCH /api/v1/trainers/:id/restore — restores trainer to Active", async () => {
    const res = await request(app).patch(`/api/v1/trainers/${createdTrainerId}/restore`);
    expect(res.status).toBe(200);
    expect(res.body.data.isDeleted).toBe(false);
    expect(res.body.data.status).toBe("Active");
  });

  // ── 11. Permanent Delete (DELETE /api/v1/trainers/:id)
  test("DELETE /api/v1/trainers/:id — permanently removes trainer", async () => {
    const res = await request(app).delete(`/api/v1/trainers/${createdTrainerId}`);
    expect(res.status).toBe(200);
    expect(res.body.data.deleted).toBe(true);

    const checkRes = await request(app).get(`/api/v1/trainers/${createdTrainerId}`);
    expect(checkRes.status).toBe(404);
  });
});
