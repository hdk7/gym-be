"use strict";

const mongoose = require("mongoose");

const holidaySchema = new mongoose.Schema(
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
    date: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    type: {
      type: String,
      trim: true,
      default: "Public Holiday",
    },
    affectedBatches: {
      type: String,
      trim: true,
      default: "ALL",
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      trim: true,
      default: "Active",
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

holidaySchema.index({ date: 1, isDeleted: 1 });

module.exports = mongoose.model("Holiday", holidaySchema);
