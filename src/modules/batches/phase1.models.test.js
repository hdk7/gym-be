"use strict";

jest.setTimeout(30000);

const { connectDB, disconnectDB } = require("../../config/database");
const BatchAssignment = require("./batchAssignment.model");
const Member = require("../members/member.model");
const Attendance = require("../attendance/attendance.model");
const TrainerLog = require("../attendance/trainerLog.model");
const {
  ASSIGNMENT_TYPE,
  ASSIGNMENT_STATUS,
  ATTENDANCE_STATUS,
  TRAINER_LOG_STATUS,
  ID_PREFIXES,
} = require("../../shared/constants");
const {
  generateAssignmentId,
  generateAttendanceId,
  generateTrainerLogId,
} = require("../../shared/idGenerator");

describe("Phase 1: Database & Schemas Verification Suite", () => {
  const ts = Date.now().toString().slice(-5);
  const testAssignmentId = `ASG-TEST-${ts}`;
  const testMemberId = `MEM-TEST-${ts}`;
  const testAttendanceId = `ATT-TEST-${ts}`;
  const testTrainerLogId = `TLOG-TEST-${ts}`;

  beforeAll(async () => {
    await connectDB();
    await BatchAssignment.deleteMany({ id: testAssignmentId });
    await Member.deleteMany({ id: testMemberId });
    await Attendance.deleteMany({ id: testAttendanceId });
    await TrainerLog.deleteMany({ id: testTrainerLogId });
  });

  afterAll(async () => {
    await BatchAssignment.deleteMany({ id: testAssignmentId });
    await Member.deleteMany({ id: testMemberId });
    await Attendance.deleteMany({ id: testAttendanceId });
    await TrainerLog.deleteMany({ id: testTrainerLogId });
    await disconnectDB();
  });

  // ─── 1. Constants & ID Generators Verification ─────────────────────────────
  test("Constants and ID generators are properly defined and frozen", () => {
    expect(ASSIGNMENT_TYPE.PRIMARY).toBe("PRIMARY");
    expect(ASSIGNMENT_TYPE.TEMPORARY_FLEX).toBe("TEMPORARY_FLEX");
    expect(ASSIGNMENT_TYPE.PERMANENT_TRANSFER).toBe("PERMANENT_TRANSFER");

    expect(ASSIGNMENT_STATUS.ACTIVE).toBe("ACTIVE");
    expect(ASSIGNMENT_STATUS.REVOKED).toBe("REVOKED");

    expect(ATTENDANCE_STATUS.PRESENT).toBe("PRESENT");
    expect(ATTENDANCE_STATUS.EXCUSED).toBe("EXCUSED");

    expect(TRAINER_LOG_STATUS.CONDUCTED).toBe("CONDUCTED");
    expect(TRAINER_LOG_STATUS.SUBSTITUTE).toBe("SUBSTITUTE");

    expect(ID_PREFIXES.ASSIGNMENT).toBe("ASG");
    expect(ID_PREFIXES.ATTENDANCE).toBe("ATT");
    expect(ID_PREFIXES.TRAINER_LOG).toBe("TLOG");

    const asgId = generateAssignmentId();
    expect(asgId).toMatch(/^ASG-\d+-\d{4}$/);

    const attId = generateAttendanceId();
    expect(attId).toMatch(/^ATT-\d+-\d{4}$/);

    const tlogId = generateTrainerLogId();
    expect(tlogId).toMatch(/^TLOG-\d+-\d{4}$/);
  });

  // ─── 2. BatchAssignment Model Verification ─────────────────────────────────
  test("BatchAssignment model creates temporary flex assignment with valid fields", async () => {
    const doc = new BatchAssignment({
      id: testAssignmentId,
      memberId: testMemberId,
      memberName: "Arun Kumar",
      assignmentType: ASSIGNMENT_TYPE.TEMPORARY_FLEX,
      sourceBatchId: "BATCH-01",
      sourceBatchName: "BATCH 1 (Morning)",
      targetBatchId: "BATCH-03",
      targetBatchName: "BATCH 3 (Evening)",
      selectedDays: ["Monday", "Wednesday"],
      startDate: "2026-10-01",
      endDate: "2026-10-31",
      status: ASSIGNMENT_STATUS.ACTIVE,
      reason: "Temporary work sprint schedule",
      transferredBy: "Admin",
    });

    const saved = await doc.save();
    expect(saved.id).toBe(testAssignmentId);
    expect(saved.assignmentType).toBe("TEMPORARY_FLEX");
    expect(saved.selectedDays).toEqual(["Monday", "Wednesday"]);
    expect(saved.status).toBe("ACTIVE");

    const retrieved = await BatchAssignment.findOne({ id: testAssignmentId }).lean();
    expect(retrieved).not.toBeNull();
    expect(retrieved.targetBatchId).toBe("BATCH-03");
  });

  test("BatchAssignment model enforces required fields and enum validity", async () => {
    const invalidDoc = new BatchAssignment({
      id: `INVALID-${Date.now()}`,
      assignmentType: "NOT_A_VALID_TYPE",
    });

    await expect(invalidDoc.validate()).rejects.toThrow();
  });

  // ─── 3. Member Model with batchHistory and activeFlexAssignments ──────────
  test("Member model persists batchHistory and activeFlexAssignments without breaking existing fields", async () => {
    const memberDoc = new Member({
      id: testMemberId,
      firstName: "Test",
      lastName: "Subject",
      email: `test_subject_${ts}@example.com`,
      mobile: `+91 99999${ts}`,
      gender: "Male",
      dob: "1992-06-15",
      address: "123 Fitness Way",
      city: "Chennai",
      state: "Tamil Nadu",
      country: "India",
      pincode: "600001",
      emergencyName: "Contact Person",
      batchId: "BATCH-01",
      batchName: "BATCH 1",
      batchTiming: "06:00 AM - 07:00 AM",
      batchHistory: [
        {
          assignmentId: `HIST-${ts}-1`,
          type: ASSIGNMENT_TYPE.PRIMARY,
          batchId: "BATCH-01",
          batchName: "BATCH 1",
          batchTiming: "06:00 AM - 07:00 AM",
          startDate: "2026-06-01",
          endDate: "2026-09-30",
          reason: "Initial enrollment",
          status: "COMPLETED",
        },
      ],
      activeFlexAssignments: [
        {
          assignmentId: `FLEX-${ts}-1`,
          targetBatchId: "BATCH-03",
          targetBatchName: "BATCH 3",
          targetBatchTiming: "06:00 PM - 07:00 PM",
          selectedDays: ["Wednesday"],
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          reason: "Evening slot for client work",
          status: ASSIGNMENT_STATUS.ACTIVE,
        },
      ],
    });

    const saved = await memberDoc.save();
    expect(saved.id).toBe(testMemberId);
    expect(saved.batchHistory.length).toBe(1);
    expect(saved.batchHistory[0].batchId).toBe("BATCH-01");
    expect(saved.activeFlexAssignments.length).toBe(1);
    expect(saved.activeFlexAssignments[0].selectedDays).toEqual(["Wednesday"]);

    // Verify existing member queries still succeed
    const queried = await Member.findOne({ id: testMemberId }).lean();
    expect(queried.batchId).toBe("BATCH-01");
    expect(queried.batchHistory[0].reason).toBe("Initial enrollment");
  });

  // ─── 4. Attendance Model Verification ──────────────────────────────────────
  test("Attendance model creates daily attendance with flex indicators", async () => {
    const attDoc = new Attendance({
      id: testAttendanceId,
      date: "2026-10-07",
      monthYear: "2026-10",
      batchId: "BATCH-03",
      sessionId: "SES-2026-1001",
      memberId: testMemberId,
      memberName: "Test Subject",
      status: ATTENDANCE_STATUS.PRESENT,
      isFlexAttendance: true,
      originalPrimaryBatchId: "BATCH-01",
      assignmentId: `FLEX-${ts}-1`,
      trainerId: "TRN-101",
      markedBy: "Dolliee Ellens",
      notes: "Attended Batch 3 via Wednesday flex pass",
    });

    const saved = await attDoc.save();
    expect(saved.id).toBe(testAttendanceId);
    expect(saved.isFlexAttendance).toBe(true);
    expect(saved.originalPrimaryBatchId).toBe("BATCH-01");
    expect(saved.monthYear).toBe("2026-10");

    const retrieved = await Attendance.findOne({ id: testAttendanceId }).lean();
    expect(retrieved.status).toBe("PRESENT");
    expect(retrieved.batchId).toBe("BATCH-03");
  });

  // ─── 5. TrainerLog Model Verification ──────────────────────────────────────
  test("TrainerLog model logs class conduction and hours for monthly tracking", async () => {
    const logDoc = new TrainerLog({
      id: testTrainerLogId,
      date: "2026-10-07",
      monthYear: "2026-10",
      trainerId: "TRN-101",
      trainerName: "Dolliee Ellens",
      batchId: "BATCH-03",
      sessionId: "SES-2026-1001",
      status: TRAINER_LOG_STATUS.CONDUCTED,
      checkInTime: "05:55 PM",
      durationMinutes: 60,
      attendeesCount: 22,
      notes: "Conducted high-intensity metabolic circuit",
    });

    const saved = await logDoc.save();
    expect(saved.id).toBe(testTrainerLogId);
    expect(saved.status).toBe("CONDUCTED");
    expect(saved.durationMinutes).toBe(60);
    expect(saved.attendeesCount).toBe(22);

    const retrieved = await TrainerLog.findOne({ id: testTrainerLogId }).lean();
    expect(retrieved.trainerName).toBe("Dolliee Ellens");
  });

  // ─── 6. Member Service batchHistory Initialization ───────────────────────────
  test("memberService initializes primary batchHistory record when registering with batchId", async () => {
    const memberService = require("../members/member.service");
    const regMemberId = `MEM-P1-${Date.now().toString().slice(-5)}`;

    const created = await memberService.create({
      id: regMemberId,
      firstName: "Phase1",
      lastName: "Tester",
      email: `phase1_${Date.now()}@example.com`,
      mobile: `+91 ${Math.floor(1000000000 + Math.random() * 9000000000)}`,
      gender: "Female",
      dob: "1995-04-20",
      address: "Phase 1 Testing Street",
      city: "Chennai",
      state: "Tamil Nadu",
      country: "India",
      pincode: "600002",
      emergencyName: "Emergency Contact",
      emergencyPhone: "+91 9888877777",
      batchId: "BATCH-01",
      batchName: "BATCH 1 (Morning)",
      batchTiming: "06:00 AM - 07:00 AM",
    });

    expect(created.id).toBe(regMemberId);
    expect(created.batchHistory).toBeDefined();
    expect(created.batchHistory.length).toBeGreaterThanOrEqual(1);
    expect(created.batchHistory[0].type).toBe("PRIMARY");
    expect(created.batchHistory[0].batchId).toBe("BATCH-01");
    expect(created.batchHistory[0].reason).toBe("Initial enrollment");

    // Clean up
    await Member.deleteOne({ id: regMemberId });
  });

  // ─── 7. Member Yup Schemas preserve batchHistory & activeFlexAssignments ──────
  test("Member validation schemas allow batchHistory and activeFlexAssignments", async () => {
    const { createMemberSchema, updateMemberSchema } = require("../members/member.schema");

    const validated = await updateMemberSchema.validate(
      {
        firstName: "UpdatedName",
        batchHistory: [
          {
            assignmentId: "ASG-VAL-1",
            type: "PRIMARY",
            batchId: "BATCH-01",
          },
        ],
        activeFlexAssignments: [
          {
            assignmentId: "ASG-VAL-2",
            targetBatchId: "BATCH-02",
          },
        ],
      },
      { stripUnknown: true }
    );

    expect(validated.batchHistory).toBeDefined();
    expect(validated.batchHistory.length).toBe(1);
    expect(validated.activeFlexAssignments).toBeDefined();
    expect(validated.activeFlexAssignments.length).toBe(1);
  });

  // ─── 8. Schema Indexes Verification ──────────────────────────────────────────
  test("Compound indexes are properly configured on BatchAssignment, Attendance, and TrainerLog", () => {
    const asgIndexes = BatchAssignment.schema.indexes();
    const asgKeys = asgIndexes.map((idx) => Object.keys(idx[0]).join("_"));
    expect(asgKeys).toContain("memberId_status");
    expect(asgKeys).toContain("targetBatchId_status_startDate_endDate");

    const attIndexes = Attendance.schema.indexes();
    const attKeys = attIndexes.map((idx) => Object.keys(idx[0]).join("_"));
    expect(attKeys).toContain("batchId_monthYear_date");
    expect(attKeys).toContain("memberId_monthYear");
    expect(attKeys).toContain("date_memberId_batchId");

    const logIndexes = TrainerLog.schema.indexes();
    const logKeys = logIndexes.map((idx) => Object.keys(idx[0]).join("_"));
    expect(logKeys).toContain("trainerId_monthYear");
    expect(logKeys).toContain("batchId_monthYear");
  });
});
