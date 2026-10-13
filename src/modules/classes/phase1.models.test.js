"use strict";

const { connectDB, disconnectDB } = require("../../config/database");
const ClassProgram = require("./class.model");
const ScheduleHistory = require("./scheduleHistory.model");
const Session = require("../schedules/session.model");
const { createClassSchema, updateClassSchema } = require("./class.schema");
const {
  CLASS_STATUS,
  SCHEDULE_CHANGE_ACTION,
  ID_PREFIXES,
} = require("../../shared/constants");
const {
  generateClassId,
  generateScheduleHistoryId,
} = require("../../shared/idGenerator");
const { SEED_CLASSES } = require("../../seeds/data/classes.seed");

beforeAll(async () => {
  await connectDB();
});

afterAll(async () => {
  // Clean up any test records created
  await ClassProgram.deleteMany({ id: { $regex: /^TEST-CLS-/ } });
  await ScheduleHistory.deleteMany({ id: { $regex: /^TEST-HIST-/ } });
  await Session.deleteMany({ id: { $regex: /^TEST-SES-/ } });
  await disconnectDB(true);
});

describe("Phase 1: Reusable Class System - Models & Schema Verification Suite", () => {
  describe("1. Constants and ID Generators", () => {
    test("CLASS_STATUS and SCHEDULE_CHANGE_ACTION are defined and frozen", () => {
      expect(CLASS_STATUS).toBeDefined();
      expect(Object.isFrozen(CLASS_STATUS)).toBe(true);
      expect(CLASS_STATUS.ACTIVE).toBe("ACTIVE");
      expect(CLASS_STATUS.ARCHIVED).toBe("ARCHIVED");

      expect(SCHEDULE_CHANGE_ACTION).toBeDefined();
      expect(Object.isFrozen(SCHEDULE_CHANGE_ACTION)).toBe(true);
      expect(SCHEDULE_CHANGE_ACTION.ASSIGN_CLASSES).toBe("ASSIGN_CLASSES");
      expect(SCHEDULE_CHANGE_ACTION.SWAP_DATES).toBe("SWAP_DATES");
      expect(SCHEDULE_CHANGE_ACTION.REORDER).toBe("REORDER");
      expect(SCHEDULE_CHANGE_ACTION.EDIT_WORKOUT).toBe("EDIT_WORKOUT");
    });

    test("ID generators produce valid IDs with correct prefixes", () => {
      const clsId = generateClassId(0);
      expect(clsId).toBe("CLS-001");

      const clsId15 = generateClassId(14);
      expect(clsId15).toBe("CLS-015");

      const histId = generateScheduleHistoryId();
      expect(histId).toMatch(/^SCH-HIST-\d{6}-\d{4}$/);
      expect(ID_PREFIXES.CLASS).toBe("CLS");
      expect(ID_PREFIXES.SCHEDULE_HISTORY).toBe("SCH-HIST");
    });
  });

  describe("2. ClassProgram Model", () => {
    test("successfully creates and retrieves a reusable class program", async () => {
      const newClass = await ClassProgram.create({
        id: "TEST-CLS-001",
        name: "Test Heavy Pull & Hinge",
        beginnerWorkouts: "Hori Pulls 8; Deadlift 8 × 3",
        intermediateWorkouts: "Pulls 5 × 5; Deficit Deadlift 6 × 3",
      });

      expect(newClass).toBeDefined();
      expect(newClass.id).toBe("TEST-CLS-001");
      expect(newClass.name).toBe("Test Heavy Pull & Hinge");
      expect(newClass.status).toBe(CLASS_STATUS.ACTIVE);
      expect(newClass.isDeleted).toBe(false);

      const found = await ClassProgram.findOne({ id: "TEST-CLS-001" }).lean();
      expect(found).not.toBeNull();
      expect(found.beginnerWorkouts).toBe("Hori Pulls 8; Deadlift 8 × 3");
      expect(found.intermediateWorkouts).toBe("Pulls 5 × 5; Deficit Deadlift 6 × 3");
    });

    test("enforces required fields (id, name)", async () => {
      await expect(
        ClassProgram.create({
          id: "TEST-CLS-ERR-1",
          // name missing
          beginnerWorkouts: "Some workout",
        })
      ).rejects.toThrow();

      await expect(
        ClassProgram.create({
          // id missing
          name: "Some class without id",
        })
      ).rejects.toThrow();
    });

    test("defaults workout descriptions if omitted", async () => {
      const defaultClass = await ClassProgram.create({
        id: "TEST-CLS-DEF-1",
        name: "Test Class with Default Workouts",
      });

      expect(defaultClass.beginnerWorkouts).toBe("Not specified");
      expect(defaultClass.intermediateWorkouts).toBe("Not specified");
    });
  });

  describe("3. Strict 3-Field Validation Schema (class.schema.js)", () => {
    test("validates when only the 3 permitted fields are supplied", async () => {
      const validPayload = {
        name: "Push, Legs, Pull",
        beginnerWorkouts: "Push ups 5 reps",
        intermediateWorkouts: "Dips 10 reps",
      };

      const validated = await createClassSchema.validate(validPayload);
      expect(validated.name).toBe("Push, Legs, Pull");
      expect(validated.beginnerWorkouts).toBe("Push ups 5 reps");
      expect(validated.intermediateWorkouts).toBe("Dips 10 reps");
    });

    test("rejects when Class Program Name is missing or empty", async () => {
      await expect(
        createClassSchema.validate({
          name: "",
          beginnerWorkouts: "Routine",
        })
      ).rejects.toThrow(/Class Program Name is required/);
    });

    test("strictly rejects unwanted legacy fields (e.g. shift, coachId, capacity, daysPattern)", async () => {
      const legacyPayload = {
        name: "Old Style Program",
        beginnerWorkouts: "Reps",
        intermediateWorkouts: "Sets",
        shift: "06:00 AM", // Not allowed
        coachId: "TRN-101", // Not allowed
        capacity: 25, // Not allowed
      };

      // Strict validation fails with clear message
      await expect(
        createClassSchema.validate(legacyPayload, { abortEarly: false, stripUnknown: false })
      ).rejects.toThrow(/Only Class Program Name, Beginner Workouts, and Intermediate Workouts are allowed/);

      // Middleware sanitization strips unknown fields to only the 3 allowed fields
      const sanitized = await createClassSchema.validate(legacyPayload, {
        abortEarly: false,
        stripUnknown: true,
      });
      expect(sanitized.name).toBe("Old Style Program");
      expect(sanitized.shift).toBeUndefined();
      expect(sanitized.coachId).toBeUndefined();
      expect(sanitized.capacity).toBeUndefined();
    });
  });

  describe("4. ScheduleHistory Audit Log Model", () => {
    test("persists a schedule swap and assignment history record", async () => {
      const historyEntry = await ScheduleHistory.create({
        id: "TEST-HIST-001",
        batchId: "BATCH-01",
        action: SCHEDULE_CHANGE_ACTION.SWAP_DATES,
        description: "Swapped Monday's class with Wednesday's class",
        changeDetails: {
          swappedFrom: { date: "2026-11-02", day: "Monday", classId: "CLS-001", className: "Push, Legs, Pull" },
          swappedTo: { date: "2026-11-04", day: "Wednesday", classId: "CLS-002", className: "EMOM" },
        },
        performedBy: "Admin Coach",
        reason: "Coach scheduling adjustment",
      });

      expect(historyEntry).toBeDefined();
      expect(historyEntry.batchId).toBe("BATCH-01");
      expect(historyEntry.action).toBe("SWAP_DATES");
      expect(historyEntry.changeDetails.swappedFrom.day).toBe("Monday");
      expect(historyEntry.changeDetails.swappedTo.day).toBe("Wednesday");
    });

    test("rejects invalid action enums", async () => {
      await expect(
        ScheduleHistory.create({
          id: "TEST-HIST-ERR",
          batchId: "BATCH-01",
          action: "INVALID_ACTION_NAME",
        })
      ).rejects.toThrow();
    });
  });

  describe("5. Session Model Compatibility with Reusable Classes", () => {
    test("creates a session with decoupled classId, className, and workout snapshots without masterScheduleId", async () => {
      const session = await Session.create({
        id: "TEST-SES-001",
        batchId: "BATCH-01",
        batchName: "Morning Alpha 06:00 AM",
        classId: "CLS-001",
        className: "Push, Legs, Pull",
        beginnerWorkouts: "Not specified",
        intermediateWorkouts: "Push: Push ups 5–10 × 3; Dips 4–10 × 3...",
        classNumber: 1,
        weekNumber: 1,
        dayOfWeek: "Monday",
        sessionDate: "2026-11-02",
        displayDate: "Mon, Nov 2, 2026",
        startTime: "06:00 AM",
        endTime: "07:00 AM",
        timing: "06:00 AM - 07:00 AM",
        coachId: "TRN-101",
        coachName: "Dolliee Ellens",
        status: "SCHEDULED",
      });

      expect(session).toBeDefined();
      expect(session.classId).toBe("CLS-001");
      expect(session.className).toBe("Push, Legs, Pull");
      expect(session.intermediateWorkouts).toContain("Push: Push ups 5–10 × 3");

      const fetched = await Session.findOne({ id: "TEST-SES-001" }).lean();
      expect(fetched.classId).toBe("CLS-001");
      expect(fetched.batchId).toBe("BATCH-01");
    });
  });

  describe("6. 15 TSW Master Reference Programs Data Verification", () => {
    test("seeded database contains all 15 TSW reference programs", async () => {
      const seeded = await ClassProgram.find({
        id: { $in: SEED_CLASSES.map((c) => c.id) },
      }).lean();

      expect(seeded.length).toBe(15);

      const emom = seeded.find((c) => c.name === "EMOM");
      expect(emom).toBeDefined();
      expect(emom.beginnerWorkouts).toContain("Pull-ups, Push ups, Deadlifts");
      expect(emom.intermediateWorkouts).toContain("Swings 15–20 + Farmer's Carry");

      const circuit = seeded.find((c) => c.name === "Circuit Training");
      expect(circuit).toBeDefined();
      expect(circuit.beginnerWorkouts).toContain("1 min Skipping; 1 min Elbow Plank");
      expect(circuit.intermediateWorkouts).toContain("100 Skips; 10 Squat Jumps");

      const fiery50 = seeded.find((c) => c.name === "Five-O/ Fiery 50");
      expect(fiery50).toBeDefined();
      expect(fiery50.intermediateWorkouts).toBe("50 Squats; 50 Pulls; 50 Hinges; 50 Push; 50mt Crawl; 500m Carry.");
    });
  });
});
