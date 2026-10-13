"use strict";

jest.setTimeout(30000);

const { connectDB, disconnectDB } = require("../../config/database");
const Batch = require("./batch.model");
const Member = require("../members/member.model");
const BatchAssignment = require("./batchAssignment.model");
const batchValidationService = require("./batchValidation.service");
const batchAssignmentService = require("./batchAssignment.service");
const { ASSIGNMENT_TYPE, ASSIGNMENT_STATUS } = require("../../shared/constants");

describe("Phase 2: Validation Engine & Transfer Workflow Suite", () => {
  const ts = Date.now().toString().slice(-5);
  const batch1Id = `BATCH-P2A-${ts}`;
  const batch2Id = `BATCH-P2B-${ts}`;
  const fullBatchId = `BATCH-P2FULL-${ts}`;
  const member1Id = `MEM-P2-1-${ts}`;
  const member2Id = `MEM-P2-2-${ts}`;
  const inactiveMemberId = `MEM-P2-INACT-${ts}`;
  const expiredPlanMemberId = `MEM-P2-EXP-${ts}`;

  let createdAssignmentIds = [];

  beforeAll(async () => {
    await connectDB();

    // Clean up any stale test fixtures
    await Batch.deleteMany({ id: { $in: [batch1Id, batch2Id, fullBatchId] } });
    await Member.deleteMany({ id: { $in: [member1Id, member2Id, inactiveMemberId, expiredPlanMemberId] } });
    await BatchAssignment.deleteMany({ memberId: { $in: [member1Id, member2Id, inactiveMemberId, expiredPlanMemberId] } });

    // Seed Batch 1 (MWF, Capacity 25)
    await Batch.create({
      id: batch1Id,
      name: "Batch 1 Morning MWF",
      shortName: "Batch 1",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      timingLabel: "06:00 AM - 07:00 AM",
      daysPattern: "MWF",
      daysLabel: "Monday • Wednesday • Friday",
      daysList: ["Monday", "Wednesday", "Friday"],
      maxPax: 25,
      currentPax: 1,
      memberIds: [member1Id],
      status: "Active",
    });

    // Seed Batch 2 (MWF, Capacity 25)
    await Batch.create({
      id: batch2Id,
      name: "Batch 2 Evening MWF",
      shortName: "Batch 2",
      startTime: "06:00 PM",
      endTime: "07:00 PM",
      timingLabel: "06:00 PM - 07:00 PM",
      daysPattern: "MWF",
      daysLabel: "Monday • Wednesday • Friday",
      daysList: ["Monday", "Wednesday", "Friday"],
      maxPax: 25,
      currentPax: 0,
      memberIds: [],
      status: "Active",
    });

    // Seed Full Batch (Capacity 1, full)
    await Batch.create({
      id: fullBatchId,
      name: "Full Batch Capacity 1",
      shortName: "Full Batch",
      startTime: "08:00 AM",
      endTime: "09:00 AM",
      timingLabel: "08:00 AM - 09:00 AM",
      daysPattern: "MWF",
      daysLabel: "Monday • Wednesday • Friday",
      daysList: ["Monday", "Wednesday", "Friday"],
      maxPax: 1,
      currentPax: 1,
      memberIds: ["MEM-DUMMY-FULL"],
      status: "Active",
    });

    // Seed Member 1 (assigned to Batch 1)
    await Member.create({
      id: member1Id,
      firstName: "Rahul",
      lastName: "Dravid",
      email: `rahul_${ts}@example.com`,
      mobile: `+91 98888${ts}`,
      gender: "Male",
      dob: "1990-01-11",
      address: "Chinnaswamy Stadium",
      city: "Bengaluru",
      state: "Karnataka",
      country: "India",
      pincode: "560001",
      emergencyName: "Emergency Contact",
      batchId: batch1Id,
      batchName: "Batch 1 Morning MWF",
      batchTiming: "06:00 AM - 07:00 AM",
      status: "Active",
    });

    // Seed Member 2 (assigned to Batch 1)
    await Member.create({
      id: member2Id,
      firstName: "Virender",
      lastName: "Sehwag",
      email: `sehwag_${ts}@example.com`,
      mobile: `+91 97777${ts}`,
      gender: "Male",
      dob: "1988-10-20",
      address: "Kotla Ground",
      city: "Delhi",
      state: "Delhi",
      country: "India",
      pincode: "110002",
      emergencyName: "Emergency Contact",
      batchId: batch1Id,
      batchName: "Batch 1 Morning MWF",
      batchTiming: "06:00 AM - 07:00 AM",
      status: "Active",
    });

    // Seed Inactive Member (Rule 5)
    await Member.create({
      id: inactiveMemberId,
      firstName: "Inactive",
      lastName: "Player",
      email: `inactive_${ts}@example.com`,
      mobile: `+91 96666${ts}`,
      gender: "Male",
      dob: "1992-05-15",
      address: "Old Pavilion",
      city: "Mumbai",
      state: "Maharashtra",
      country: "India",
      pincode: "400001",
      emergencyName: "Emergency Contact",
      batchId: batch1Id,
      batchName: "Batch 1 Morning MWF",
      batchTiming: "06:00 AM - 07:00 AM",
      status: "Inactive",
    });

    // Seed Member with Expired Membership Plan (Rule 4)
    await Member.create({
      id: expiredPlanMemberId,
      firstName: "Expired",
      lastName: "Member",
      email: `expired_${ts}@example.com`,
      mobile: `+91 95555${ts}`,
      gender: "Female",
      dob: "1994-08-22",
      address: "Gym Street",
      city: "Pune",
      state: "Maharashtra",
      country: "India",
      pincode: "411001",
      emergencyName: "Emergency Contact",
      batchId: batch1Id,
      batchName: "Batch 1 Morning MWF",
      batchTiming: "06:00 AM - 07:00 AM",
      status: "Active",
      membershipPlan: {
        planId: "PLAN-1M",
        planName: "Monthly Fitness",
        startDate: "2026-08-01",
        endDate: "2026-08-31",
      },
    });
  });

  afterAll(async () => {
    await Batch.deleteMany({ id: { $in: [batch1Id, batch2Id, fullBatchId] } });
    await Member.deleteMany({ id: { $in: [member1Id, member2Id, inactiveMemberId, expiredPlanMemberId] } });
    await BatchAssignment.deleteMany({ memberId: { $in: [member1Id, member2Id, inactiveMemberId, expiredPlanMemberId] } });
    await disconnectDB();
  });

  // ─── 1. Permanent Transfer Validations & Execution ─────────────────────────
  describe("Permanent Transfer Workflow", () => {
    test("Rejects transfer if member is not active (Rule 5)", async () => {
      await expect(
        batchValidationService.validatePermanentTransfer({
          memberId: inactiveMemberId,
          targetBatchId: batch2Id,
          effectiveDate: "2026-10-01",
          reason: "Transfer inactive member",
        })
      ).rejects.toThrow(/status "Inactive"/i);
    });

    test("Rejects transfer if member has an expired membership plan (Rule 4)", async () => {
      await expect(
        batchValidationService.validatePermanentTransfer({
          memberId: expiredPlanMemberId,
          targetBatchId: batch2Id,
          effectiveDate: "2026-10-01",
          reason: "Transfer expired plan member",
        })
      ).rejects.toThrow(/expired membership plan/i);
    });

    test("Rejects transfer if target batch is already member's current batch", async () => {
      await expect(
        batchValidationService.validatePermanentTransfer({
          memberId: member1Id,
          targetBatchId: batch1Id,
          effectiveDate: "2026-10-01",
          reason: "Same batch test",
        })
      ).rejects.toThrow(/already assigned to batch/i);
    });

    test("Rejects transfer if target batch is full", async () => {
      await expect(
        batchValidationService.validatePermanentTransfer({
          memberId: member1Id,
          targetBatchId: fullBatchId,
          effectiveDate: "2026-10-01",
          reason: "Full batch test",
        })
      ).rejects.toThrow(/reached full capacity/i);
    });

    test("Successfully executes permanent transfer from Batch 1 to Batch 2", async () => {
      const result = await batchAssignmentService.executePermanentTransfer({
        memberId: member1Id,
        targetBatchId: batch2Id,
        effectiveDate: "2026-10-01",
        reason: "Relocating to evening routine",
        transferredBy: "Admin Coach",
      });

      expect(result.success).toBe(true);
      expect(result.assignment.assignmentType).toBe(ASSIGNMENT_TYPE.PERMANENT_TRANSFER);
      expect(result.assignment.sourceBatchId).toBe(batch1Id);
      expect(result.assignment.targetBatchId).toBe(batch2Id);
      createdAssignmentIds.push(result.assignment.id);

      // Verify member record updated
      const memberInDb = await Member.findOne({ id: member1Id }).lean();
      expect(memberInDb.batchId).toBe(batch2Id);
      expect(memberInDb.batchName).toBe("Batch 2 Evening MWF");
      expect(memberInDb.batchHistory.length).toBe(1);
      expect(memberInDb.batchHistory[0].batchId).toBe(batch1Id);
      expect(memberInDb.batchHistory[0].reason).toBe("Relocating to evening routine");

      // Verify old batch unenrollment and new batch enrollment
      const oldBatch = await Batch.findOne({ id: batch1Id }).lean();
      expect(oldBatch.memberIds).not.toContain(member1Id);

      const newBatch = await Batch.findOne({ id: batch2Id }).lean();
      expect(newBatch.memberIds).toContain(member1Id);
      expect(newBatch.currentPax).toBe(1);
    });
  });

  // ─── 2. Flexible / Temporary Assignment Validations & Execution ────────────
  describe("Flexible / Temporary Assignment Workflow", () => {
    test("Rejects flexible assignment if member is inactive (Rule 5)", async () => {
      await expect(
        batchValidationService.validateFlexibleAssignment({
          memberId: inactiveMemberId,
          targetBatchId: batch2Id,
          selectedDays: ["Wednesday"],
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          reason: "Inactive member flex test",
        })
      ).rejects.toThrow(/status "Inactive"/i);
    });

    test("Rejects flexible assignment if startDate is after endDate (Rule 4)", async () => {
      await expect(
        batchValidationService.validateFlexibleAssignment({
          memberId: member2Id,
          targetBatchId: batch2Id,
          selectedDays: ["Wednesday"],
          startDate: "2026-10-31",
          endDate: "2026-10-01",
          reason: "Inverted dates test",
        })
      ).rejects.toThrow(/start date cannot be after end date/i);
    });

    test("Rejects flexible assignment if member has an expired membership plan (Rule 4)", async () => {
      await expect(
        batchValidationService.validateFlexibleAssignment({
          memberId: expiredPlanMemberId,
          targetBatchId: batch2Id,
          selectedDays: ["Wednesday"],
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          reason: "Expired plan flexible test",
        })
      ).rejects.toThrow(/expired membership plan/i);
    });

    test("Rejects flexible assignment if selected days do not match target batch operating days", async () => {
      // Batch 2 operates on MWF (Mon, Wed, Fri), cannot assign "Tuesday"
      await expect(
        batchValidationService.validateFlexibleAssignment({
          memberId: member2Id,
          targetBatchId: batch2Id,
          selectedDays: ["Tuesday"],
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          reason: "Invalid day test",
        })
      ).rejects.toThrow(/not operating days/i);
    });

    test("Rejects flexible assignment if targeting the member's current primary batch", async () => {
      await expect(
        batchValidationService.validateFlexibleAssignment({
          memberId: member2Id,
          targetBatchId: batch1Id, // member 2 is in batch 1
          selectedDays: ["Wednesday"],
          startDate: "2026-10-01",
          endDate: "2026-10-31",
          reason: "Primary batch test",
        })
      ).rejects.toThrow(/already the member's primary batch/i);
    });

    test("Successfully creates flexible pass for Wednesday in Batch 2 without removing Batch 1", async () => {
      const result = await batchAssignmentService.createFlexibleAssignment({
        memberId: member2Id,
        targetBatchId: batch2Id,
        selectedDays: ["Wednesday"],
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        reason: "Client meetings on Wednesday mornings",
        transferredBy: "Head Coach",
      });

      expect(result.success).toBe(true);
      expect(result.assignment.assignmentType).toBe(ASSIGNMENT_TYPE.TEMPORARY_FLEX);
      expect(result.assignment.selectedDays).toEqual(["Wednesday"]);
      expect(result.assignment.status).toBe(ASSIGNMENT_STATUS.ACTIVE);
      createdAssignmentIds.push(result.assignment.id);

      // Verify Member 2 STILL HAS Batch 1 as primary!
      const memberInDb = await Member.findOne({ id: member2Id }).lean();
      expect(memberInDb.batchId).toBe(batch1Id);
      expect(memberInDb.activeFlexAssignments.length).toBe(1);
      expect(memberInDb.activeFlexAssignments[0].targetBatchId).toBe(batch2Id);
      expect(memberInDb.activeFlexAssignments[0].selectedDays).toEqual(["Wednesday"]);
    });

    test("Rejects duplicate conflicting flexible pass on the same day", async () => {
      await expect(
        batchAssignmentService.createFlexibleAssignment({
          memberId: member2Id,
          targetBatchId: fullBatchId,
          selectedDays: ["Wednesday"], // Member 2 already has Wed flex in Batch 2
          startDate: "2026-10-05",
          endDate: "2026-10-25",
          reason: "Conflicting flex test",
        })
      ).rejects.toThrow(/already has an active flexible pass/i);
    });
  });

  // ─── 3. Effective Batch Resolution on Date ──────────────────────────────────
  describe("Effective Batch Resolution Logic", () => {
    test("Resolves target flex batch on a Wednesday within the active flex window", async () => {
      // 2026-10-07 is a Wednesday
      const resolved = await batchAssignmentService.getEffectiveBatchForMemberOnDate(
        member2Id,
        "2026-10-07"
      );

      expect(resolved.isFlex).toBe(true);
      expect(resolved.batchId).toBe(batch2Id);
      expect(resolved.primaryBatchId).toBe(batch1Id);
      expect(resolved.dayOfWeek).toBe("Wednesday");
    });

    test("Resolves primary batch on a Monday (not covered by the Wednesday flex pass)", async () => {
      // 2026-10-05 is a Monday
      const resolved = await batchAssignmentService.getEffectiveBatchForMemberOnDate(
        member2Id,
        "2026-10-05"
      );

      expect(resolved.isFlex).toBe(false);
      expect(resolved.batchId).toBe(batch1Id);
      expect(resolved.primaryBatchId).toBe(batch1Id);
      expect(resolved.dayOfWeek).toBe("Monday");
    });
  });

  // ─── 4. Effective Batch Attendees & Dynamic Capacity ───────────────────────
  describe("Effective Batch Attendees & Capacity Calculation", () => {
    test("Reflects flex attendee in target batch roster on Wednesday", async () => {
      // On Wednesday 2026-10-07: Member 1 is primary in Batch 2, Member 2 flexes into Batch 2
      const attendeesData = await batchAssignmentService.getBatchEffectiveAttendeesForDate(
        batch2Id,
        "2026-10-07"
      );

      expect(attendeesData.dayOfWeek).toBe("Wednesday");
      expect(attendeesData.totalAttendeesCount).toBe(2);

      const flexMember = attendeesData.attendees.find((a) => a.memberId === member2Id);
      expect(flexMember).toBeDefined();
      expect(flexMember.isFlexIn).toBe(true);
      expect(flexMember.flexFromBatchId).toBe(batch1Id);
    });

    test("Computes accurate capacity metrics on date", async () => {
      const capacityInfo = await batchAssignmentService.calculateBatchCapacityOnDate(
        batch2Id,
        "2026-10-07"
      );

      expect(capacityInfo.maxPax).toBe(25);
      expect(capacityInfo.effectivePax).toBe(2);
      expect(capacityInfo.spotsRemaining).toBe(23);
      expect(capacityInfo.isFull).toBe(false);
    });
  });

  // ─── 5. Revocation Workflow ────────────────────────────────────────────────
  describe("Revocation of Flexible Assignment", () => {
    test("Revokes flex pass, marks assignment REVOKED, and restores primary schedule", async () => {
      const flexPass = await BatchAssignment.findOne({
        memberId: member2Id,
        status: ASSIGNMENT_STATUS.ACTIVE,
      }).lean();

      expect(flexPass).not.toBeNull();

      const revokeResult = await batchAssignmentService.revokeFlexibleAssignment(
        flexPass.id,
        "Doctor clearance required",
        "Admin Coach"
      );

      expect(revokeResult.success).toBe(true);
      expect(revokeResult.status).toBe(ASSIGNMENT_STATUS.REVOKED);

      // Verify member active flex list is now empty and history logged
      const memberInDb = await Member.findOne({ id: member2Id }).lean();
      expect(memberInDb.activeFlexAssignments.length).toBe(0);
      expect(memberInDb.batchHistory.length).toBe(1);
      expect(memberInDb.batchHistory[0].status).toBe("REVOKED");

      // Verify effective batch on Wednesday 2026-10-07 is now back to primary batch
      const resolved = await batchAssignmentService.getEffectiveBatchForMemberOnDate(
        member2Id,
        "2026-10-07"
      );
      expect(resolved.isFlex).toBe(false);
      expect(resolved.batchId).toBe(batch1Id);
    });
  });
});
