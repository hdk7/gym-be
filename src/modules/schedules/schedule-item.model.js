"use strict";

const mongoose = require("mongoose");

const scheduleItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    masterScheduleId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    classNumber: {
      type: Number,
      required: true,
      min: 1,
    },
    weekNumber: {
      type: Number,
      default: 1,
    },
    dayOfWeek: {
      type: String,
      trim: true,
      default: "Monday",
    },
    subject: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    sessionDate: {
      type: String,
      trim: true,
      default: "",
    },
    displayDate: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      trim: true,
      default: "ACTIVE",
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

scheduleItemSchema.index({ masterScheduleId: 1, classNumber: 1 });

module.exports = mongoose.model("ScheduleItem", scheduleItemSchema);
