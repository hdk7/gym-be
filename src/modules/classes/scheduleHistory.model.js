"use strict";

const mongoose = require("mongoose");
const { SCHEDULE_CHANGE_ACTION } = require("../../shared/constants");

const scheduleHistorySchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    batchId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    action: {
      type: String,
      enum: Object.values(SCHEDULE_CHANGE_ACTION),
      required: true,
      index: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    changeDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    performedBy: {
      type: String,
      trim: true,
      default: "Admin",
    },
    reason: {
      type: String,
      trim: true,
      default: "",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

scheduleHistorySchema.index({ batchId: 1, createdAt: -1 });
scheduleHistorySchema.index({ action: 1, createdAt: -1 });

module.exports = mongoose.model("ScheduleHistory", scheduleHistorySchema);
