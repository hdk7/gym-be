"use strict";

const request = require("supertest");
const app = require("../../app");
const { connectDB, disconnectDB } = require("../../config/database");
const Session = require("../schedules/session.model");
const Batch = require("../batches/batch.model");

beforeAll(async () => {
  await connectDB();

  // Create test batch
  await Batch.findOneAndUpdate(
    { id: "BATCH-TEST-PH6" },
    {
      $set: {
        id: "BATCH-TEST-PH6",
        name: "Phase 6 Calendar Batch",
        shortName: "P6 Batch",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
        timingLabel: "06:00 AM - 07:00 AM",
        daysPattern: "MWF",
        daysLabel: "Monday • Wednesday • Friday",
        daysList: ["Monday", "Wednesday", "Friday"],
        trainerIds: ["TRN-101"],
        coachName: "Coach Elena",
        status: "Active",
      },
    },
    { upsert: true }
  );

  // Seed sessions across October and November 2026
  await Session.create([
    {
      id: "SES-TEST-PH6-01",
      batchId: "BATCH-TEST-PH6",
      batchName: "Phase 6 Calendar Batch",
      classId: "CLS-001",
      className: "Push, Legs, Pull",
      subject: "Push, Legs, Pull",
      message: "Push ups, Squats, Pulls",
      beginnerWorkouts: "Push ups 3x10; Goblet Squats 3x10",
      intermediateWorkouts: "Dips 3x10; Barbell Squats 5x5",
      classNumber: 1,
      weekNumber: 1,
      dayOfWeek: "Monday",
      sessionDate: "2026-10-12",
      displayDate: "Mon, Oct 12, 2026",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      timing: "06:00 AM - 07:00 AM",
      coachName: "Coach Elena",
      status: "SCHEDULED",
      attendedCount: 0,
    },
    {
      id: "SES-TEST-PH6-02",
      batchId: "BATCH-TEST-PH6",
      batchName: "Phase 6 Calendar Batch",
      classId: "CLS-002",
      className: "EMOM",
      subject: "EMOM",
      message: "EMOM routine",
      beginnerWorkouts: "8 mins EMOM",
      intermediateWorkouts: "10 mins EMOM",
      classNumber: 2,
      weekNumber: 1,
      dayOfWeek: "Wednesday",
      sessionDate: "2026-10-14",
      displayDate: "Wed, Oct 14, 2026",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      timing: "06:00 AM - 07:00 AM",
      coachName: "Coach Elena",
      status: "SCHEDULED",
      attendedCount: 0,
    },
    {
      id: "SES-TEST-PH6-03",
      batchId: "BATCH-TEST-PH6",
      batchName: "Phase 6 Calendar Batch",
      classId: "CLS-003",
      className: "5x5",
      subject: "5x5",
      message: "5x5 routine",
      beginnerWorkouts: "Push ups 3x5",
      intermediateWorkouts: "Squats 5x5",
      classNumber: 3,
      weekNumber: 1,
      dayOfWeek: "Friday",
      sessionDate: "2026-10-16",
      displayDate: "Fri, Oct 16, 2026",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      timing: "06:00 AM - 07:00 AM",
      coachName: "Coach Elena",
      status: "SCHEDULED",
      attendedCount: 0,
    },
    {
      id: "SES-TEST-PH6-04",
      batchId: "BATCH-TEST-PH6",
      batchName: "Phase 6 Calendar Batch",
      classId: "CLS-004",
      className: "Circuit Training",
      subject: "Circuit Training",
      message: "Circuit routine",
      beginnerWorkouts: "Skipping 1 min",
      intermediateWorkouts: "Burpees 20",
      classNumber: 4,
      weekNumber: 2,
      dayOfWeek: "Monday",
      sessionDate: "2026-11-02",
      displayDate: "Mon, Nov 2, 2026",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      timing: "06:00 AM - 07:00 AM",
      coachName: "Coach Elena",
      status: "SCHEDULED",
      attendedCount: 0,
    },
  ]);
});

afterAll(async () => {
  await Session.deleteMany({ batchId: "BATCH-TEST-PH6" });
  await Batch.deleteOne({ id: "BATCH-TEST-PH6" });
  await disconnectDB(true);
});

describe("Phase 6: Multi-Dimensional Calendar Views Suite", () => {
  describe("1. Cross-Batch Calendar Endpoint (/api/v1/classes/calendar)", () => {
    test("GET /api/v1/classes/calendar?month=2026-10 filters accurately to October sessions", async () => {
      const res = await request(app).get("/api/v1/classes/calendar?month=2026-10&batchId=BATCH-TEST-PH6");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data).toHaveLength(3);

      for (const s of res.body.data) {
        expect(s.sessionDate.startsWith("2026-10")).toBe(true);
      }
    });

    test("GET /api/v1/classes/calendar?date=2026-10-14 filters to exact day", async () => {
      const res = await request(app).get("/api/v1/classes/calendar?date=2026-10-14");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const found = res.body.data.find((s) => s.id === "SES-TEST-PH6-02");
      expect(found).toBeDefined();
      expect(found.sessionDate).toBe("2026-10-14");
      expect(found.className).toBe("EMOM");
    });

    test("GET /api/v1/classes/calendar?dayOfWeek=Monday filters accurately by day of week", async () => {
      const res = await request(app).get("/api/v1/classes/calendar?dayOfWeek=Monday&batchId=BATCH-TEST-PH6");

      expect(res.status).toBe(200);
      expect(res.body.data).toHaveLength(2); // Oct 12 and Nov 02
      for (const s of res.body.data) {
        expect(s.dayOfWeek).toBe("Monday");
      }
    });
  });

  describe("2. Batch Schedule Progression Endpoint (/api/v1/batches/:id/schedule)", () => {
    test("GET /api/v1/batches/BATCH-TEST-PH6/schedule returns batch summary, pagination & ordered sessions", async () => {
      const res = await request(app).get("/api/v1/batches/BATCH-TEST-PH6/schedule?limit=2");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.batch.id).toBe("BATCH-TEST-PH6");
      expect(res.body.data.summary.totalSessions).toBe(4);
      expect(res.body.data.summary.scheduled).toBe(4);
      expect(res.body.data.pagination.limit).toBe(2);
      expect(res.body.data.pagination.totalPages).toBe(2);
      expect(res.body.data.sessions).toHaveLength(2);
    });

    test("GET /api/v1/batches/NON-EXISTENT/schedule returns 404", async () => {
      const res = await request(app).get("/api/v1/batches/NON-EXISTENT-BATCH/schedule");

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
