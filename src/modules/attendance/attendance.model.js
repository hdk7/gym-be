"use strict";

const mongoose = require("mongoose");
const { ATTENDANCE_STATUS } = require("../../shared/constants");

const attendanceSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    date: {
      type: String, // YYYY-MM-DD
      required: true,
      trim: true,
      index: true,
    },
    monthYear: {
      type: String, // YYYY-MM for fast month-wise index scan
      required: true,
      trim: true,
      index: true,
    },
    batchId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    sessionId: {
      type: String,
      trim: true,
      default: "",
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
    status: {
      type: String,
      enum: Object.values(ATTENDANCE_STATUS),
      default: ATTENDANCE_STATUS.PRESENT,
      index: true,
    },
    // Flag if attending via a flexible / temporary batch pass
    isFlexAttendance: {
      type: Boolean,
      default: false,
      index: true,
    },
    originalPrimaryBatchId: {
      type: String,
      trim: true,
      default: "",
    },
    assignmentId: {
      type: String,
      trim: true,
      default: "",
    },
    checkInTime: {
      type: String,
      trim: true,
      default: "",
    },
    checkOutTime: {
      type: String,
      trim: true,
      default: "",
    },
    trainerId: {
      type: String,
      trim: true,
      default: "",
    },
    markedBy: {
      type: String,
      trim: true,
      default: "Coach",
    },
    notes: {
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

// Compound indexes for fast month-wise and member-wise reporting
attendanceSchema.index({ batchId: 1, monthYear: 1, date: 1 });
attendanceSchema.index({ memberId: 1, monthYear: 1 });
attendanceSchema.index({ date: 1, memberId: 1, batchId: 1 }, { unique: true });

module.exports = mongoose.model("Attendance", attendanceSchema);
