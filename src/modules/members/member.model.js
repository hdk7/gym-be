"use strict";

const mongoose = require("mongoose");
const {
  MEMBER_STATUS,
  BLOOD_GROUPS,
  GENDER,
  ASSIGNMENT_TYPE,
  ASSIGNMENT_STATUS,
} = require("../../shared/constants");

const physicalStatsSchema = new mongoose.Schema(
  {
    height: { type: String, trim: true, default: "" },
    weight: { type: String, trim: true, default: "" },
    bmi: { type: String, trim: true, default: "" },
    bloodGroup: { type: String, enum: [...BLOOD_GROUPS, ""], default: "" },
  },
  { _id: false },
);

const emergencyContactSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, default: "" },
    phone: { type: String, trim: true, default: "" },
    relation: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const medicalDocSchema = new mongoose.Schema(
  {
    submitted: { type: Boolean, default: false },
    clearanceDate: { type: String, default: null },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const contactDetailsSchema = new mongoose.Schema(
  {
    contactedAt: { type: Date, default: null },
    contactMethod: { type: String, default: "Phone Call" },
    contactNotes: { type: String, trim: true, default: "" },
    contactedBy: { type: String, trim: true, default: "Admin" },
    followUpDate: { type: String, trim: true, default: "" },
    outcome: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const memberStatusHistorySchema = new mongoose.Schema(
  {
    status: { type: String, required: true },
    changedAt: { type: Date, default: Date.now },
    changedBy: { type: String, default: "Admin" },
    notes: { type: String, default: "" },
  },
  { _id: false },
);

const membershipPlanSnapshotSchema = new mongoose.Schema(
  {
    id: { type: String, trim: true },
    name: { type: String, trim: true },
    durationMonths: { type: Number },
    price: { type: Number },
    formattedPrice: { type: String },
    startDate: { type: Date },
    endDate: { type: Date },
    formattedStart: { type: String },
    formattedEnd: { type: String },
  },
  { _id: false },
);

const paymentDetailsSchema = new mongoose.Schema(
  {
    method: { type: String, trim: true },
    amount: { type: Number },
    formattedAmount: { type: String },
    transactionId: { type: String, trim: true },
    receiptNo: { type: String, trim: true },
    status: { type: String, default: "Completed" },
    paidAt: { type: Date, default: Date.now },
    notes: { type: String, trim: true, default: "" },
  },
  { _id: false },
);

const scheduleSchema = new mongoose.Schema(
  {
    batchId: { type: String, trim: true },
    batchName: { type: String, trim: true },
    batchTiming: { type: String, trim: true },
    daysLabel: { type: String, trim: true },
    daysPattern: { type: String, trim: true },
  },
  { _id: false },
);

const batchHistorySchema = new mongoose.Schema(
  {
    assignmentId: { type: String, trim: true },
    type: {
      type: String,
      enum: Object.values(ASSIGNMENT_TYPE),
      default: ASSIGNMENT_TYPE.PRIMARY,
    },
    batchId: { type: String, trim: true },
    batchName: { type: String, trim: true },
    batchTiming: { type: String, trim: true },
    selectedDays: { type: [String], default: [] },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: null },
    reason: { type: String, trim: true, default: "" },
    transferredAt: { type: Date, default: Date.now },
    transferredBy: { type: String, trim: true, default: "Admin" },
    status: { type: String, default: "COMPLETED" },
  },
  { _id: false },
);

const activeFlexAssignmentSchema = new mongoose.Schema(
  {
    assignmentId: { type: String, trim: true },
    targetBatchId: { type: String, trim: true },
    targetBatchName: { type: String, trim: true },
    targetBatchTiming: { type: String, trim: true },
    selectedDays: { type: [String], default: [] },
    startDate: { type: String, default: "" },
    endDate: { type: String, default: null },
    reason: { type: String, trim: true, default: "" },
    status: {
      type: String,
      enum: Object.values(ASSIGNMENT_STATUS),
      default: ASSIGNMENT_STATUS.ACTIVE,
    },
  },
  { _id: false },
);

const memberSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      unique: true,
      required: true,
      trim: true,
      index: true,
    },
    firstName: {
      type: String,
      required: true,
      trim: true,
    },
    lastName: {
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
    mobile: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    gender: {
      type: String,
      enum: GENDER,
      required: true,
    },
    dob: {
      type: String,
      required: true,
    },
    height: {
      type: String,
      trim: true,
      default: "",
    },
    weight: {
      type: String,
      trim: true,
      default: "",
    },
    bloodGroup: {
      type: String,
      enum: [...BLOOD_GROUPS, ""],
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    city: {
      type: String,
      trim: true,
      default: "",
    },
    state: {
      type: String,
      trim: true,
      default: "",
    },
    country: {
      type: String,
      trim: true,
      default: "India",
    },
    pincode: {
      type: String,
      trim: true,
      default: "",
    },
    photo: {
      type: String,
      default: null,
    },
    photoName: {
      type: String,
      default: null,
    },
    bio: {
      type: String,
      trim: true,
      default: "",
    },

    status: {
      type: String,
      enum: Object.values(MEMBER_STATUS),
      default: MEMBER_STATUS.ACTIVE,
      index: true,
    },
    inquiryId: {
      type: String,
      trim: true,
      default: "",
      index: true,
    },
    contactDetails: {
      type: contactDetailsSchema,
      default: null,
    },
    statusHistory: {
      type: [memberStatusHistorySchema],
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

    batchId: {
      type: String,
      default: "",
      trim: true,
    },
    batchName: {
      type: String,
      default: "",
      trim: true,
    },
    batchTiming: {
      type: String,
      default: "",
      trim: true,
    },
    assignedBatch: {
      type: String,
      default: "General Access",
      trim: true,
    },
    schedule: {
      type: scheduleSchema,
      default: null,
    },
    batchHistory: {
      type: [batchHistorySchema],
      default: [],
    },
    activeFlexAssignments: {
      type: [activeFlexAssignmentSchema],
      default: [],
    },

    physicalStats: {
      type: physicalStatsSchema,
      default: null,
    },
    emergencyName: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyPhone: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyRelation: {
      type: String,
      trim: true,
      default: "",
    },
    emergencyContact: {
      type: emergencyContactSchema,
      default: null,
    },
    medicalDoc: {
      type: medicalDocSchema,
      default: () => ({ submitted: false, clearanceDate: null, notes: "" }),
    },

    membershipPlan: {
      type: membershipPlanSnapshotSchema,
      default: null,
    },
    paymentDetails: {
      type: paymentDetailsSchema,
      default: null,
    },

    convertedAt: {
      type: Date,
      default: null,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: { createdAt: "registeredAt", updatedAt: "updatedAt" },
    versionKey: false,
  },
);

// Compound text index for search across members
memberSchema.index({
  firstName: "text",
  lastName: "text",
  email: "text",
  mobile: "text",
  id: "text",
});

module.exports = mongoose.model("Member", memberSchema);
