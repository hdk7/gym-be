"use strict";

const mongoose = require("mongoose");
const { BATCH_STATUS, DAYS_PATTERN } = require("../../shared/constants");

const batchSchema = new mongoose.Schema(
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
    },
    shortName: {
      type: String,
      trim: true,
    },
    startTime: {
      type: String,
      required: true,
      trim: true,
    },
    endTime: {
      type: String,
      required: true,
      trim: true,
    },
    timingLabel: {
      type: String,
      trim: true,
    },
    daysPattern: {
      type: String,
      default: "MWF",
      trim: true,
    },
    daysLabel: {
      type: String,
      trim: true,
    },
    daysList: {
      type: [String],
      default: [],
    },
    maxPax: {
      type: Number,
      default: 25,
      min: 1,
    },
    currentPax: {
      type: Number,
      default: 0,
      min: 0,
    },
    status: {
      type: String,
      enum: Object.values(BATCH_STATUS),
      default: BATCH_STATUS.ACTIVE,
      index: true,
    },
    trainerIds: {
      type: [String],
      default: [],
    },
    memberIds: {
      type: [String],
      default: [],
    },
    description: {
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

module.exports = mongoose.model("Batch", batchSchema);
