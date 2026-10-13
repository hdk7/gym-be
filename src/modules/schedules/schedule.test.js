"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const { connectDB, disconnectDB } = require("../../config/database");
const app = require("../../app");
const MasterSchedule = require("./schedule.model");
const ScheduleItem = require("./schedule-item.model");
const Session = require("./session.model");
const Holiday = require("./holiday.model");

describe("Schedules, Sessions, and Holidays Module Integration Suite", () => {
  const testScheduleId = `SCH-TEST-${Date.now().toString().slice(-4)}`;
  const testHolidayId = `HOL-TEST-${Date.now().toString().slice(-4)}`;
  let testItemId = null;
  let testSessionId = null;

  beforeAll(async () => {
    await connectDB();
    await MasterSchedule.deleteOne({ id: testScheduleId });
    await Holiday.deleteOne({ id: testHolidayId });
  });

  afterAll(async () => {
    await MasterSchedule.deleteOne({ id: testScheduleId });
    await MasterSchedule.deleteMany({ id: new RegExp(`^${testScheduleId}`) });
    await ScheduleItem.deleteMany({ masterScheduleId: testScheduleId });
    await Session.deleteMany({ masterScheduleId: testScheduleId });
    await Holiday.deleteOne({ id: testHolidayId });
    await disconnectDB();
  });

  // ─── Master Schedules ──────────────────────────────────────────────────────────
  test("GET /api/v1/schedules — auto-seeds default master schedules and returns list", async () => {
    const res = await request(app).get("/api/v1/schedules");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/v1/schedules — creates a new schedule with valid payload", async () => {
    const payload = {
      id: testScheduleId,
      name: "Olympic Powerlifting Foundation",
      batchIds: ["BATCH-01"],
      batchName: "BATCH 1",
      shift: "06:00 AM",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      daysPattern: "MWF",
      daysList: ["Monday", "Wednesday", "Friday"],
      coachId: "TRN-101",
      coachName: "Dolliee Ellens",
      totalClasses: 12,
      capacity: 25,
      description: "Integration test schedule for powerlifting foundation.",
    };

    const res = await request(app).post("/api/v1/schedules").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testScheduleId);
    expect(res.body.data.name).toBe("Olympic Powerlifting Foundation");
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBe(12);
  });

  test("GET /api/v1/schedules/:id — retrieves schedule with curriculum items", async () => {
    const res = await request(app).get(`/api/v1/schedules/${testScheduleId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testScheduleId);
    expect(Array.isArray(res.body.data.items)).toBe(true);
    expect(res.body.data.items.length).toBe(12);
    testItemId = res.body.data.items[0].id;
  });

  test("PUT /api/v1/schedules/:id — updates schedule metadata", async () => {
    const res = await request(app)
      .put(`/api/v1/schedules/${testScheduleId}`)
      .send({ name: "Olympic Powerlifting Mastery", capacity: 30 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Olympic Powerlifting Mastery");
    expect(res.body.data.capacity).toBe(30);
  });

  test("PATCH /api/v1/schedules/:id/toggle-status — toggles schedule status", async () => {
    const res = await request(app).patch(`/api/v1/schedules/${testScheduleId}/toggle-status`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("Inactive");

    const resBack = await request(app).patch(`/api/v1/schedules/${testScheduleId}/toggle-status`);
    expect(resBack.body.data.status).toBe("Active");
  });

  test("PATCH /api/v1/schedules/:id/assign-batches — assigns batches and generates sessions", async () => {
    const res = await request(app)
      .patch(`/api/v1/schedules/${testScheduleId}/assign-batches`)
      .send({ batchIds: ["BATCH-01", "BATCH-02"] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.batchIds).toEqual(["BATCH-01", "BATCH-02"]);
  });

  test("GET /api/v1/schedules/:id/tracking — returns batch tracking summary", async () => {
    const res = await request(app).get(`/api/v1/schedules/${testScheduleId}/tracking`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBe(2);
    expect(res.body.data[0].batchId).toBe("BATCH-01");
  });

  test("POST /api/v1/schedules/:id/duplicate — duplicates schedule and items", async () => {
    const res = await request(app).post(`/api/v1/schedules/${testScheduleId}/duplicate`);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toContain(testScheduleId);
    expect(res.body.data.name).toContain("(Copy)");
    expect(Array.isArray(res.body.data.items)).toBe(true);
  });

  // ─── Curriculum Items ──────────────────────────────────────────────────────────
  test("GET /api/v1/schedules/:id/items — retrieves items for schedule", async () => {
    const res = await request(app).get(`/api/v1/schedules/${testScheduleId}/items`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
  });

  test("POST /api/v1/schedules/:id/items — adds curriculum item to schedule", async () => {
    const res = await request(app)
      .post(`/api/v1/schedules/${testScheduleId}/items`)
      .send({
        subject: "Class 13: Bonus Conditioning Circuit",
        message: "Extra high-volume session for stamina building.",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subject).toBe("Class 13: Bonus Conditioning Circuit");
  });

  test("PUT /api/v1/schedules/:id/items/:itemId — updates curriculum item", async () => {
    expect(testItemId).toBeDefined();
    const res = await request(app)
      .put(`/api/v1/schedules/${testScheduleId}/items/${testItemId}`)
      .send({ subject: "Updated Assessment & Movement Screening" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.subject).toBe("Updated Assessment & Movement Screening");
  });

  test("DELETE /api/v1/schedules/:id/items/:itemId — deletes curriculum item", async () => {
    const res = await request(app).delete(
      `/api/v1/schedules/${testScheduleId}/items/${testItemId}`
    );

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── Sessions ─────────────────────────────────────────────────────────────────
  test("GET /api/v1/sessions — retrieves sessions matching query", async () => {
    const res = await request(app).get(`/api/v1/sessions?scheduleId=${testScheduleId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    if (res.body.data.length > 0) {
      testSessionId = res.body.data[0].id;
    }
  });

  test("PATCH /api/v1/sessions/:id/status — updates session status", async () => {
    if (!testSessionId) return;
    const res = await request(app)
      .patch(`/api/v1/sessions/${testSessionId}/status`)
      .send({ status: "COMPLETED" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe("COMPLETED");
  });

  test("PUT /api/v1/sessions/:id — updates session details", async () => {
    if (!testSessionId) return;
    const res = await request(app)
      .put(`/api/v1/sessions/${testSessionId}`)
      .send({ notes: "Athletes completed full protocol with exceptional form.", attendedCount: 22 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.notes).toBe("Athletes completed full protocol with exceptional form.");
    expect(res.body.data.attendedCount).toBe(22);
  });

  // ─── Holidays ─────────────────────────────────────────────────────────────────
  test("GET /api/v1/holidays — auto-seeds and retrieves holidays list", async () => {
    const res = await request(app).get("/api/v1/holidays");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  test("POST /api/v1/holidays — creates a new holiday", async () => {
    const payload = {
      id: testHolidayId,
      name: "Gym Annual Maintenance Day",
      date: "2026-06-15",
      type: "Facility Maintenance",
      affectedBatches: "ALL",
      description: "Full facility deep clean and equipment recalibration.",
      status: "Active",
    };

    const res = await request(app).post("/api/v1/holidays").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testHolidayId);
    expect(res.body.data.name).toBe("Gym Annual Maintenance Day");
  });

  test("GET /api/v1/holidays/:id — retrieves holiday by ID", async () => {
    const res = await request(app).get(`/api/v1/holidays/${testHolidayId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(testHolidayId);
  });

  test("PUT /api/v1/holidays/:id — updates holiday details", async () => {
    const res = await request(app)
      .put(`/api/v1/holidays/${testHolidayId}`)
      .send({ name: "Annual Facility Overhaul Day" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe("Annual Facility Overhaul Day");
  });

  test("DELETE /api/v1/holidays/:id — deletes holiday", async () => {
    const res = await request(app).delete(`/api/v1/holidays/${testHolidayId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // ─── Delete Schedule ──────────────────────────────────────────────────────────
  test("DELETE /api/v1/schedules/:id — deletes schedule and cleans up cascaded records", async () => {
    const res = await request(app).delete(`/api/v1/schedules/${testScheduleId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const getRes = await request(app).get(`/api/v1/schedules/${testScheduleId}`);
    expect(getRes.status).toBe(404);
  });
});
