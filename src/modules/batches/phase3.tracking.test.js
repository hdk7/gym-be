"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const { connectDB, disconnectDB } = require("../../config/database");
const app = require("../../app");
const { seedPhase3Fixtures, cleanupPhase3Fixtures } = require("./phase3.fixtures");
const Trainer = require("../trainers/trainer.model");
const TrainerLog = require("../attendance/trainerLog.model");

describe("Phase 3: Month-Wise Category Tracking & Attendance Suite", () => {
  const ts = Date.now().toString().slice(-5);
  const testMonth = "2026-10";
  const batchAId = `BATCH-P3A-${ts}`;
  const batchBId = `BATCH-P3B-${ts}`;
  const trainer1Id = `TRN-P3-1-${ts}`;
  const member1Id = `MEM-P3-1-${ts}`;
  const member2Id = `MEM-P3-2-${ts}`;
  const sessionId = `SES-P3-1-${ts}`;

  beforeAll(async () => {
    await connectDB();
    await seedPhase3Fixtures({
      ts,
      testMonth,
      batchAId,
      batchBId,
      trainer1Id,
      member1Id,
      member2Id,
      sessionId,
    });
  });

  afterAll(async () => {
    await cleanupPhase3Fixtures({ batchAId, batchBId, trainer1Id, member1Id, member2Id, sessionId });
    await disconnectDB();
  });


  // ─────────────────────────────────────────────────────────────────────────────
  // 1. Batch Container-Wise Tracking (3 Managed Categories)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("1. Batch Container-Wise Month Tracking (GET /api/v1/batches/:id/month-tracking)", () => {
    test("Returns structured 3-category tracking for Batch A for October 2026", async () => {
      const res = await request(app)
        .get(`/api/v1/batches/${batchAId}/month-tracking?month=${testMonth}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const tracking = res.body.data;

      // Top-level metadata
      expect(tracking.batchId).toBe(batchAId);
      expect(tracking.monthYear).toBe(testMonth);

      // Summary
      expect(tracking.summary).toBeDefined();
      expect(tracking.summary.primaryPax).toBe(1);
      expect(tracking.summary.flexInPax).toBe(1);
      expect(tracking.summary.maxPax).toBe(20);
      expect(tracking.summary.totalSessions).toBe(1);
      expect(tracking.summary.completedSessions).toBe(1);
      expect(tracking.summary.overallAttendanceRate).toBe(100);

      // Category 1: Assigned Trainers
      expect(tracking.category1_Trainers).toBeInstanceOf(Array);
      expect(tracking.category1_Trainers.length).toBe(1);
      const coach = tracking.category1_Trainers[0];
      expect(coach.trainerId).toBe(trainer1Id);
      expect(coach.classesConducted).toBe(1);
      expect(coach.coachingHours).toBe(1);

      // Category 2: Members (Primary & Flex-In)
      expect(tracking.category2_Members).toBeDefined();
      expect(tracking.category2_Members.primaryMembers.length).toBe(1);
      expect(tracking.category2_Members.primaryMembers[0].memberId).toBe(member1Id);
      expect(tracking.category2_Members.primaryMembers[0].attendanceRate).toBe(100);
      expect(tracking.category2_Members.primaryMembers[0].isPrimary).toBe(true);

      expect(tracking.category2_Members.flexInMembers.length).toBe(1);
      const flexMember = tracking.category2_Members.flexInMembers[0];
      expect(flexMember.memberId).toBe(member2Id);
      expect(flexMember.isFlexIn).toBe(true);
      expect(flexMember.primaryBatchId).toBe(batchBId);
      expect(flexMember.selectedDays).toEqual(["Wednesday"]);

      // Category 3: Scheduled Classes & Sessions
      expect(tracking.category3_ScheduledClasses).toBeDefined();
      expect(tracking.category3_ScheduledClasses.totalCount).toBe(1);
      expect(tracking.category3_ScheduledClasses.completedCount).toBe(1);
      expect(tracking.category3_ScheduledClasses.sessions[0].id).toBe(sessionId);
    });

    test("Checks live capacity for Batch A on Wednesday (accounts for flex in)", async () => {
      const res = await request(app)
        .get(`/api/v1/batches/${batchAId}/capacity-check?date=2026-10-07`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const cap = res.body.data;
      expect(cap.batchId).toBe(batchAId);
      expect(cap.dayOfWeek).toBe("Wednesday");
      expect(cap.effectivePax).toBe(2);
      expect(cap.maxPax).toBe(20);
      expect(cap.spotsRemaining).toBe(18);
      expect(cap.occupancyPercent).toBe(10);
      expect(cap.isFull).toBe(false);
    });

    test("Retrieves effective attendees roster for Batch A on Wednesday", async () => {
      const res = await request(app)
        .get(`/api/v1/batches/${batchAId}/effective-attendees?date=2026-10-07`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const roster = res.body.data;
      expect(roster.totalAttendeesCount).toBe(2);
      expect(roster.attendees.some((m) => m.memberId === member1Id && m.isPrimaryAttendee)).toBe(true);
      expect(roster.attendees.some((m) => m.memberId === member2Id && m.isFlexIn)).toBe(true);
    });

    test("Includes substitute trainer in Category 1 who conducted a session in this month", async () => {
      const subTrainerId = `TRN-SUB-${ts}`;
      await Trainer.create({
        id: subTrainerId,
        name: "Substitute Coach",
        email: `sub-${ts}@strengthway.com`,
        phone: "+91 91111 22222",
        experience: "5 years",
        bio: "Certified substitute coach.",
        status: "Active",
        batchIds: [],
      });

      await TrainerLog.create({
        id: `TLOG-SUB-${ts}`,
        date: "2026-10-14",
        monthYear: testMonth,
        trainerId: subTrainerId,
        trainerName: "Substitute Coach",
        batchId: batchAId,
        status: "CONDUCTED",
        durationMinutes: 60,
        attendeesCount: 2,
      });

      const res = await request(app)
        .get(`/api/v1/batches/${batchAId}/month-tracking?month=${testMonth}`)
        .expect(200);

      const subCoach = res.body.data.category1_Trainers.find((t) => t.trainerId === subTrainerId);
      expect(subCoach).toBeDefined();
      expect(subCoach.isSubstitute).toBe(true);
      expect(subCoach.isPrimaryTrainer).toBe(false);
      expect(subCoach.classesConducted).toBe(1);

      await Trainer.deleteOne({ id: subTrainerId });
      await TrainerLog.deleteOne({ id: `TLOG-SUB-${ts}` });
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 2. Individual-Wise Tracking (Member Ledger & Trainer Ledger)
  // ─────────────────────────────────────────────────────────────────────────────
  describe("2. Individual-Wise Month Tracking", () => {
    test("GET /api/v1/members/:id/month-tracking — retrieves member ledger and compliance", async () => {
      const res = await request(app)
        .get(`/api/v1/members/${member2Id}/month-tracking?month=${testMonth}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.memberId).toBe(member2Id);
      expect(data.primaryBatch.batchId).toBe(batchBId);
      expect(data.activeFlexAssignments.length).toBe(1);
      expect(data.summary.totalLoggedSessions).toBe(1);
      expect(data.summary.flexPresentCount).toBe(1);
      expect(data.summary.attendancePercentage).toBe(100);
      expect(data.attendanceLedger.length).toBe(1);
    });

    test("GET /api/v1/trainers/:id/month-tracking — retrieves trainer output and class conduction ledger", async () => {
      const res = await request(app)
        .get(`/api/v1/trainers/${trainer1Id}/month-tracking?month=${testMonth}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const data = res.body.data;
      expect(data.trainerId).toBe(trainer1Id);
      expect(data.summary.totalClassesConducted).toBe(1);
      expect(data.summary.totalCoachingHours).toBe(1);
      expect(data.summary.totalAttendeesCoached).toBe(2);
      expect(data.assignedBatches.some((b) => b.id === batchAId)).toBe(true);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────────
  // 3. Attendance Management Endpoints
  // ─────────────────────────────────────────────────────────────────────────────
  describe("3. Attendance Management Endpoints", () => {
    const markDate = "2026-10-09"; // Friday

    test("POST /api/v1/attendance/mark — marks individual attendance with flex status", async () => {
      const payload = {
        date: markDate,
        batchId: batchAId,
        memberId: member1Id,
        status: "PRESENT",
        isFlexAttendance: false,
        checkInTime: "06:05 AM",
        trainerId: trainer1Id,
        markedBy: "Coach Marcus",
      };

      const res = await request(app)
        .post("/api/v1/attendance/mark")
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.memberId).toBe(member1Id);
      expect(res.body.data.status).toBe("PRESENT");
    });

    test("POST /api/v1/attendance/bulk-mark — marks multiple members in bulk", async () => {
      const payload = {
        date: "2026-10-12",
        batchId: batchAId,
        trainerId: trainer1Id,
        markedBy: "Admin",
        attendees: [
          { memberId: member1Id, status: "PRESENT", isFlexAttendance: false },
          { memberId: member2Id, status: "ABSENT", isFlexAttendance: true },
        ],
      };

      const res = await request(app)
        .post("/api/v1/attendance/bulk-mark")
        .send(payload)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.count).toBe(2);
    });

    test("GET /api/v1/attendance/batch/:batchId — returns monthly matrix for batch", async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/batch/${batchAId}?month=${testMonth}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      const grid = res.body.data;
      expect(grid.batchId).toBe(batchAId);
      expect(grid.monthYear).toBe(testMonth);
      expect(grid.members.length).toBeGreaterThanOrEqual(1);
      expect(grid.matrix[member1Id]).toBeDefined();
      expect(grid.matrix[member1Id]["2026-10-07"].status).toBe("PRESENT");
    });

    test("GET /api/v1/attendance/member/:memberId — returns member attendance history", async () => {
      const res = await request(app)
        .get(`/api/v1/attendance/member/${member1Id}?month=${testMonth}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(2);
    });

    test("POST /api/v1/attendance/trainer-logs & GET /api/v1/attendance/trainer-logs/:trainerId", async () => {
      const logPayload = {
        date: "2026-10-09",
        trainerId: trainer1Id,
        batchId: batchAId,
        status: "CONDUCTED",
        durationMinutes: 60,
        attendeesCount: 1,
        notes: "Friday strength test completed.",
      };

      const createRes = await request(app)
        .post("/api/v1/attendance/trainer-logs")
        .send(logPayload)
        .expect(201);

      expect(createRes.body.success).toBe(true);
      expect(createRes.body.data.status).toBe("CONDUCTED");

      const getRes = await request(app)
        .get(`/api/v1/attendance/trainer-logs/${trainer1Id}?month=${testMonth}`)
        .expect(200);

      expect(getRes.body.success).toBe(true);
      expect(getRes.body.data.length).toBeGreaterThanOrEqual(2);
    });
  });
});

