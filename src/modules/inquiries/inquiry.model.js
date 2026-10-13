"use strict";

const mongoose = require("mongoose");
const { INQUIRY_STATUS, GENDER, CONTACT_METHODS } = require("../../shared/constants");

const contactDetailsSchema = new mongoose.Schema(
  {
    contactedAt: { type: Date, default: null },
    contactMethod: {
      type: String,
      enum: CONTACT_METHODS,
      default: "Phone Call",
    },
    contactNotes: { type: String, trim: true, default: "" },
    contactedBy: { type: String, trim: true, default: "Admin" },
    followUpDate: { type: String, trim: true, default: "" },
    outcome: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

const statusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: "Admin" },
    notes: { type: String, default: "" },
  },
  { _id: false }
);

const inquirySchema = new mongoose.Schema(
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
    gender: {
      type: String,
      enum: GENDER,
      default: "Male",
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    subject: {
      type: String,
      trim: true,
      default: "General Inquiry",
    },
    message: {
      type: String,
      trim: true,
      default: "",
    },
    status: {
      type: String,
      enum: Object.values(INQUIRY_STATUS),
      default: INQUIRY_STATUS.INQUIRY,
      index: true,
    },
    contactDetails: {
      type: contactDetailsSchema,
      default: null,
    },
    convertedMemberId: {
      type: String,
      trim: true,
      default: null,
      index: true,
    },
    convertedAt: {
      type: Date,
      default: null,
    },
    statusHistory: {
      type: [statusHistorySchema],
      default: [],
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

// Helpful compound indexes
inquirySchema.index({ status: 1, isDeleted: 1 });
inquirySchema.index({ createdAt: -1 });

module.exports = mongoose.model("Inquiry", inquirySchema);
