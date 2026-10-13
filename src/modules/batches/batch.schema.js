"use strict";

const yup = require("yup");
const { BATCH_STATUS, DAYS_PATTERN } = require("../../shared/constants");

const createBatchSchema = yup.object().shape({
  id: yup.string().trim().required("Batch ID is required (e.g. BATCH-01)."),
  name: yup.string().trim().required("Batch name is required.").min(2),
  shortName: yup.string().trim().nullable(),
  startTime: yup.string().trim().required("Start time is required (e.g. 06:00 AM)."),
  endTime: yup.string().trim().required("End time is required (e.g. 07:00 AM)."),
  timingLabel: yup.string().trim().nullable(),
  daysPattern: yup.string().trim().default("MWF"),
  daysLabel: yup.string().trim().nullable(),
  daysList: yup.array().of(yup.string()).nullable(),
  maxPax: yup.number().min(1).default(25),
  status: yup.string().oneOf(Object.values(BATCH_STATUS)).default(BATCH_STATUS.ACTIVE),
  trainerIds: yup.array().of(yup.string()).nullable(),
  memberIds: yup.array().of(yup.string()).nullable(),
  description: yup.string().trim().nullable(),
});

const updateBatchSchema = yup.object().shape({
  name: yup.string().trim().min(2),
  shortName: yup.string().trim().nullable(),
  startTime: yup.string().trim(),
  endTime: yup.string().trim(),
  timingLabel: yup.string().trim().nullable(),
  daysPattern: yup.string().trim(),
  daysLabel: yup.string().trim().nullable(),
  daysList: yup.array().of(yup.string()).nullable(),
  maxPax: yup.number().min(1),
  currentPax: yup.number().min(0),
  status: yup.string().oneOf(Object.values(BATCH_STATUS)),
  trainerIds: yup.array().of(yup.string()).nullable(),
  memberIds: yup.array().of(yup.string()).nullable(),
  description: yup.string().trim().nullable(),
});

const enrollMemberSchema = yup.object().shape({
  memberId: yup.string().trim().required("Member ID is required."),
});

const syncTrainersSchema = yup.object().shape({
  trainerIds: yup.array().of(yup.string()).required("Trainer IDs array is required."),
});

const toggleCoachSlotSchema = yup.object().shape({
  coachId: yup.string().trim().required("Coach ID is required."),
  slotKey: yup.string().trim().required("Slot key is required."),
});

const createClassSchema = yup.object().shape({
  day: yup.string().trim().required("Day of class is required."),
  title: yup.string().trim().required("Class title is required."),
  category: yup.string().trim().nullable(),
  focus: yup.string().trim().nullable(),
  intensity: yup.string().trim().nullable(),
  room: yup.string().trim().nullable(),
  coachName: yup.string().trim().nullable(),
  time: yup.string().trim().nullable(),
});

const updateClassSchema = yup.object().shape({
  day: yup.string().trim(),
  title: yup.string().trim(),
  category: yup.string().trim().nullable(),
  focus: yup.string().trim().nullable(),
  intensity: yup.string().trim().nullable(),
  room: yup.string().trim().nullable(),
  coachName: yup.string().trim().nullable(),
  time: yup.string().trim().nullable(),
});

const permanentTransferSchema = yup.object().shape({
  memberId: yup.string().trim().required("Member ID is required."),
  targetBatchId: yup.string().trim().required("Target Batch ID is required."),
  effectiveDate: yup
    .string()
    .trim()
    .default(() => new Date().toISOString().slice(0, 10))
    .required("Effective date is required (YYYY-MM-DD)."),
  reason: yup.string().trim().required("Reason for transfer is required.").min(3),
  transferredBy: yup.string().trim().default("Admin"),
});

const flexibleAssignmentSchema = yup.object().shape({
  memberId: yup.string().trim().required("Member ID is required."),
  targetBatchId: yup.string().trim().required("Target Batch ID is required."),
  selectedDays: yup
    .array()
    .of(yup.string().trim())
    .min(1, "At least one day must be selected.")
    .required("Selected attendance days are required."),
  startDate: yup.string().trim().required("Start date is required (YYYY-MM-DD)."),
  endDate: yup.string().trim().nullable(),
  reason: yup.string().trim().required("Reason for flexible assignment is required.").min(3),
  transferredBy: yup.string().trim().default("Admin"),
});

const revokeFlexAssignmentSchema = yup.object().shape({
  reason: yup.string().trim().nullable(),
  revokedBy: yup.string().trim().default("Admin"),
});

module.exports = {
  createBatchSchema,
  updateBatchSchema,
  enrollMemberSchema,
  syncTrainersSchema,
  toggleCoachSlotSchema,
  createClassSchema,
  updateClassSchema,
  permanentTransferSchema,
  flexibleAssignmentSchema,
  revokeFlexAssignmentSchema,
};

