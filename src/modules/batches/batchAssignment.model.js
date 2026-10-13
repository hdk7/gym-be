"use strict";

const mongoose = require("mongoose");
const { ASSIGNMENT_TYPE, ASSIGNMENT_STATUS } = require("../../shared/constants");

const batchAssignmentSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    memberId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    memberName: {
      type: String,
      required: true,
      trim: true,
    },
    assignmentType: {
      type: String,
      enum: Object.values(ASSIGNMENT_TYPE),
      required: true,
      index: true,
    },
    sourceBatchId: {
      type: String,
      trim: true,
      default: "",
    },
    sourceBatchName: {
      type: String,
      trim: true,
      default: "",
    },
    targetBatchId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    targetBatchName: {
      type: String,
      required: true,
      trim: true,
    },
    selectedDays: {
      type: [String],
      default: [],
    },
    startDate: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    endDate: {
      type: String,
      default: null,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.ACTIVE,
      index: true,
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
    transferredBy: {
      type: String,
      trim: true,
      default: "Admin",
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

batchAssignmentSchema.index({ memberId: 1, status: 1 });
batchAssignmentSchema.index({ targetBatchId: 1, status: 1, startDate: 1, endDate: 1 });

module.exports = mongoose.model("BatchAssignment", batchAssignmentSchema);
