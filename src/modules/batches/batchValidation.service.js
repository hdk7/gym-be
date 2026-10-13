"use strict";

const batchRepository = require("./batch.repository");
const memberRepository = require("../members/member.repository");
const BatchAssignment = require("./batchAssignment.model");
const { ConflictError, BadRequestError, NotFoundError } = require("../../shared/apiError");
const {
  BATCH_STATUS,
  MEMBER_STATUS,
  ASSIGNMENT_TYPE,
  ASSIGNMENT_STATUS,
} = require("../../shared/constants");

const VALID_DAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

class BatchValidationService {
  /**
   * Validates permanent batch transfer request.
   */
  async validatePermanentTransfer({ memberId, targetBatchId, effectiveDate, reason }) {
    if (!memberId) throw new BadRequestError("Member ID is required.");
    if (!targetBatchId) throw new BadRequestError("Target Batch ID is required.");
    if (!effectiveDate) throw new BadRequestError("Effective transfer date is required.");

    // 1. Member check
    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError(`Member with ID "${memberId}" not found.`);
    }
    if (member.isDeleted || member.status !== MEMBER_STATUS.ACTIVE) {
      throw new BadRequestError(
        `Cannot transfer member "${memberId}" with status "${member.status || "Inactive"}". Reactivate member first.`
      );
    }

    // Membership plan validity check (Rule 4)
    if (member.membershipPlan && member.membershipPlan.endDate) {
      const planEnd = new Date(member.membershipPlan.endDate);
      const targetDate = new Date(effectiveDate);
      if (!isNaN(planEnd.getTime()) && planEnd < targetDate) {
        throw new BadRequestError(
          `Member "${memberId}" has an expired membership plan (ended ${planEnd.toISOString().slice(0, 10)}). Please renew membership before batch transfer.`
        );
      }
    }

    // 2. Target Batch check
    const targetBatch = await batchRepository.findById(targetBatchId);
    if (!targetBatch) {
      throw new NotFoundError(`Target batch "${targetBatchId}" not found.`);
    }
    if (targetBatch.status !== BATCH_STATUS.ACTIVE) {
      throw new BadRequestError(`Target batch "${targetBatch.name}" is currently inactive.`);
    }

    // 3. Same batch check
    if (member.batchId === targetBatchId) {
      throw new ConflictError(
        `Member is already assigned to batch "${targetBatch.name}". Transfer is redundant.`
      );
    }

    // 4. Capacity check
    const currentPax = Array.isArray(targetBatch.memberIds) ? targetBatch.memberIds.length : 0;
    const maxPax = Number(targetBatch.maxPax) || 25;
    if (currentPax >= maxPax) {
      throw new ConflictError(
        `Batch "${targetBatch.name}" has reached full capacity (${currentPax}/${maxPax} members). Permanent transfer rejected.`
      );
    }

    // 5. Effective Date validation
    const effDate = new Date(effectiveDate);
    if (isNaN(effDate.getTime())) {
      throw new BadRequestError("Effective transfer date is not a valid date format (expected YYYY-MM-DD).");
    }

    const currentBatch = member.batchId ? await batchRepository.findById(member.batchId) : null;

    return {
      valid: true,
      member,
      targetBatch,
      currentBatch,
      effectiveDate,
      reason: reason || "Permanent batch transfer",
    };
  }

  /**
   * Validates temporary / flexible batch assignment request.
   */
  async validateFlexibleAssignment({
    memberId,
    targetBatchId,
    selectedDays = [],
    startDate,
    endDate = null,
    reason,
  }) {
    if (!memberId) throw new BadRequestError("Member ID is required.");
    if (!targetBatchId) throw new BadRequestError("Target Batch ID is required.");
    if (!startDate) throw new BadRequestError("Start date is required.");

    // 1. Member check
    const member = await memberRepository.findById(memberId);
    if (!member) {
      throw new NotFoundError(`Member with ID "${memberId}" not found.`);
    }
    if (member.isDeleted || member.status !== MEMBER_STATUS.ACTIVE) {
      throw new BadRequestError(
        `Cannot assign flexible pass to member "${memberId}" with status "${member.status || "Inactive"}". Reactivate member first.`
      );
    }

    // Membership plan validity check (Rule 4)
    if (member.membershipPlan && member.membershipPlan.endDate) {
      const planEnd = new Date(member.membershipPlan.endDate);
      const targetDate = new Date(startDate);
      if (!isNaN(planEnd.getTime()) && planEnd < targetDate) {
        throw new BadRequestError(
          `Member "${memberId}" has an expired membership plan (ended ${planEnd.toISOString().slice(0, 10)}). Please renew membership before flexible assignment.`
        );
      }
    }

    // 2. Target Batch check
    const targetBatch = await batchRepository.findById(targetBatchId);
    if (!targetBatch) {
      throw new NotFoundError(`Target batch "${targetBatchId}" not found.`);
    }
    if (targetBatch.status !== BATCH_STATUS.ACTIVE) {
      throw new BadRequestError(`Target batch "${targetBatch.name}" is currently inactive.`);
    }

    // 3. Primary batch check (cannot flex into primary batch)
    if (member.batchId === targetBatchId) {
      throw new ConflictError(
        `Batch "${targetBatch.name}" is already the member's primary batch. A flexible pass is not applicable.`
      );
    }

    // 4. Selected days check
    if (!Array.isArray(selectedDays) || selectedDays.length === 0) {
      throw new BadRequestError("At least one attendance day must be selected for flexible assignment.");
    }

    const invalidDayFormat = selectedDays.filter((d) => !VALID_DAYS.includes(d));
    if (invalidDayFormat.length > 0) {
      throw new BadRequestError(
        `Invalid day names provided: [${invalidDayFormat.join(", ")}]. Must be full weekday names (e.g., "Monday").`
      );
    }

    // Applicable operating days match
    const batchOperatingDays = Array.isArray(targetBatch.daysList) ? targetBatch.daysList : [];
    const nonOperatingDays = selectedDays.filter((d) => !batchOperatingDays.includes(d));
    if (nonOperatingDays.length > 0) {
      throw new BadRequestError(
        `Selected day(s) [${nonOperatingDays.join(", ")}] are not operating days for batch "${targetBatch.name}" (${batchOperatingDays.join(", ")}).`
      );
    }

    // 5. Date validation
    const start = new Date(startDate);
    if (isNaN(start.getTime())) {
      throw new BadRequestError("Start date is invalid.");
    }

    if (endDate) {
      const end = new Date(endDate);
      if (isNaN(end.getTime())) {
        throw new BadRequestError("End date is invalid.");
      }
      if (start > end) {
        throw new BadRequestError("Start date cannot be after end date.");
      }
    }

    // 6. Double booking / Schedule conflict check
    // Check if member already has an active flex assignment covering overlapping days & dates
    const existingFlexList = await BatchAssignment.find({
      memberId,
      status: ASSIGNMENT_STATUS.ACTIVE,
      assignmentType: ASSIGNMENT_TYPE.TEMPORARY_FLEX,
      startDate: { $lte: endDate || "2099-12-31" },
      $or: [{ endDate: null }, { endDate: { $gte: startDate } }],
    }).lean();

    for (const flex of existingFlexList) {
      const overlappingDays = selectedDays.filter((d) => flex.selectedDays.includes(d));
      if (overlappingDays.length > 0 && flex.targetBatchId !== targetBatchId) {
        throw new ConflictError(
          `Member already has an active flexible pass for "${flex.targetBatchName}" on [${overlappingDays.join(", ")}] from ${flex.startDate} to ${flex.endDate || "ongoing"}.`
        );
      }
    }

    // 7. Dynamic capacity check for target batch on each selected day
    const primaryPax = Array.isArray(targetBatch.memberIds) ? targetBatch.memberIds.length : 0;
    const maxPax = Number(targetBatch.maxPax) || 25;

    for (const day of selectedDays) {
      const flexCountOnDay = await BatchAssignment.countDocuments({
        targetBatchId,
        status: ASSIGNMENT_STATUS.ACTIVE,
        assignmentType: ASSIGNMENT_TYPE.TEMPORARY_FLEX,
        selectedDays: day,
        startDate: { $lte: endDate || "2099-12-31" },
        $or: [{ endDate: null }, { endDate: { $gte: startDate } }],
      });

      if (primaryPax + flexCountOnDay >= maxPax) {
        throw new ConflictError(
          `Batch "${targetBatch.name}" has reached capacity on ${day}s (Max: ${maxPax}, Currently booked: ${primaryPax + flexCountOnDay} attendees). Flexible assignment rejected.`
        );
      }
    }

    const currentBatch = member.batchId ? await batchRepository.findById(member.batchId) : null;

    return {
      valid: true,
      member,
      targetBatch,
      currentBatch,
      selectedDays,
      startDate,
      endDate: endDate || null,
      reason: reason || "Temporary flexible attendance",
    };
  }
}

module.exports = new BatchValidationService();
