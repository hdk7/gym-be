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

  // Seed two distinct test batches: MWF and TTS
  await Batch.findOneAndUpdate(
    { id: "BATCH-TEST-PH4-MWF" },
    {
      $set: {
        id: "BATCH-TEST-PH4-MWF",
        name: "Morning MWF Batch",
        shortName: "MWF Test",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
        timingLabel: "06:00 AM - 07:00 AM",
        daysPattern: "MWF",
        daysLabel: "Monday • Wednesday • Friday",
        daysList: ["Monday", "Wednesday", "Friday"],
        trainerIds: ["TRN-101"],
        coachName: "Coach Alex",
        status: "Active",
      },
    },
    { upsert: true }
  );

  await Batch.findOneAndUpdate(
    { id: "BATCH-TEST-PH4-TTS" },
    {
      $set: {
        id: "BATCH-TEST-PH4-TTS",
        name: "Evening TTS Batch",
        shortName: "TTS Test",
        startTime: "05:00 PM",
        endTime: "06:00 PM",
        timingLabel: "05:00 PM - 06:00 PM",
        daysPattern: "TTS",
        daysLabel: "Tuesday • Thursday • Saturday",
        daysList: ["Tuesday", "Thursday", "Saturday"],
        trainerIds: ["TRN-102"],
        coachName: "Coach Sam",
        status: "Active",
      },
    },
    { upsert: true }
  );

  // Seed 3 test classes
  await ClassProgram.create([
    {
      id: "CLS-TEST-PH4-01",
      name: "Phase 4 Upper Body Power",
      beginnerWorkouts: "Incline Push-ups 3x10; Dumbbell Press 3x8",
      intermediateWorkouts: "Barbell Bench Press 5x5; Weighted Dips 3x8",
      status: "ACTIVE",
    },
    {
      id: "CLS-TEST-PH4-02",
      name: "Phase 4 Lower Body Strength",
      beginnerWorkouts: "Goblet Squats 3x10; Romanian Deadlift 3x8",
      intermediateWorkouts: "Barbell Back Squats 5x5; Conventional Deadlift 4x6",
      status: "ACTIVE",
    },
    {
      id: "CLS-TEST-PH4-03",
      name: "Phase 4 Full Body Circuit",
      beginnerWorkouts: "Skipping 1 min; Plank 30s; Walking Burpees 10",
      intermediateWorkouts: "Kettlebell Swings 20; Burpee Box Jumps 15; Strict Pull-ups 8",
      status: "ACTIVE",
    },
  ]);
});

afterAll(async () => {
  await ClassProgram.deleteMany({ id: { $regex: /^CLS-TEST-PH4-/ } });
  await Session.deleteMany({ batchId: { $in: ["BATCH-TEST-PH4-MWF", "BATCH-TEST-PH4-TTS"] } });
  await ScheduleHistory.deleteMany({ batchId: { $in: ["BATCH-TEST-PH4-MWF", "BATCH-TEST-PH4-TTS"] } });
  await Batch.deleteMany({ id: { $in: ["BATCH-TEST-PH4-MWF", "BATCH-TEST-PH4-TTS"] } });
  await disconnectDB(true);
});

describe("Phase 4: Multi-Class Batch Calendar Assignment Engine Suite", () => {
  describe("1. Validation & Input Guardrails", () => {
    test("Fails with 400 when classIds array is empty or missing", async () => {
      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH4-MWF/schedule/assign-classes")
        .send({
          classIds: [],
          startDate: "2026-11-02",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    test("Fails with 404 when batch does not exist", async () => {
      const res = await request(app)
        .post("/api/v1/batches/NON-EXISTENT-BATCH/schedule/assign-classes")
        .send({
          classIds: ["CLS-TEST-PH4-01"],
          startDate: "2026-11-02",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("Fails with 400 when any referenced class does not exist", async () => {
      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH4-MWF/schedule/assign-classes")
        .send({
          classIds: ["CLS-TEST-PH4-01", "NON-EXISTENT-CLS-999"],
          startDate: "2026-11-02",
        });

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe("2. Sequential Date & Day-of-Week Calendar Mapping (MWF)", () => {
    test("Maps 3 classes sequentially to Monday, Wednesday, Friday slots", async () => {
      // 2026-11-02 is a Monday
      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH4-MWF/schedule/assign-classes")
        .send({
          classIds: ["CLS-TEST-PH4-01", "CLS-TEST-PH4-02", "CLS-TEST-PH4-03"],
          startDate: "2026-11-02",
          reason: "Sprint 1 Curriculum Rollout",
        });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.assignedCount).toBe(3);

      const sessions = res.body.data.sessions;
      expect(sessions).toHaveLength(3);

      // Verify Session 1
      expect(sessions[0].sessionDate).toBe("2026-11-02");
      expect(sessions[0].dayOfWeek).toBe("Monday");
      expect(sessions[0].classId).toBe("CLS-TEST-PH4-01");
      expect(sessions[0].className).toBe("Phase 4 Upper Body Power");
      expect(sessions[0].beginnerWorkouts).toContain("Incline Push-ups");
      expect(sessions[0].intermediateWorkouts).toContain("Barbell Bench Press");

      // Verify Session 2
      expect(sessions[1].sessionDate).toBe("2026-11-04");
      expect(sessions[1].dayOfWeek).toBe("Wednesday");
      expect(sessions[1].classId).toBe("CLS-TEST-PH4-02");
      expect(sessions[1].className).toBe("Phase 4 Lower Body Strength");

      // Verify Session 3
      expect(sessions[2].sessionDate).toBe("2026-11-06");
      expect(sessions[2].dayOfWeek).toBe("Friday");
      expect(sessions[2].classId).toBe("CLS-TEST-PH4-03");
      expect(sessions[2].className).toBe("Phase 4 Full Body Circuit");
    });
  });

  describe("3. Sequential Date & Day-of-Week Calendar Mapping (TTS)", () => {
    test("Maps classes sequentially to Tuesday, Thursday, Saturday slots", async () => {
      // 2026-11-03 is a Tuesday
      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH4-TTS/schedule/assign-classes")
        .send({
          classIds: ["CLS-TEST-PH4-02", "CLS-TEST-PH4-01"],
          startDate: "2026-11-03",
          reason: "Evening TTS Kickoff",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.assignedCount).toBe(2);

      const sessions = res.body.data.sessions;
      expect(sessions[0].sessionDate).toBe("2026-11-03");
      expect(sessions[0].dayOfWeek).toBe("Tuesday");
      expect(sessions[0].classId).toBe("CLS-TEST-PH4-02");

      expect(sessions[1].sessionDate).toBe("2026-11-05");
      expect(sessions[1].dayOfWeek).toBe("Thursday");
      expect(sessions[1].classId).toBe("CLS-TEST-PH4-01");
    });
  });

  describe("4. Schedule Audit Trail Verification", () => {
    test("Captures ASSIGN_CLASSES in ScheduleHistory with exact mapped sequence", async () => {
      const res = await request(app).get("/api/v1/batches/BATCH-TEST-PH4-MWF/schedule/history");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);

      const latestLog = res.body.data[0];
      expect(latestLog.action).toBe("ASSIGN_CLASSES");
      expect(latestLog.changeDetails.totalClasses).toBe(3);
      expect(latestLog.reason).toBe("Sprint 1 Curriculum Rollout");
      expect(latestLog.changeDetails.classes[0].classId).toBe("CLS-TEST-PH4-01");
      expect(latestLog.changeDetails.classes[0].day).toBe("Monday");
    });
  });

  describe("5. Override Existing Upcoming Sessions", () => {
    test("overrideExisting=true replaces future scheduled classes starting from startDate", async () => {
      // Re-assign starting from 2026-11-02 with overrideExisting: true and only 1 class
      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH4-MWF/schedule/assign-classes")
        .send({
          classIds: ["CLS-TEST-PH4-03"],
          startDate: "2026-11-02",
          overrideExisting: true,
          reason: "Replaced with single circuit day",
        });

      expect(res.status).toBe(201);
      expect(res.body.data.assignedCount).toBe(1);

      // Verify that Wednesday and Friday previous scheduled sessions were removed
      const schedRes = await request(app).get("/api/v1/batches/BATCH-TEST-PH4-MWF/schedule");
      expect(schedRes.status).toBe(200);
      const remainingSessions = schedRes.body.data.sessions;
      expect(remainingSessions).toHaveLength(1);
      expect(remainingSessions[0].classId).toBe("CLS-TEST-PH4-03");
      expect(remainingSessions[0].sessionDate).toBe("2026-11-02");
    });
  });
});
