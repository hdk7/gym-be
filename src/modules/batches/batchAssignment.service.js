"use strict";

const batchRepository = require("./batch.repository");
const memberRepository = require("../members/member.repository");
const BatchAssignment = require("./batchAssignment.model");
const Member = require("../members/member.model");
const batchValidationService = require("./batchValidation.service");
const { generateAssignmentId } = require("../../shared/idGenerator");
const { ASSIGNMENT_TYPE, ASSIGNMENT_STATUS } = require("../../shared/constants");
const { NotFoundError } = require("../../shared/apiError");

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

class BatchAssignmentService {
  /**
   * 1. Permanently transfers a member to a new primary batch.
   * - Records previous batch in member's batchHistory.
   * - Unenrolls member from previous batch and decrements pax count.
   * - Enrolls member in new batch and increments pax count.
   * - Updates primary batchId, batchName, batchTiming, assignedBatch, schedule.
   * - Stores an immutable BatchAssignment record.
   */
  async executePermanentTransfer({
    memberId,
    targetBatchId,
    effectiveDate,
    reason = "Permanent batch transfer",
    transferredBy = "Admin",
  }) {
    const validated = await batchValidationService.validatePermanentTransfer({
      memberId,
      targetBatchId,
      effectiveDate,
      reason,
    });

    const { member, targetBatch, currentBatch } = validated;
    const assignmentId = generateAssignmentId();

    // 1. Prepare history entry of the previous batch
    const historyEntry = {
      assignmentId,
      type: ASSIGNMENT_TYPE.PERMANENT_TRANSFER,
      batchId: currentBatch ? currentBatch.id : (member.batchId || "UNASSIGNED"),
      batchName: currentBatch ? currentBatch.name : (member.batchName || "Unassigned"),
      batchTiming: currentBatch ? currentBatch.timingLabel : (member.batchTiming || ""),
      selectedDays: currentBatch && Array.isArray(currentBatch.daysList) ? currentBatch.daysList : [],
      startDate: member.registeredAt
        ? new Date(member.registeredAt).toISOString().slice(0, 10)
        : effectiveDate,
      endDate: effectiveDate,
      reason: reason || "Permanent batch transfer",
      transferredAt: new Date(),
      transferredBy: transferredBy || "Admin",
      status: "COMPLETED",
    };

    // 2. Unenroll from current batch
    if (member.batchId && member.batchId !== targetBatch.id) {
      await batchRepository.removeMember(member.batchId, member.id).catch(() => null);
      await batchRepository.syncPaxCount(member.batchId).catch(() => null);
    }

    // 3. Enroll into target batch
    await batchRepository.addMember(targetBatch.id, member.id);
    await batchRepository.syncPaxCount(targetBatch.id);

    // 4. Update member document
    const updatedMember = await Member.findOneAndUpdate(
      { id: member.id },
      {
        $set: {
          batchId: targetBatch.id,
          batchName: targetBatch.name,
          batchTiming: targetBatch.timingLabel,
          assignedBatch: targetBatch.name,
          schedule: {
            batchId: targetBatch.id,
            batchName: targetBatch.name,
            batchTiming: targetBatch.timingLabel,
            daysLabel: targetBatch.daysLabel,
            daysPattern: targetBatch.daysPattern,
          },
        },
        $push: { batchHistory: historyEntry },
      },
      { returnDocument: "after", lean: true }
    );

    // 5. Create immutable BatchAssignment document
    const assignment = await BatchAssignment.create({
      id: assignmentId,
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      assignmentType: ASSIGNMENT_TYPE.PERMANENT_TRANSFER,
      sourceBatchId: currentBatch ? currentBatch.id : (member.batchId || ""),
      sourceBatchName: currentBatch ? currentBatch.name : (member.batchName || ""),
      targetBatchId: targetBatch.id,
      targetBatchName: targetBatch.name,
      selectedDays: targetBatch.daysList || [],
      startDate: effectiveDate,
      endDate: null,
      status: ASSIGNMENT_STATUS.COMPLETED,
      reason,
      transferredBy,
      metadata: {
        previousTiming: currentBatch ? currentBatch.timingLabel : "",
        newTiming: targetBatch.timingLabel,
      },
    });

    return {
      success: true,
      assignment: assignment.toObject ? assignment.toObject() : assignment,
      member: updatedMember,
      targetBatch,
    };
  }

  /**
   * 2. Creates a temporary flexible assignment for specific days.
   * - Does NOT remove the member from their primary batch.
   * - Stores flex pass in member's activeFlexAssignments.
   * - Stores BatchAssignment record of type TEMPORARY_FLEX.
   */
  async createFlexibleAssignment({
    memberId,
    targetBatchId,
    selectedDays,
    startDate,
    endDate = null,
    reason = "Temporary flexible pass",
    transferredBy = "Admin",
  }) {
    const validated = await batchValidationService.validateFlexibleAssignment({
      memberId,
      targetBatchId,
      selectedDays,
      startDate,
      endDate,
      reason,
    });

    const { member, targetBatch, currentBatch } = validated;
    const assignmentId = generateAssignmentId();

    const flexEntry = {
      assignmentId,
      targetBatchId: targetBatch.id,
      targetBatchName: targetBatch.name,
      targetBatchTiming: targetBatch.timingLabel,
      selectedDays,
      startDate,
      endDate: endDate || null,
      reason: reason || "Flexible attendance pass",
      status: ASSIGNMENT_STATUS.ACTIVE,
    };

    // Update member's active flex passes
    const updatedMember = await Member.findOneAndUpdate(
      { id: member.id },
      {
        $push: { activeFlexAssignments: flexEntry },
      },
      { returnDocument: "after", lean: true }
    );

    // Create BatchAssignment document
    const assignment = await BatchAssignment.create({
      id: assignmentId,
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      assignmentType: ASSIGNMENT_TYPE.TEMPORARY_FLEX,
      sourceBatchId: currentBatch ? currentBatch.id : (member.batchId || ""),
      sourceBatchName: currentBatch ? currentBatch.name : (member.batchName || ""),
      targetBatchId: targetBatch.id,
      targetBatchName: targetBatch.name,
      selectedDays,
      startDate,
      endDate: endDate || null,
      status: ASSIGNMENT_STATUS.ACTIVE,
      reason,
      transferredBy,
      metadata: {
        primaryBatchId: member.batchId,
        primaryBatchName: member.batchName,
      },
    });

    return {
      success: true,
      assignment: assignment.toObject ? assignment.toObject() : assignment,
      member: updatedMember,
      targetBatch,
    };
  }

  /**
   * 3. Revokes an active flexible assignment.
   */
  async revokeFlexibleAssignment(assignmentId, reason = "Revoked by admin", revokedBy = "Admin") {
    const assignment = await BatchAssignment.findOne({ id: assignmentId });
    if (!assignment) {
      throw new NotFoundError(`Batch assignment with ID "${assignmentId}" not found.`);
    }

    assignment.status = ASSIGNMENT_STATUS.REVOKED;
    assignment.metadata = {
      ...assignment.metadata,
      revokedAt: new Date(),
      revocationReason: reason,
      revokedBy,
    };
    await assignment.save();

    // Pull from activeFlexAssignments in member document and record into batchHistory
    await Member.findOneAndUpdate(
      { id: assignment.memberId },
      {
        $pull: { activeFlexAssignments: { assignmentId } },
        $push: {
          batchHistory: {
            assignmentId,
            type: ASSIGNMENT_TYPE.TEMPORARY_FLEX,
            batchId: assignment.targetBatchId,
            batchName: assignment.targetBatchName,
            selectedDays: assignment.selectedDays,
            startDate: assignment.startDate,
            endDate: new Date().toISOString().slice(0, 10),
            reason: `Revoked: ${reason}`,
            transferredAt: new Date(),
            transferredBy: revokedBy,
            status: "REVOKED",
          },
        },
      }
    );

    return {
      success: true,
      id: assignmentId,
      status: ASSIGNMENT_STATUS.REVOKED,
      revokedAt: new Date(),
    };
  }

  /**
   * 4. Retrieves complete batch assignment history and active flex passes for a member.
   */
  async getMemberAssignments(memberId) {
    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError(`Member with ID "${memberId}" not found.`);
    }

    const assignments = await BatchAssignment.find({ memberId }).sort({ createdAt: -1 }).lean();

    return {
      memberId: member.id,
      memberName: `${member.firstName} ${member.lastName}`.trim(),
      primaryBatch: {
        batchId: member.batchId || "",
        batchName: member.batchName || "Unassigned",
        batchTiming: member.batchTiming || "",
      },
      activeFlexAssignments: member.activeFlexAssignments || [],
      batchHistory: member.batchHistory || [],
      assignmentsLog: assignments,
    };
  }

  /**
   * 5. Resolves the effective batch for a member on any given calendar date.
   * If member has an active flex pass covering targetDate and the corresponding day of week,
   * returns target flex batch. Otherwise returns primary batch.
   */
  async getEffectiveBatchForMemberOnDate(memberId, targetDateStr) {
    const member = await memberRepository.findById(memberId);
    if (!member) return null;

    const dateObj = new Date(targetDateStr);
    const dayOfWeek = DAY_NAMES[dateObj.getDay()];

    const flexPasses = Array.isArray(member.activeFlexAssignments)
      ? member.activeFlexAssignments
      : [];

    const activeFlex = flexPasses.find((fp) => {
      if (fp.status !== ASSIGNMENT_STATUS.ACTIVE) return false;
      if (!Array.isArray(fp.selectedDays) || !fp.selectedDays.includes(dayOfWeek)) return false;
      if (fp.startDate && fp.startDate > targetDateStr) return false;
      if (fp.endDate && fp.endDate < targetDateStr) return false;
      return true;
    });

    if (activeFlex) {
      return {
        batchId: activeFlex.targetBatchId,
        batchName: activeFlex.targetBatchName,
        batchTiming: activeFlex.targetBatchTiming,
        isFlex: true,
        flexAssignmentId: activeFlex.assignmentId,
        primaryBatchId: member.batchId,
        primaryBatchName: member.batchName,
        dayOfWeek,
      };
    }

    return {
      batchId: member.batchId,
      batchName: member.batchName,
      batchTiming: member.batchTiming,
      isFlex: false,
      flexAssignmentId: null,
      primaryBatchId: member.batchId,
      primaryBatchName: member.batchName,
      dayOfWeek,
    };
  }

  /**
   * 6. Resolves all effective attendees for a batch on any target date.
   * - Primary members attending normally.
   * - Inbound flex members whose flex pass routes them into this batch on this date.
   * - Highlights primary members who are flexed OUT to another batch on this date.
   */
  async getBatchEffectiveAttendeesForDate(batchId, targetDateStr) {
    const batch = await batchRepository.findById(batchId);
    if (!batch) {
      throw new NotFoundError(`Batch "${batchId}" not found.`);
    }

    const dateObj = new Date(targetDateStr);
    const dayOfWeek = DAY_NAMES[dateObj.getDay()];

    // 1. Primary members
    const primaryMembers = await Member.find({
      batchId,
      isDeleted: false,
      status: { $ne: "Archived" },
    }).lean();

    // 2. Inbound flex members (primary batch != batchId, but flex into batchId today)
    const flexAssignments = await BatchAssignment.find({
      targetBatchId: batchId,
      status: ASSIGNMENT_STATUS.ACTIVE,
      assignmentType: ASSIGNMENT_TYPE.TEMPORARY_FLEX,
      selectedDays: dayOfWeek,
      startDate: { $lte: targetDateStr },
      $or: [{ endDate: null }, { endDate: { $gte: targetDateStr } }],
    }).lean();

    const flexInMemberIds = flexAssignments.map((f) => f.memberId);
    const flexInMembers = flexInMemberIds.length > 0
      ? await Member.find({ id: { $in: flexInMemberIds }, isDeleted: false }).lean()
      : [];

    // Map attendees with statuses
    const attendees = [];

    // Process primary members
    for (const m of primaryMembers) {
      // Check if flexed out today
      const flexOutPass = (m.activeFlexAssignments || []).find((fp) => {
        return (
          fp.status === ASSIGNMENT_STATUS.ACTIVE &&
          Array.isArray(fp.selectedDays) &&
          fp.selectedDays.includes(dayOfWeek) &&
          (!fp.startDate || fp.startDate <= targetDateStr) &&
          (!fp.endDate || fp.endDate >= targetDateStr) &&
          fp.targetBatchId !== batchId
        );
      });

      attendees.push({
        memberId: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        mobile: m.mobile,
        photo: m.photo || null,
        isPrimaryAttendee: true,
        isFlexIn: false,
        isFlexOut: Boolean(flexOutPass),
        flexDestination: flexOutPass ? flexOutPass.targetBatchName : null,
      });
    }

    // Process flex-in members
    for (const m of flexInMembers) {
      const pass = flexAssignments.find((f) => f.memberId === m.id);
      attendees.push({
        memberId: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        email: m.email,
        mobile: m.mobile,
        photo: m.photo || null,
        isPrimaryAttendee: false,
        isFlexIn: true,
        isFlexOut: false,
        flexFromBatchId: m.batchId,
        flexFromBatchName: m.batchName,
        assignmentId: pass ? pass.id : "",
      });
    }

    return {
      batchId: batch.id,
      batchName: batch.name,
      targetDate: targetDateStr,
      dayOfWeek,
      totalAttendeesCount: attendees.filter((a) => !a.isFlexOut).length,
      maxPax: batch.maxPax || 25,
      attendees,
    };
  }

  /**
   * 7. Computes real-time capacity and occupancy metrics for a batch on any date.
   */
  async calculateBatchCapacityOnDate(batchId, targetDateStr) {
    const attendeesInfo = await this.getBatchEffectiveAttendeesForDate(batchId, targetDateStr);
    const maxPax = attendeesInfo.maxPax;
    const effectivePax = attendeesInfo.totalAttendeesCount;
    const spotsRemaining = Math.max(0, maxPax - effectivePax);
    const occupancyPercent = maxPax > 0 ? Math.min(100, Math.round((effectivePax / maxPax) * 100)) : 0;

    return {
      batchId: attendeesInfo.batchId,
      batchName: attendeesInfo.batchName,
      date: targetDateStr,
      dayOfWeek: attendeesInfo.dayOfWeek,
      maxPax,
      effectivePax,
      spotsRemaining,
      occupancyPercent,
      isFull: effectivePax >= maxPax,
    };
  }
}

module.exports = new BatchAssignmentService();
