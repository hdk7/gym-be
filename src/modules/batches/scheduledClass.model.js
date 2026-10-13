"use strict";

const mongoose = require("mongoose");

const scheduledClassSchema = new mongoose.Schema(
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
    day: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "Functional Fitness",
      trim: true,
    },
    focus: {
      type: String,
      default: "",
      trim: true,
    },
    intensity: {
      type: String,
      default: "High",
      trim: true,
    },
    room: {
      type: String,
      default: "Main Rig & Platforms",
      trim: true,
    },
    coachName: {
      type: String,
      default: "",
      trim: true,
    },
    time: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

module.exports = mongoose.model("ScheduledClass", scheduledClassSchema);
