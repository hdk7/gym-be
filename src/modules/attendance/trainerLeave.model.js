"use strict";

const mongoose = require("mongoose");
const { TRAINER_LEAVE_STATUS } = require("../../shared/constants");

const trainerLeaveSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    trainerId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    trainerName: {
      type: String,
      required: true,
      trim: true,
    },
    leaveStartDate: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true,
      index: true,
    },
    leaveEndDate: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true,
      index: true,
    },
    totalDays: {
      type: Number,
      required: true,
      min: 1,
    },
    submittedOn: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true,
    },
    actualNoticeDays: {
      type: Number,
      default: 0,
    },
    requiredNoticeDays: {
      type: Number,
      default: 0,
    },
    tierLabel: {
      type: String,
      trim: true,
      default: "",
    },
    isNoticeCompliant: {
      type: Boolean,
      default: true,
      index: true,
    },
    allowPolicyOverride: {
      type: Boolean,
      default: false,
    },
    overrideReason: {
      type: String,
      trim: true,
      default: "",
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(TRAINER_LEAVE_STATUS),
      default: TRAINER_LEAVE_STATUS.PENDING,
      index: true,
    },
    reviewedBy: {
      type: String,
      trim: true,
      default: null,
    },
    reviewNote: {
      type: String,
      trim: true,
      default: "",
    },
    reviewedAt: {
      type: Date,
      default: null,
    },
    affectedBatchIds: {
      type: [String],
      default: [],
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

trainerLeaveSchema.index({ trainerId: 1, leaveStartDate: 1 });
trainerLeaveSchema.index({ status: 1, leaveStartDate: 1 });

module.exports = mongoose.model("TrainerLeave", trainerLeaveSchema);
