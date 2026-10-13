"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const { connectDB, disconnectDB } = require("../../config/database");
const app = require("../../app");
const Inquiry = require("./inquiry.model");

describe("Inquiries Module Integration Suite", () => {
  const testInquiryId = `INQ-TEST-${Date.now().toString().slice(-4)}`;

  beforeAll(async () => {
    await connectDB();
    await Inquiry.deleteOne({ id: testInquiryId });
  });

  afterAll(async () => {
    await Inquiry.deleteOne({ id: testInquiryId });
    await disconnectDB();
  });

  // ── 1. Create Inquiry (POST /api/v1/inquiries)
  test("POST /api/v1/inquiries — creates a new inquiry with valid payload", async () => {
    const payload = {
      id: testInquiryId,
      name: "Marcus Aurelius",
      gender: "Male",
      mobile: "+91 9876543210",
      email: "marcus.inquiry.test@example.com",
      address: "123 Rome Way, Suite 4",
      subject: "Personal Training Inquiry",
      message: "Interested in strength progression and mobility coaching.",
      status: "Inquiry",
    };

    const res = await request(app).post("/api/v1/inquiries").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testInquiryId);
    expect(res.body.data.name).toBe("Marcus Aurelius");
    expect(res.body.data.status).toBe("Inquiry");
    expect(res.body.data.isDeleted).toBe(false);
  });

  // ── 2. Create Inquiry Validation (POST /api/v1/inquiries)
  test("POST /api/v1/inquiries — returns 422 if required fields are missing", async () => {
    const res = await request(app).post("/api/v1/inquiries").send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.errors).toBeDefined();
  });

  // ── 3. List Inquiries (GET /api/v1/inquiries)
  test("GET /api/v1/inquiries — returns list of inquiries and supports search", async () => {
    const res = await request(app).get("/api/v1/inquiries?search=Marcus");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    const found = res.body.data.find((i) => i.id === testInquiryId);
    expect(found).toBeDefined();
    expect(found.name).toBe("Marcus Aurelius");
  });

  // ── 4. Get by ID (GET /api/v1/inquiries/:id)
  test("GET /api/v1/inquiries/:id — returns the specific inquiry", async () => {
    const res = await request(app).get(`/api/v1/inquiries/${testInquiryId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testInquiryId);
    expect(res.body.data.email).toBe("marcus.inquiry.test@example.com");
  });

  // ── 5. Update Inquiry (PUT /api/v1/inquiries/:id)
  test("PUT /api/v1/inquiries/:id — updates inquiry fields", async () => {
    const updates = {
      subject: "Updated Consultation Request",
      message: "Please schedule an appointment for Friday.",
    };

    const res = await request(app).put(`/api/v1/inquiries/${testInquiryId}`).send(updates);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subject).toBe("Updated Consultation Request");
    expect(res.body.data.message).toBe("Please schedule an appointment for Friday.");
  });

  // ── 6. Record Contact Interaction (POST /api/v1/inquiries/:id/contact)
  test("POST /api/v1/inquiries/:id/contact — records interaction and advances status to Contacted", async () => {
    const contactPayload = {
      contactMethod: "Phone Call",
      contactNotes: "Spoke with client regarding barbell coaching and functional training.",
      contactedBy: "Head Trainer",
      outcome: "Interested - Converting Soon",
    };

    const res = await request(app)
      .post(`/api/v1/inquiries/${testInquiryId}/contact`)
      .send(contactPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("Contacted");
    expect(res.body.data.contactDetails.contactNotes).toBe(contactPayload.contactNotes);
    expect(res.body.data.statusHistory.length).toBeGreaterThan(0);
  });

  // ── 7. Archive Inquiry (PATCH /api/v1/inquiries/:id/archive)
  test("PATCH /api/v1/inquiries/:id/archive — archives unconfirmed inquiry", async () => {
    const res = await request(app)
      .patch(`/api/v1/inquiries/${testInquiryId}/archive`)
      .send({ reason: "Client decided to join later" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("Archived");
  });

  // ── 8. Update Status (PATCH /api/v1/inquiries/:id/status)
  test("PATCH /api/v1/inquiries/:id/status — updates inquiry status", async () => {
    const res = await request(app)
      .patch(`/api/v1/inquiries/${testInquiryId}/status`)
      .send({ status: "Inquiry" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("Inquiry");
  });

  // ── 7. Soft Delete (PATCH /api/v1/inquiries/:id/soft-delete)
  test("PATCH /api/v1/inquiries/:id/soft-delete — soft deletes the inquiry", async () => {
    const res = await request(app).patch(`/api/v1/inquiries/${testInquiryId}/soft-delete`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isDeleted).toBe(true);
    expect(res.body.data.deletedAt).toBeDefined();
  });

  // ── 8. Restore (PATCH /api/v1/inquiries/:id/restore)
  test("PATCH /api/v1/inquiries/:id/restore — restores the soft deleted inquiry", async () => {
    const res = await request(app).patch(`/api/v1/inquiries/${testInquiryId}/restore`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.isDeleted).toBe(false);
  });

  // ── 9. Permanent Delete (DELETE /api/v1/inquiries/:id)
  test("DELETE /api/v1/inquiries/:id — permanently deletes the inquiry", async () => {
    const res = await request(app).delete(`/api/v1/inquiries/${testInquiryId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const checkRes = await request(app).get(`/api/v1/inquiries/${testInquiryId}`);
    expect(checkRes.status).toBe(404);
  });
});
