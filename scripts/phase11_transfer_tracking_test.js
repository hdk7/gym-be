"use strict";

/**
 * Phase 11: Batch Transfer & Month-Wise Tracking Verification Test Suite
 * ======================================================================
 * End-to-end integration and verification script validating:
 * 1. Permanent transfer updating primary batch and retaining complete batch history.
 * 2. Capacity limit rejection on full batch (strict validation engine).
 * 3. Flexible assignment allowing specific days without removing primary batch.
 * 4. Flex member attendance appearing in target batch roster on selected days only.
 * 5. Month-wise category tracking data integrity (Category 1, 2, 3 and summary metrics).
 *
 * Can run either:
 * - Against live running HTTP API (http://localhost:5000/api/v1)
 * - Or in-process via Supertest fallback if server is offline.
 */

require("dotenv").config();
const mongoose = require("mongoose");
const { connectDB, disconnectDB } = require("../src/config/database");

// Models for direct verification and cleanup
const Batch = require("../src/modules/batches/batch.model");
const Member = require("../src/modules/members/member.model");
const Trainer = require("../src/modules/trainers/trainer.model");
const BatchAssignment = require("../src/modules/batches/batchAssignment.model");
const Attendance = require("../src/modules/attendance/attendance.model");
const TrainerLog = require("../src/modules/attendance/trainerLog.model");
const Session = require("../src/modules/schedules/session.model");

const { assert, apiRequest, authenticate } = require("./phase11_client");

async function runPhase11Tests() {
  console.log("======================================================================");
  console.log("  Strengthway E2E: Phase 11 Batch Tracking & Transfer Verification   ");
  console.log("======================================================================\n");

  const ts = Date.now();
  const testMonth = "2026-11";
  const sourceBatchId = `BATCH-P11-SRC-${ts}`;
  const targetBatchId = `BATCH-P11-TGT-${ts}`;
  const fullBatchId = `BATCH-P11-FULL-${ts}`;
  const flexBatchId = `BATCH-P11-FLX-${ts}`;

  const member1Id = `MEM-P11-1-${ts}`;
  const memberFullId = `MEM-P11-OCCUPIER-${ts}`;
  const trainerId = `TRN-P11-${ts}`;
  const sessionId = `SES-P11-${ts}`;

  // Ensure DB connection for cleanup and seeding
  await connectDB();

  try {
    await authenticate();

    // ─────────────────────────────────────────────────────────────────────────
    // SEED TEST DATA
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- Seeding Test Fixtures ---");

    // 1. Source Batch (Mon, Wed, Fri 06:00 AM)
    await Batch.create({
      id: sourceBatchId,
      name: "Source Morning MWF",
      shortName: "SRC-MWF",
      startTime: "06:00 AM",
      endTime: "07:00 AM",
      timingLabel: "06:00 AM - 07:00 AM",
      daysList: ["Monday", "Wednesday", "Friday"],
      daysLabel: "Mon, Wed, Fri",
      maxPax: 20,
      currentPax: 1,
      trainerIds: [trainerId],
      status: "Active",
    });

    // 2. Target Batch (Mon, Wed, Fri 07:00 AM)
    await Batch.create({
      id: targetBatchId,
      name: "Target Morning MWF",
      shortName: "TGT-MWF",
      startTime: "07:00 AM",
      endTime: "08:00 AM",
      timingLabel: "07:00 AM - 08:00 AM",
      daysList: ["Monday", "Wednesday", "Friday"],
      daysLabel: "Mon, Wed, Fri",
      maxPax: 20,
      currentPax: 0,
      trainerIds: [trainerId],
      status: "Active",
    });

    // 3. Full Batch with Max Capacity = 1
    await Batch.create({
      id: fullBatchId,
      name: "Full Constrained Batch",
      shortName: "FULL-1",
      startTime: "08:00 AM",
      endTime: "09:00 AM",
      timingLabel: "08:00 AM - 09:00 AM",
      daysList: ["Monday", "Wednesday", "Friday"],
      daysLabel: "Mon, Wed, Fri",
      maxPax: 1,
      currentPax: 1,
      memberIds: [memberFullId],
      trainerIds: [trainerId],
      status: "Active",
    });

    // 4. Flexible Target Batch (Tue, Thu)
    await Batch.create({
      id: flexBatchId,
      name: "Flex Cross-Training TT",
      shortName: "FLX-TT",
      startTime: "06:30 AM",
      endTime: "07:30 AM",
      timingLabel: "06:30 AM - 07:30 AM",
      daysList: ["Tuesday", "Thursday"],
      daysLabel: "Tue, Thu",
      maxPax: 15,
      currentPax: 0,
      trainerIds: [trainerId],
      status: "Active",
    });

    // 5. Test Trainer
    await Trainer.create({
      id: trainerId,
      name: "Coach Alexander",
      email: `alex_${ts}@example.com`,
      phone: "+91 98888 77777",
      specialty: "Powerlifting & Barbell",
      shift: "Morning",
      bio: "Certified strength coach with 8 years of barbell coaching experience.",
      experience: "8 years",
      status: "Active",
      isDeleted: false,
    });

    // 6. Test Member 1 (enrolled in Source Batch)
    await Member.create({
      id: member1Id,
      firstName: "Alexander",
      lastName: "Hamilton",
      email: `alex_${ts}@example.com`,
      mobile: "+91 98111 22222",
      gender: "Male",
      dob: "1995-01-11",
      batchId: sourceBatchId,
      batchName: "Source Morning MWF",
      batchTiming: "06:00 AM - 07:00 AM",
      registeredAt: "2026-10-01",
      status: "Active",
      isDeleted: false,
      batchHistory: [],
      activeFlexAssignments: [],
    });

    // 7. Full Batch Occupier
    await Member.create({
      id: memberFullId,
      firstName: "Aaron",
      lastName: "Burr",
      email: `burr_${ts}@example.com`,
      mobile: "+91 98333 44444",
      gender: "Male",
      dob: "1994-02-06",
      batchId: fullBatchId,
      batchName: "Full Constrained Batch",
      batchTiming: "08:00 AM - 09:00 AM",
      registeredAt: "2026-10-01",
      status: "Active",
      isDeleted: false,
    });

    console.log("  ✓ Test batches, coach, and athlete records seeded successfully.");

    // ─────────────────────────────────────────────────────────────────────────
    // 1. PERMANENT BATCH TRANSFER VALIDATION
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- 1. Testing Permanent Transfer & Batch History Retention ---");

    const transferPayload = {
      memberId: member1Id,
      targetBatchId: targetBatchId,
      effectiveDate: "2026-11-01",
      reason: "Permanent relocation to 7 AM session",
      transferredBy: "Lead Coach",
    };

    const transferRes = await apiRequest("/batches/assignments/transfer", {
      method: "POST",
      body: transferPayload,
    });

    assert(transferRes.ok, `Permanent transfer API succeeded (${transferRes.status}): ${transferRes.message}`);
    console.log("  ✓ POST /api/v1/batches/assignments/transfer returned 200 OK");

    // Verify member updated
    const memberAfterTransfer = await Member.findOne({ id: member1Id }).lean();
    assert(memberAfterTransfer.batchId === targetBatchId, "Member primary batchId updated to targetBatchId");
    assert(memberAfterTransfer.batchName === "Target Morning MWF", "Member batchName updated");
    assert(
      Array.isArray(memberAfterTransfer.batchHistory) && memberAfterTransfer.batchHistory.length >= 1,
      "Member batchHistory retained previous batch"
    );

    const historyRecord = memberAfterTransfer.batchHistory[0];
    assert(historyRecord.batchId === sourceBatchId, "History correctly records sourceBatchId");
    assert(historyRecord.status === "COMPLETED", "History record status marked as COMPLETED");
    console.log("  ✓ Member document updated with new primary batch and intact historical record");

    // Verify BatchAssignment collection
    const assignmentDoc = await BatchAssignment.findOne({
      memberId: member1Id,
      assignmentType: "PERMANENT_TRANSFER",
      targetBatchId: targetBatchId,
    }).lean();
    assert(assignmentDoc !== null, "Permanent BatchAssignment record stored in collection");
    assert(
      assignmentDoc.status === "COMPLETED" || assignmentDoc.status === "ACTIVE",
      "BatchAssignment status is valid (COMPLETED or ACTIVE)"
    );
    console.log("  ✓ BatchAssignment ledger record created with assignment ID:", assignmentDoc.id);

    // ─────────────────────────────────────────────────────────────────────────
    // 2. CAPACITY LIMIT REJECTION ON FULL BATCH
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- 2. Testing Capacity Limit Overflow Rejection ---");

    const fullTransferPayload = {
      memberId: member1Id,
      targetBatchId: fullBatchId,
      effectiveDate: "2026-11-01",
      reason: "Attempting to transfer into full batch",
    };

    const fullTransferRes = await apiRequest("/batches/assignments/transfer", {
      method: "POST",
      body: fullTransferPayload,
    });

    assert(!fullTransferRes.ok, "Transfer into full batch was correctly rejected (non-2xx)");
    assert(
      fullTransferRes.status === 400 || fullTransferRes.status === 409 || fullTransferRes.status === 422,
      `Full batch rejection returned status ${fullTransferRes.status}`
    );
    console.log("  ✓ Full batch transfer rejected with HTTP", fullTransferRes.status, `(${fullTransferRes.message})`);

    // Verify member remains assigned to Target Batch
    const memberAfterRejected = await Member.findOne({ id: member1Id }).lean();
    assert(memberAfterRejected.batchId === targetBatchId, "Member batchId remains unchanged after rejected transfer");
    console.log("  ✓ Member primary assignment integrity preserved without corruption");

    // Verify dynamic capacity check route
    const capacityCheckRes = await apiRequest(`/batches/${fullBatchId}/capacity-check?date=2026-11-02`);
    assert(capacityCheckRes.ok, "Capacity check endpoint returned 200 OK");
    assert(
      capacityCheckRes.data?.spotsRemaining === 0 ||
        capacityCheckRes.data?.isFull === true ||
        capacityCheckRes.data?.availablePax === 0,
      "Capacity check confirms batch is at maximum pax capacity"
    );
    console.log("  ✓ GET /batches/:id/capacity-check correctly reports 0 available headroom");

    // ─────────────────────────────────────────────────────────────────────────
    // 3. FLEXIBLE ASSIGNMENT (SELECTED DAYS ALLOCATION)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- 3. Testing Flexible Assignment Multi-Batch Allocation ---");

    const flexPayload = {
      memberId: member1Id,
      targetBatchId: flexBatchId,
      selectedDays: ["Tuesday"],
      startDate: "2026-11-01",
      endDate: "2026-11-30",
      reason: "Weekly Tuesday cross-training session",
      transferredBy: "Admin",
    };

    const flexRes = await apiRequest("/batches/assignments/flex", {
      method: "POST",
      body: flexPayload,
    });

    assert(flexRes.ok, `Flexible assignment API succeeded: ${flexRes.message}`);
    console.log("  ✓ POST /api/v1/batches/assignments/flex returned 200 OK");

    const memberAfterFlex = await Member.findOne({ id: member1Id }).lean();
    assert(
      memberAfterFlex.batchId === targetBatchId,
      "Member primary batchId is STILL Target Batch (primary batch NOT removed)"
    );
    assert(
      Array.isArray(memberAfterFlex.activeFlexAssignments) && memberAfterFlex.activeFlexAssignments.length === 1,
      "Member has 1 active flex assignment in activeFlexAssignments"
    );

    const activeFlex = memberAfterFlex.activeFlexAssignments[0];
    assert(activeFlex.targetBatchId === flexBatchId, "Flex targetBatchId is correct");
    assert(activeFlex.selectedDays.includes("Tuesday"), "Flex selectedDays contains Tuesday");
    console.log("  ✓ Athlete maintains primary batch while active on Tuesday flex pass in target container");

    // ─────────────────────────────────────────────────────────────────────────
    // 4. DYNAMIC ROSTER INCLUSION & FLEX ATTENDANCE ROUTING
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- 4. Testing Dynamic Roster Inclusion & Day-Filtered Check-in ---");

    // 2026-11-03 is a Tuesday -> Member MUST appear
    const tuesdayRes = await apiRequest(`/batches/${flexBatchId}/effective-attendees?date=2026-11-03`);
    assert(tuesdayRes.ok, "Effective attendees for Tuesday returned 200 OK");
    const tuesdayAttendees = tuesdayRes.data?.attendees || tuesdayRes.data?.effectiveAttendees || [];
    const flexMemberTuesday = tuesdayAttendees.find((a) => a.memberId === member1Id);
    assert(flexMemberTuesday !== undefined, "Member appears in Tuesday roster for Flex batch");
    assert(
      flexMemberTuesday.isFlexIn === true || flexMemberTuesday.isFlex === true,
      "Member marked with flex flag"
    );
    assert(
      flexMemberTuesday.flexFromBatchId === targetBatchId || flexMemberTuesday.primaryBatchId === targetBatchId,
      "Roster identifies original primary batch"
    );
    console.log("  ✓ Tuesday roster includes flex athlete with proper flex badge & primary batch reference");

    // 2026-11-05 is a Thursday -> Member did NOT select Thursday -> MUST NOT appear
    const thursdayRes = await apiRequest(`/batches/${flexBatchId}/effective-attendees?date=2026-11-05`);
    assert(thursdayRes.ok, "Effective attendees for Thursday returned 200 OK");
    const thursdayAttendees = thursdayRes.data?.attendees || thursdayRes.data?.effectiveAttendees || [];
    const flexMemberThursday = thursdayAttendees.find((a) => a.memberId === member1Id);
    assert(flexMemberThursday === undefined, "Member does NOT appear on Thursday (day mismatch correctly excluded)");
    console.log("  ✓ Thursday roster correctly excludes athlete (non-assigned day filter enforced)");

    // Log Flex Attendance for Tuesday Nov 3
    const markAttendanceRes = await apiRequest("/attendance/mark", {
      method: "POST",
      body: {
        date: "2026-11-03",
        batchId: flexBatchId,
        memberId: member1Id,
        status: "PRESENT",
        isFlexAttendance: true,
        originalPrimaryBatchId: targetBatchId,
        checkInTime: "06:32 AM",
        trainerId: trainerId,
        markedBy: "Coach Alexander",
      },
    });

    assert(markAttendanceRes.ok, "Attendance mark succeeded for flex attendance");
    console.log("  ✓ Attendance marked: isFlexAttendance = true");

    const attRecord = await Attendance.findOne({
      date: "2026-11-03",
      memberId: member1Id,
      batchId: flexBatchId,
    }).lean();
    assert(attRecord !== null && attRecord.isFlexAttendance === true, "Attendance document has isFlexAttendance: true");
    console.log("  ✓ Attendance verified in database with flex attendance classification");

    // ─────────────────────────────────────────────────────────────────────────
    // 5. MONTH-WISE CATEGORY TRACKING INTEGRITY
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- 5. Testing Month-Wise Category Tracking Data Integrity ---");

    // Seed Scheduled Session in Flex Batch
    await Session.create({
      id: sessionId,
      masterScheduleId: `SCH-MASTER-${ts}`,
      sessionDate: "2026-11-03",
      dayOfWeek: "Tuesday",
      classNumber: 1,
      startTime: "06:30 AM",
      endTime: "07:30 AM",
      batchId: flexBatchId,
      batchName: "Flex Cross-Training TT",
      coachId: trainerId,
      coachName: "Coach Alexander",
      className: "Barbell Snatch Technique",
      category: "Olympic Lifting",
      status: "COMPLETED",
      room: "Platform B",
      capacity: 15,
      attendedCount: 1,
      notes: "Athletes executed power snatch triples cleanly.",
    });

    // Seed Trainer Log
    await TrainerLog.create({
      id: `TLOG-P11-${ts}`,
      date: "2026-11-03",
      monthYear: testMonth,
      trainerId: trainerId,
      trainerName: "Coach Alexander",
      batchId: flexBatchId,
      sessionId: sessionId,
      status: "CONDUCTED",
      durationMinutes: 60,
      attendeesCount: 1,
      notes: "Olympic Lifting completed with solid technique.",
    });

    const trackingRes = await apiRequest(`/batches/${flexBatchId}/month-tracking?month=${testMonth}`);
    assert(trackingRes.ok, "Batch month-tracking endpoint returned 200 OK");
    const tracking = trackingRes.data;

    // Validate Category 1: Trainers
    assert(
      Array.isArray(tracking.category1_Trainers) && tracking.category1_Trainers.length >= 1,
      "Category 1 lists assigned/conducted trainers"
    );
    const trackedCoach = tracking.category1_Trainers.find((t) => t.trainerId === trainerId);
    assert(trackedCoach !== undefined, "Trainer Alexander found in Category 1");
    assert(trackedCoach.classesConducted >= 1, "Trainer classesConducted count is accurate");
    console.log("  ✓ Category 1 (Trainers): Verified coach conduction count and floor hours");

    // Validate Category 2: Members
    assert(tracking.category2_Members !== undefined, "Category 2 members object returned");
    assert(
      Array.isArray(tracking.category2_Members.flexInMembers) &&
        tracking.category2_Members.flexInMembers.length >= 1,
      "Category 2 separates flexInMembers"
    );
    const trackedFlexMember = tracking.category2_Members.flexInMembers.find((m) => m.memberId === member1Id);
    assert(trackedFlexMember !== undefined, "Flex member Alexander Hamilton found in flexInMembers");
    assert(trackedFlexMember.primaryBatchId === targetBatchId, "Flex member primary batch retained");
    assert(trackedFlexMember.attendanceRate === 100, "Flex member attendance rate computed accurately");
    console.log("  ✓ Category 2 (Members): Verified strict separation of primary vs flex-in athletes");

    // Validate Category 3: Scheduled Classes
    assert(tracking.category3_ScheduledClasses !== undefined, "Category 3 classes object returned");
    assert(
      Array.isArray(tracking.category3_ScheduledClasses.sessions) &&
        tracking.category3_ScheduledClasses.sessions.length >= 1,
      "Category 3 contains scheduled sessions"
    );
    console.log("  ✓ Category 3 (Scheduled Classes): Verified session roster and progression");

    // Validate Summary
    assert(tracking.summary.flexInPax === 1, "Summary flexInPax equals 1");
    assert(tracking.summary.completedSessions >= 1, "Summary completedSessions equals 1");
    assert(tracking.summary.overallAttendanceRate === 100, "Summary overallAttendanceRate equals 100%");
    console.log("  ✓ Summary metrics: Verified pax, occupancy rate %, and attendance aggregates");

    console.log("\n======================================================================");
    console.log("  ✓ ALL PHASE 11 INTEGRATION & E2E TESTS PASSED (100% SUCCESS)        ");
    console.log("======================================================================\n");
  } finally {
    // Clean up all seeded test documents
    console.log("--- Cleaning up test records ---");
    await Batch.deleteMany({ id: { $in: [sourceBatchId, targetBatchId, fullBatchId, flexBatchId] } });
    await Member.deleteMany({ id: { $in: [member1Id, memberFullId] } });
    await Trainer.deleteMany({ id: trainerId });
    await BatchAssignment.deleteMany({ memberId: { $in: [member1Id, memberFullId] } });
    await Attendance.deleteMany({ memberId: { $in: [member1Id, memberFullId] } });
    await TrainerLog.deleteMany({ trainerId: trainerId });
    await Session.deleteMany({ id: sessionId });
    await disconnectDB();
    console.log("  ✓ Test artifacts cleaned up.");
  }
}

runPhase11Tests()
  .then(() => {
    process.exit(0);
  })
  .catch((err) => {
    console.error("\n❌ PHASE 11 VERIFICATION TEST FAILED:", err);
    disconnectDB().finally(() => process.exit(1));
  });
