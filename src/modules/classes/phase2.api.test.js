"use strict";

const request = require("supertest");
const app = require("../../app");
const { connectDB, disconnectDB } = require("../../config/database");
const ClassProgram = require("./class.model");
const ScheduleHistory = require("./scheduleHistory.model");
const Session = require("../schedules/session.model");
const Batch = require("../batches/batch.model");

beforeAll(async () => {
  await connectDB();

  // Seed a test batch for assignment and shuffle testing
  await Batch.findOneAndUpdate(
    { id: "BATCH-TEST-PH2" },
    {
      $set: {
        id: "BATCH-TEST-PH2",
        name: "Morning Alpha Test Batch",
        shortName: "Alpha Test",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
        timingLabel: "06:00 AM - 07:00 AM",
        daysPattern: "MWF",
        daysLabel: "Monday • Wednesday • Friday",
        daysList: ["Monday", "Wednesday", "Friday"],
        trainerIds: ["TRN-101"],
        coachName: "Dolliee Ellens",
        status: "Active",
      },
    },
    { upsert: true }
  );
});

afterAll(async () => {
  // Clean up all test records
  await ClassProgram.deleteMany({ id: { $regex: /^TEST-API-CLS-/ } });
  await Session.deleteMany({ batchId: "BATCH-TEST-PH2" });
  await ScheduleHistory.deleteMany({ batchId: "BATCH-TEST-PH2" });
  await Batch.deleteOne({ id: "BATCH-TEST-PH2" });
  await disconnectDB(true);
});

describe("Phase 2: Reusable Class System - APIs, Mapping Engine & Shuffle Suite", () => {
  let createdClassId = "";

  describe("1. Reusable Class CRUD Endpoints (/api/v1/classes)", () => {
    test("POST /api/v1/classes — creates a reusable class with strictly 3 fields", async () => {
      const payload = {
        name: "Test Olympic Power Snatch",
        beginnerWorkouts: "PVC Pipe Overhead Squats 10 × 3",
        intermediateWorkouts: "Snatch High Pull 5 × 3; Power Snatch 3 × 5",
      };

      const res = await request(app).post("/api/v1/classes").send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toMatch(/^CLS-\d{3}$/);
      expect(res.body.data.name).toBe("Test Olympic Power Snatch");
      expect(res.body.data.beginnerWorkouts).toBe(payload.beginnerWorkouts);
      expect(res.body.data.intermediateWorkouts).toBe(payload.intermediateWorkouts);

      createdClassId = res.body.data.id;
    });

    test("POST /api/v1/classes — rejects duplicate class program name with 409 Conflict", async () => {
      const payload = {
        name: "Test Olympic Power Snatch",
        beginnerWorkouts: "Reps",
        intermediateWorkouts: "Sets",
      };

      const res = await request(app).post("/api/v1/classes").send(payload);
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/already exists/i);
    });

    test("POST /api/v1/classes — rejects missing name with 422 Unprocessable Entity", async () => {
      const res = await request(app).post("/api/v1/classes").send({
        beginnerWorkouts: "Only workout without name",
      });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
    });

    test("GET /api/v1/classes — retrieves all classes with pagination and search", async () => {
      const res = await request(app).get("/api/v1/classes?search=Olympic");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.some((c) => c.id === createdClassId)).toBe(true);
    });

    test("GET /api/v1/classes/:id — retrieves single class with active session usage count", async () => {
      const res = await request(app).get(`/api/v1/classes/${createdClassId}`);
      expect(res.status).toBe(200);
      expect(res.body.data.id).toBe(createdClassId);
      expect(res.body.data.name).toBe("Test Olympic Power Snatch");
      expect(typeof res.body.data.activeSessionsCount).toBe("number");
    });

    test("PUT /api/v1/classes/:id — updates class workout details", async () => {
      const res = await request(app)
        .put(`/api/v1/classes/${createdClassId}`)
        .send({
          beginnerWorkouts: "Updated: PVC Pipe Snatch 12 × 3",
          intermediateWorkouts: "Updated: Full Snatch 3 × 5",
        });

      expect(res.status).toBe(200);
      expect(res.body.data.beginnerWorkouts).toBe("Updated: PVC Pipe Snatch 12 × 3");
      expect(res.body.data.intermediateWorkouts).toBe("Updated: Full Snatch 3 × 5");
    });
  });

  describe("2. Batch Class Assignment & Calendar Mapping Engine", () => {
    test("POST /api/v1/batches/:id/schedule/assign-classes — sequentially maps selected classes to batch days", async () => {
      // Pick 3 existing seed classes: CLS-001, CLS-002, CLS-004
      const payload = {
        classIds: ["CLS-001", "CLS-002", "CLS-004"],
        startDate: "2026-11-02", // Monday
        overrideExisting: true,
        reason: "November strength cycle start",
      };

      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH2/schedule/assign-classes")
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedCount).toBe(3);

      const sessions = res.body.data.sessions;
      expect(sessions.length).toBe(3);

      // Verify Class 1 mapped to Monday (2026-11-02)
      expect(sessions[0].classId).toBe("CLS-001");
      expect(sessions[0].className).toBe("Push, Legs, Pull");
      expect(sessions[0].dayOfWeek).toBe("Monday");
      expect(sessions[0].sessionDate).toBe("2026-11-02");

      // Verify Class 2 mapped to Wednesday (2026-11-04)
      expect(sessions[1].classId).toBe("CLS-002");
      expect(sessions[1].className).toBe("EMOM");
      expect(sessions[1].dayOfWeek).toBe("Wednesday");
      expect(sessions[1].sessionDate).toBe("2026-11-04");

      // Verify Class 3 mapped to Friday (2026-11-06)
      expect(sessions[2].classId).toBe("CLS-004");
      expect(sessions[2].className).toBe("Circuit Training");
      expect(sessions[2].dayOfWeek).toBe("Friday");
      expect(sessions[2].sessionDate).toBe("2026-11-06");
    });

    test("POST /api/v1/batches/:id/schedule/assign-classes — rejects non-existent batch", async () => {
      const res = await request(app)
        .post("/api/v1/batches/BATCH-NON-EXISTENT/schedule/assign-classes")
        .send({ classIds: ["CLS-001"] });

      expect(res.status).toBe(404);
    });
  });

  describe("3. Shuffle & Interchange Option", () => {
    test("POST /api/v1/batches/:id/schedule/shuffle — swaps Monday's class with Wednesday's class", async () => {
      // Fetch current sessions
      const existingSessions = await Session.find({ batchId: "BATCH-TEST-PH2" }).sort({ sessionDate: 1 });
      const mondaySession = existingSessions[0]; // Nov 02, Push, Legs, Pull
      const wednesdaySession = existingSessions[1]; // Nov 04, EMOM

      expect(mondaySession.className).toBe("Push, Legs, Pull");
      expect(wednesdaySession.className).toBe("EMOM");

      // Execute SWAP
      const swapRes = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH2/schedule/shuffle")
        .send({
          mode: "SWAP",
          sourceSessionId: mondaySession.id,
          targetSessionId: wednesdaySession.id,
          reason: "Coach schedule swap",
        });

      expect(swapRes.status).toBe(200);
      expect(swapRes.body.success).toBe(true);
      expect(swapRes.body.data.message).toMatch(/Successfully swapped Monday with Wednesday/i);

      // Verify in DB that Monday now has EMOM and Wednesday has Push, Legs, Pull
      const updatedMonday = await Session.findOne({ id: mondaySession.id });
      const updatedWednesday = await Session.findOne({ id: wednesdaySession.id });

      expect(updatedMonday.classId).toBe("CLS-002");
      expect(updatedMonday.className).toBe("EMOM");
      expect(updatedMonday.sessionDate).toBe("2026-11-02"); // Date preserved!
      expect(updatedMonday.dayOfWeek).toBe("Monday"); // Day preserved!

      expect(updatedWednesday.classId).toBe("CLS-001");
      expect(updatedWednesday.className).toBe("Push, Legs, Pull");
      expect(updatedWednesday.sessionDate).toBe("2026-11-04"); // Date preserved!
      expect(updatedWednesday.dayOfWeek).toBe("Wednesday"); // Day preserved!
    });

    test("POST /api/v1/batches/:id/schedule/shuffle — protects completed sessions from being swapped", async () => {
      const sessions = await Session.find({ batchId: "BATCH-TEST-PH2" }).sort({ sessionDate: 1 });
      const sessionA = sessions[0];
      const sessionB = sessions[1];

      // Mark sessionA as COMPLETED
      sessionA.status = "COMPLETED";
      await sessionA.save();

      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH2/schedule/shuffle")
        .send({
          mode: "SWAP",
          sourceSessionId: sessionA.id,
          targetSessionId: sessionB.id,
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/already completed/i);

      // Restore status
      sessionA.status = "SCHEDULED";
      await sessionA.save();
    });
  });

  describe("4. Schedule Retrieval & History Log Endpoints", () => {
    test("GET /api/v1/batches/:id/schedule — retrieves batch-wise sessions and summary", async () => {
      const res = await request(app).get("/api/v1/batches/BATCH-TEST-PH2/schedule");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data.sessions)).toBe(true);
      expect(res.body.data.sessions.length).toBe(3);
      expect(res.body.data.batch.name).toBe("Morning Alpha Test Batch");
      expect(res.body.data.summary.totalSessions).toBe(3);
    });

    test("GET /api/v1/batches/:id/schedule/history — retrieves complete history of changes", async () => {
      const res = await request(app).get("/api/v1/batches/BATCH-TEST-PH2/schedule/history");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);

      // Verify ASSIGN_CLASSES and SWAP_DATES actions are recorded
      const actions = res.body.data.map((h) => h.action);
      expect(actions).toContain("ASSIGN_CLASSES");
      expect(actions).toContain("SWAP_DATES");
    });

    test("GET /api/v1/classes/calendar — retrieves sessions calendar view across batches", async () => {
      const res = await request(app).get("/api/v1/classes/calendar?batchId=BATCH-TEST-PH2");
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBe(3);
    });
  });

  describe("5. Delete Protection for In-Use Classes", () => {
    test("DELETE /api/v1/classes/:id — prevents deletion if upcoming sessions use the class", async () => {
      // CLS-001 is currently assigned to BATCH-TEST-PH2
      const res = await request(app).delete("/api/v1/classes/CLS-001");

      expect(res.status).toBe(400);
      expect(res.body.message).toMatch(/currently assigned to/i);
    });

    test("DELETE /api/v1/classes/:id — successfully soft-deletes unassigned class", async () => {
      const res = await request(app).delete(`/api/v1/classes/${createdClassId}`);
      expect(res.status).toBe(200);

      // Verify it cannot be retrieved via normal GET
      const getRes = await request(app).get(`/api/v1/classes/${createdClassId}`);
      expect(getRes.status).toBe(404);
    });
  });
});
