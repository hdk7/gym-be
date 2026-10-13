"use strict";

const mongoose = require("mongoose");
const { TRAINER_STATUS, GENDER } = require("../../shared/constants");

const statsSchema = new mongoose.Schema(
  {
    clients: { type: String, default: "0+" },
    successRate: { type: String, default: "100%" },
    hours: { type: String, default: "0+" },
  },
  { _id: false }
);

const trainerSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    gender: {
      type: String,
      enum: GENDER,
      default: "Male",
    },
    experience: {
      type: String,
      required: true,
      trim: true,
    },
    phone: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    specialization: {
      type: String,
      trim: true,
      default: "Faculty Coach",
    },
    shift: {
      type: String,
      trim: true,
      default: "General (06:00 - 14:00)",
    },
    status: {
      type: String,
      enum: Object.values(TRAINER_STATUS),
      default: TRAINER_STATUS.ACTIVE,
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
    bio: {
      type: String,
      required: true,
      trim: true,
    },
    quote: {
      type: String,
      trim: true,
      default: "",
    },
    photo: {
      type: String,
      default: null,
    },
    certifications: {
      type: [String],
      default: [],
    },
    programs: {
      type: [String],
      default: [],
    },
    stats: {
      type: statsSchema,
      default: () => ({
        clients: "50+",
        successRate: "98%",
        hours: "300+",
      }),
    },
    batchIds: {
      type: [String],
      default: [],
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

// Compound text index for search across trainers
trainerSchema.index({
  name: "text",
  email: "text",
  phone: "text",
  id: "text",
});

module.exports = mongoose.model("Trainer", trainerSchema);
