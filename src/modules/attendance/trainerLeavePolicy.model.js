"use strict";

const mongoose = require("mongoose");

/**
 * A single notice-tier within the policy.
 * Example: { minDays: 0, maxDays: 2, requiredNoticeDays: 7, label: "Short Leave (≤ 2 days)" }
 */
const tierSchema = new mongoose.Schema(
  {
    /** Inclusive lower bound of leave-duration range (in days). */
    minDays: { type: Number, required: true, min: 0 },
    /** Inclusive upper bound of leave-duration range (in days). Null means "open-ended / more than". */
    maxDays: { type: Number, default: null },
    /** Number of calendar days of advance notice required before leaveStartDate. */
    requiredNoticeDays: { type: Number, required: true, min: 0 },
    /** Human-readable label shown in the UI for this tier. */
    label: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const trainerLeavePolicySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    /** Ordered array of tiers from shortest to longest leave duration. */
    tiers: {
      type: [tierSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Policy must have at least one tier.",
      },
    },
    /** Whether this policy is currently active and enforced. */
    isActive: { type: Boolean, default: true, index: true },
    /** Monthly paid leave allowance per trainer in days (default: 2 days). Leaves exceeding this count in a calendar month are treated as unpaid deductions. */
    monthlyPaidLeaveAllowance: { type: Number, default: 2, min: 0 },
    /** Financial deduction in INR applied per unpaid leave day. */
    unpaidDeductionPerDay: { type: Number, default: 1000, min: 0 },
    /** Free-text description/notes about this policy. */
    description: { type: String, trim: true, default: "" },
    /** ISO date string (YYYY-MM-DD) from which this policy is effective. */
    effectiveFrom: { type: String, trim: true, default: "" },
    /** Who last updated this record (audit field). */
    updatedBy: { type: String, trim: true, default: "admin" },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("TrainerLeavePolicy", trainerLeavePolicySchema);
