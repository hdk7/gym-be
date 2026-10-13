"use strict";

const TrainerLeavePolicy = require("./trainerLeavePolicy.model");
const { BadRequestError, NotFoundError } = require("../../shared/apiError");

const DEFAULT_POLICY_ID = "DEFAULT_TRAINER_LEAVE_POLICY";

const DEFAULT_TIERS = [
  {
    minDays: 0,
    maxDays: 2,
    requiredNoticeDays: 7,
    label: "0–2 Days Leave (1 Week Notice)",
  },
  {
    minDays: 2.01,
    maxDays: 5,
    requiredNoticeDays: 14,
    label: "2–5 Days Leave (2 Weeks Notice)",
  },
  {
    minDays: 5.01,
    maxDays: 10,
    requiredNoticeDays: 30,
    label: "5–10 Days Leave (1 Month Notice)",
  },
  {
    minDays: 10.01,
    maxDays: null,
    requiredNoticeDays: 60,
    label: "More than 10 Days Leave (2 Months Notice)",
  },
];

/**
 * Calculates total leave days between two dates inclusive (YYYY-MM-DD).
 */
function calculateLeaveDays(startDate, endDate) {
  if (!startDate || !endDate) return 1;
  const d1 = new Date(startDate + "T00:00:00Z");
  const d2 = new Date(endDate + "T00:00:00Z");
  if (isNaN(d1.getTime()) || isNaN(d2.getTime())) {
    throw new BadRequestError("Invalid date format. Expected YYYY-MM-DD.");
  }
  if (d2 < d1) {
    throw new BadRequestError("Leave end date cannot be earlier than start date.");
  }
  const diffMs = d2.getTime() - d1.getTime();
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)) + 1);
}

/**
 * Finds which tier applies for a given number of leave days.
 */
function findMatchingTier(tiers, totalDays) {
  if (!Array.isArray(tiers) || tiers.length === 0) return null;
  const sorted = [...tiers].sort((a, b) => (a.minDays ?? 0) - (b.minDays ?? 0));

  for (const tier of sorted) {
    const min = Number(tier.minDays ?? 0);
    const max = tier.maxDays !== null && tier.maxDays !== undefined ? Number(tier.maxDays) : Infinity;
    if (totalDays >= min && totalDays <= max) {
      return tier;
    }
  }
  return sorted[sorted.length - 1];
}

class TrainerLeavePolicyService {
  /**
   * Retrieves the active Trainer Leave Policy document.
   * If none exists in DB, creates and seeds the default policy.
   */
  async getPolicy() {
    let policy = await TrainerLeavePolicy.findOne({ id: DEFAULT_POLICY_ID }).lean();

    if (!policy) {
      // Seed default document
      const created = await TrainerLeavePolicy.create({
        id: DEFAULT_POLICY_ID,
        tiers: DEFAULT_TIERS,
        isActive: true,
        monthlyPaidLeaveAllowance: 2,
        unpaidDeductionPerDay: 1000,
        description: "Standard Trainer Leave Policy with duration-based advance notice requirements.",
        effectiveFrom: new Date().toISOString().slice(0, 10),
        updatedBy: "System",
      });
      policy = created.toObject();
    }

    return policy;
  }

  /**
   * Upserts the active Trainer Leave Policy.
   */
  async savePolicy(payload, updatedBy = "admin") {
    if (!payload || !Array.isArray(payload.tiers) || payload.tiers.length === 0) {
      throw new BadRequestError("Policy must contain at least one notice tier.");
    }

    // Validate tier numbers
    for (const tier of payload.tiers) {
      if (typeof tier.requiredNoticeDays !== "number" || tier.requiredNoticeDays < 0) {
        throw new BadRequestError("Required notice days must be a non-negative number.");
      }
      if (typeof tier.minDays !== "number" || tier.minDays < 0) {
        throw new BadRequestError("Tier minDays must be a non-negative number.");
      }
    }

    const updateData = {
      tiers: payload.tiers,
      isActive: payload.isActive !== undefined ? Boolean(payload.isActive) : true,
      monthlyPaidLeaveAllowance: typeof payload.monthlyPaidLeaveAllowance === "number" && payload.monthlyPaidLeaveAllowance >= 0
        ? payload.monthlyPaidLeaveAllowance
        : 2,
      unpaidDeductionPerDay: typeof payload.unpaidDeductionPerDay === "number" && payload.unpaidDeductionPerDay >= 0
        ? payload.unpaidDeductionPerDay
        : 1000,
      description: payload.description ? String(payload.description).trim() : "",
      effectiveFrom: payload.effectiveFrom || new Date().toISOString().slice(0, 10),
      updatedBy: updatedBy || "admin",
    };

    const policy = await TrainerLeavePolicy.findOneAndUpdate(
      { id: DEFAULT_POLICY_ID },
      { $set: updateData },
      { new: true, upsert: true, runValidators: true }
    ).lean();

    return policy;
  }

  /**
   * Validates a proposed leave window against the policy.
   *
   * @param {string} startDate - YYYY-MM-DD
   * @param {string} endDate   - YYYY-MM-DD
   * @param {string} [submittedOn] - YYYY-MM-DD (defaults to today)
   * @returns {Object} validation result
   */
  async validateLeaveNotice(startDate, endDate, submittedOn) {
    if (!startDate || !endDate) {
      throw new BadRequestError("Both startDate and endDate are required.");
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const submissionDateStr = submittedOn || todayStr;

    const totalDays = calculateLeaveDays(startDate, endDate);
    const policy = await this.getPolicy();

    if (!policy.isActive) {
      return {
        isValid: true,
        policyActive: false,
        totalDays,
        requiredNoticeDays: 0,
        actualNoticeDays: 0,
        tier: null,
        message: "Leave policy enforcement is currently disabled.",
      };
    }

    const tier = findMatchingTier(policy.tiers, totalDays);
    const requiredNoticeDays = tier ? Number(tier.requiredNoticeDays) : 0;

    const dSub = new Date(submissionDateStr + "T00:00:00Z");
    const dStart = new Date(startDate + "T00:00:00Z");
    const diffMs = dStart.getTime() - dSub.getTime();
    const actualNoticeDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    const earliestStart = new Date(dSub.getTime() + requiredNoticeDays * 24 * 60 * 60 * 1000);
    const earliestEligibleStartDate = earliestStart.toISOString().slice(0, 10);

    const isValid = actualNoticeDays >= requiredNoticeDays;

    let message = "";
    if (isValid) {
      message = `Leave request complies with policy. ${totalDays} day(s) requested with ${actualNoticeDays} day(s) advance notice (${requiredNoticeDays} day(s) required).`;
    } else {
      const daysShort = requiredNoticeDays - actualNoticeDays;
      message = `Insufficient advance notice. A leave of ${totalDays} day(s) requires at least ${requiredNoticeDays} day(s) advance notice (${tier?.label || "tier rule"}). You provided ${Math.max(0, actualNoticeDays)} day(s). Earliest eligible start date is ${earliestEligibleStartDate} (${daysShort} day(s) short).`;
    }

    return {
      isValid,
      policyActive: true,
      totalDays,
      requiredNoticeDays,
      actualNoticeDays: Math.max(0, actualNoticeDays),
      earliestEligibleStartDate,
      tier,
      message,
    };
  }
}

module.exports = new TrainerLeavePolicyService();
