"use strict";

const mongoose = require("mongoose");
const { TRAINER_LOG_STATUS } = require("../../shared/constants");

const trainerLogSchema = new mongoose.Schema(
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
      type: String, // YYYY-MM
      required: true,
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
    status: {
      type: String,
      enum: Object.values(TRAINER_LOG_STATUS),
      default: TRAINER_LOG_STATUS.CONDUCTED,
      index: true,
    },
    substituteTrainerId: {
      type: String,
      trim: true,
      default: null,
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
    durationMinutes: {
      type: Number,
      default: 60,
    },
    attendeesCount: {
      type: Number,
      default: 0,
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

trainerLogSchema.index({ trainerId: 1, monthYear: 1 });
trainerLogSchema.index({ batchId: 1, monthYear: 1 });

module.exports = mongoose.model("TrainerLog", trainerLogSchema);
