"use strict";

const mongoose = require("mongoose");
const { SCHEDULE_STATUS } = require("../../shared/constants");

const masterScheduleSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    batchIds: {
      type: [String],
      default: [],
    },
    batchId: {
      type: String,
      trim: true,
      default: "",
    },
    batchName: {
      type: String,
      trim: true,
      default: "Reusable Template (Unassigned)",
    },
    shift: {
      type: String,
      trim: true,
      default: "06:00 AM",
    },
    timing: {
      type: String,
      trim: true,
      default: "06:00 AM - 07:00 AM",
    },
    startTime: {
      type: String,
      trim: true,
      default: "06:00 AM",
    },
    endTime: {
      type: String,
      trim: true,
      default: "07:00 AM",
    },
    daysPattern: {
      type: String,
      trim: true,
      default: "MWF",
    },
    daysLabel: {
      type: String,
      trim: true,
      default: "Monday • Wednesday • Friday",
    },
    daysList: {
      type: [String],
      default: ["Monday", "Wednesday", "Friday"],
    },
    coachId: {
      type: String,
      trim: true,
      default: "TRN-101",
    },
    coachName: {
      type: String,
      trim: true,
      default: "Dolliee Ellens",
    },
    totalClasses: {
      type: Number,
      default: 12,
      min: 1,
    },
    capacity: {
      type: Number,
      default: 28,
    },
    status: {
      type: String,
      enum: Object.values(SCHEDULE_STATUS),
      default: SCHEDULE_STATUS.ACTIVE,
      index: true,
    },
    startDate: {
      type: String,
      trim: true,
      default: () => new Date().toISOString().slice(0, 10),
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
    deletedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

masterScheduleSchema.index({ status: 1, isDeleted: 1 });
masterScheduleSchema.index({ batchIds: 1 });

module.exports = mongoose.model("MasterSchedule", masterScheduleSchema);
