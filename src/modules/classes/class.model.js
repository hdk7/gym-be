"use strict";

const mongoose = require("mongoose");
const { CLASS_STATUS } = require("../../shared/constants");

const classSchema = new mongoose.Schema(
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
    beginnerWorkouts: {
      type: String,
      trim: true,
      default: "Not specified",
    },
    intermediateWorkouts: {
      type: String,
      trim: true,
      default: "Not specified",
    },
    workouts: [
      {
        id: {
          type: String,
          default: "",
        },
        subject: {
          type: String,
          trim: true,
          default: "",
        },
        message: {
          type: String,
          trim: true,
          default: "",
        },
      },
    ],
    status: {
      type: String,
      enum: Object.values(CLASS_STATUS),
      default: CLASS_STATUS.ACTIVE,
      index: true,
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

classSchema.index({ isDeleted: 1, status: 1 });
classSchema.index({ name: 1, isDeleted: 1 });

module.exports = mongoose.model("ClassProgram", classSchema);
