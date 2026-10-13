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

  // Create test batch
  await Batch.findOneAndUpdate(
    { id: "BATCH-TEST-PH5" },
    {
      $set: {
        id: "BATCH-TEST-PH5",
        name: "Phase 5 Shuffle Test Batch",
        shortName: "P5 Batch",
        startTime: "07:00 AM",
        endTime: "08:00 AM",
        timingLabel: "07:00 AM - 08:00 AM",
        daysPattern: "MWF",
        daysLabel: "Monday • Wednesday • Friday",
        daysList: ["Monday", "Wednesday", "Friday"],
        trainerIds: ["TRN-101"],
        coachName: "Coach Dave",
        status: "Active",
      },
    },
    { upsert: true }
  );

  // Create test classes
  await ClassProgram.create([
    {
      id: "CLS-TEST-PH5-01",
      name: "Phase 5 Deadlift Focus",
      beginnerWorkouts: "Romanian Deadlift 3x8; Hamstring Curls 3x10",
      intermediateWorkouts: "Sumo Deadlift 5x5; Barbell Good Mornings 4x8",
      status: "ACTIVE",
    },
    {
      id: "CLS-TEST-PH5-02",
      name: "Phase 5 Overhead Press Focus",
      beginnerWorkouts: "Dumbbell Shoulder Press 3x10; Lateral Raises 3x12",
      intermediateWorkouts: "Standing Overhead Press 5x5; Push Press 3x6",
      status: "ACTIVE",
    },
    {
      id: "CLS-TEST-PH5-03",
      name: "Phase 5 Squat & Plyo",
      beginnerWorkouts: "Air Squats 3x15; Box Steps 3x10",
      intermediateWorkouts: "Back Squats 5x5; Jump Squats 4x10",
      status: "ACTIVE",
    },
  ]);

  // Seed scheduled sessions for BATCH-TEST-PH5
  await Session.create([
    {
      id: "SES-TEST-PH5-01",
      batchId: "BATCH-TEST-PH5",
      batchName: "Phase 5 Shuffle Test Batch",
      classId: "CLS-TEST-PH5-01",
      className: "Phase 5 Deadlift Focus",
      subject: "Phase 5 Deadlift Focus",
      message: "Deadlift routine",
      beginnerWorkouts: "Romanian Deadlift 3x8; Hamstring Curls 3x10",
      intermediateWorkouts: "Sumo Deadlift 5x5; Barbell Good Mornings 4x8",
      classNumber: 1,
      weekNumber: 1,
      dayOfWeek: "Monday",
      sessionDate: "2026-11-09",
      displayDate: "Mon, Nov 9, 2026",
      timing: "07:00 AM - 08:00 AM",
      coachName: "Coach Dave",
      status: "SCHEDULED",
      attendedCount: 0,
    },
    {
      id: "SES-TEST-PH5-02",
      batchId: "BATCH-TEST-PH5",
      batchName: "Phase 5 Shuffle Test Batch",
      classId: "CLS-TEST-PH5-02",
      className: "Phase 5 Overhead Press Focus",
      subject: "Phase 5 Overhead Press Focus",
      message: "Press routine",
      beginnerWorkouts: "Dumbbell Shoulder Press 3x10; Lateral Raises 3x12",
      intermediateWorkouts: "Standing Overhead Press 5x5; Push Press 3x6",
      classNumber: 2,
      weekNumber: 1,
      dayOfWeek: "Wednesday",
      sessionDate: "2026-11-11",
      displayDate: "Wed, Nov 11, 2026",
      timing: "07:00 AM - 08:00 AM",
      coachName: "Coach Dave",
      status: "SCHEDULED",
      attendedCount: 0,
    },
    {
      id: "SES-TEST-PH5-03",
      batchId: "BATCH-TEST-PH5",
      batchName: "Phase 5 Shuffle Test Batch",
      classId: "CLS-TEST-PH5-03",
      className: "Phase 5 Squat & Plyo",
      subject: "Phase 5 Squat & Plyo",
      message: "Squat routine",
      beginnerWorkouts: "Air Squats 3x15; Box Steps 3x10",
      intermediateWorkouts: "Back Squats 5x5; Jump Squats 4x10",
      classNumber: 3,
      weekNumber: 1,
      dayOfWeek: "Friday",
      sessionDate: "2026-11-13",
      displayDate: "Fri, Nov 13, 2026",
      timing: "07:00 AM - 08:00 AM",
      coachName: "Coach Dave",
      status: "SCHEDULED",
      attendedCount: 0,
    },
  ]);
});

afterAll(async () => {
  await ClassProgram.deleteMany({ id: { $regex: /^CLS-TEST-PH5-/ } });
  await Session.deleteMany({ batchId: "BATCH-TEST-PH5" });
  await ScheduleHistory.deleteMany({ batchId: "BATCH-TEST-PH5" });
  await Batch.deleteOne({ id: "BATCH-TEST-PH5" });
  await disconnectDB(true);
});

describe("Phase 5: Class Schedule Shuffle & Interchange Engine Suite", () => {
  describe("1. SWAP Mode (Interchanging Two Scheduled Dates)", () => {
    test("POST /api/v1/batches/:id/schedule/shuffle (mode: SWAP) successfully swaps Monday and Wednesday classes", async () => {
      const payload = {
        mode: "SWAP",
        sourceSessionId: "SES-TEST-PH5-01", // Monday: Deadlift
        targetSessionId: "SES-TEST-PH5-02", // Wednesday: Overhead Press
        reason: "Trainer schedule swap requested by Coach Dave",
      };

      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH5/schedule/shuffle")
        .send(payload);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);

      // Verify Monday's session now holds the Overhead Press class
      const mondaySession = await Session.findOne({ id: "SES-TEST-PH5-01" }).lean();
      expect(mondaySession.classId).toBe("CLS-TEST-PH5-02");
      expect(mondaySession.className).toBe("Phase 5 Overhead Press Focus");
      expect(mondaySession.subject).toBe("Phase 5 Overhead Press Focus");
      expect(mondaySession.intermediateWorkouts).toContain("Standing Overhead Press 5x5");
      // Session date & day must NOT have changed
      expect(mondaySession.sessionDate).toBe("2026-11-09");
      expect(mondaySession.dayOfWeek).toBe("Monday");

      // Verify Wednesday's session now holds the Deadlift class
      const wednesdaySession = await Session.findOne({ id: "SES-TEST-PH5-02" }).lean();
      expect(wednesdaySession.classId).toBe("CLS-TEST-PH5-01");
      expect(wednesdaySession.className).toBe("Phase 5 Deadlift Focus");
      expect(wednesdaySession.subject).toBe("Phase 5 Deadlift Focus");
      expect(wednesdaySession.intermediateWorkouts).toContain("Sumo Deadlift 5x5");
      // Session date & day must NOT have changed
      expect(wednesdaySession.sessionDate).toBe("2026-11-11");
      expect(wednesdaySession.dayOfWeek).toBe("Wednesday");
    });

    test("Records SWAP_DATES action in ScheduleHistory with exact swapped metadata", async () => {
      const res = await request(app).get("/api/v1/batches/BATCH-TEST-PH5/schedule/history");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);

      const swapLog = res.body.data.find((item) => item.action === "SWAP_DATES");
      expect(swapLog).toBeDefined();
      expect(swapLog.reason).toBe("Trainer schedule swap requested by Coach Dave");
      expect(swapLog.changeDetails.swappedFrom.sessionId).toBe("SES-TEST-PH5-01");
      expect(swapLog.changeDetails.swappedFrom.date).toBe("2026-11-09");
      expect(swapLog.changeDetails.swappedTo.sessionId).toBe("SES-TEST-PH5-02");
      expect(swapLog.changeDetails.swappedTo.date).toBe("2026-11-11");
    });

    test("Rejects swap when source or target session does not exist", async () => {
      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH5/schedule/shuffle")
        .send({
          mode: "SWAP",
          sourceSessionId: "SES-TEST-PH5-01",
          targetSessionId: "NON-EXISTENT-SESSION",
        });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });

    test("Rejects swap on completed session", async () => {
      // Mark Monday session as COMPLETED
      await Session.updateOne({ id: "SES-TEST-PH5-01" }, { status: "COMPLETED" });

      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH5/schedule/shuffle")
        .send({
          mode: "SWAP",
          sourceSessionId: "SES-TEST-PH5-01",
          targetSessionId: "SES-TEST-PH5-03",
        });

      expect(res.status).toBe(400);
      expect(res.body.message).toContain("already completed");

      // Restore session to SCHEDULED
      await Session.updateOne({ id: "SES-TEST-PH5-01" }, { status: "SCHEDULED" });
    });
  });

  describe("2. SHUFFLE_RANGE Mode (Randomizing Upcoming Sessions)", () => {
    test("POST /api/v1/batches/:id/schedule/shuffle (mode: SHUFFLE_RANGE) randomizes cycle order", async () => {
      const res = await request(app)
        .post("/api/v1/batches/BATCH-TEST-PH5/schedule/shuffle")
        .send({
          mode: "SHUFFLE_RANGE",
          startDate: "2026-11-09",
          endDate: "2026-11-13",
          reason: "Periodic workout routine randomization",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.shuffledCount).toBe(3);

      // Verify that all 3 sessions still have valid assigned classes
      const sessions = await Session.find({ batchId: "BATCH-TEST-PH5" }).sort({ sessionDate: 1 });
      expect(sessions).toHaveLength(3);
      for (const s of sessions) {
        expect(s.classId).toMatch(/^CLS-TEST-PH5-/);
        expect(s.className).toBeDefined();
        expect(s.subject).toBeDefined();
      }

      // Verify ScheduleHistory recorded REORDER
      const histRes = await request(app).get("/api/v1/batches/BATCH-TEST-PH5/schedule/history");
      const reorderLog = histRes.body.data.find((item) => item.action === "REORDER");
      expect(reorderLog).toBeDefined();
      expect(reorderLog.changeDetails.sessionCount).toBe(3);
    });
  });
});
