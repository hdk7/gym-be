"use strict";

const yup = require("yup");
const { ATTENDANCE_STATUS, TRAINER_LOG_STATUS } = require("../../shared/constants");

const markAttendanceSchema = yup.object().shape({
  date: yup.string().trim().required("Date is required (YYYY-MM-DD)."),
  batchId: yup.string().trim().required("Batch ID is required."),
  sessionId: yup.string().trim().nullable(),
  memberId: yup.string().trim().required("Member ID is required."),
  memberName: yup.string().trim().nullable(),
  status: yup.string().oneOf(Object.values(ATTENDANCE_STATUS)).default(ATTENDANCE_STATUS.PRESENT),
  isFlexAttendance: yup.boolean().default(false),
  originalPrimaryBatchId: yup.string().trim().nullable(),
  assignmentId: yup.string().trim().nullable(),
  checkInTime: yup.string().trim().nullable(),
  checkOutTime: yup.string().trim().nullable(),
  trainerId: yup.string().trim().nullable(),
  markedBy: yup.string().trim().default("Coach"),
  notes: yup.string().trim().nullable(),
});

const bulkMarkAttendanceSchema = yup.object().shape({
  date: yup.string().trim().required("Date is required (YYYY-MM-DD)."),
  batchId: yup.string().trim().required("Batch ID is required."),
  sessionId: yup.string().trim().nullable(),
  trainerId: yup.string().trim().nullable(),
  markedBy: yup.string().trim().default("Coach"),
  attendees: yup
    .array()
    .of(
      yup.object().shape({
        memberId: yup.string().trim().required("Member ID is required."),
        memberName: yup.string().trim().nullable(),
        status: yup.string().oneOf(Object.values(ATTENDANCE_STATUS)).required("Status is required."),
        isFlexAttendance: yup.boolean().default(false),
        originalPrimaryBatchId: yup.string().trim().nullable(),
        assignmentId: yup.string().trim().nullable(),
        checkInTime: yup.string().trim().nullable(),
        checkOutTime: yup.string().trim().nullable(),
        notes: yup.string().trim().nullable(),
      })
    )
    .required("Attendees array is required."),
});

const createTrainerLogSchema = yup.object().shape({
  date: yup.string().trim().required("Date is required (YYYY-MM-DD)."),
  trainerId: yup.string().trim().required("Trainer ID is required."),
  batchId: yup.string().trim().required("Batch ID is required."),
  sessionId: yup.string().trim().nullable(),
  status: yup.string().oneOf(Object.values(TRAINER_LOG_STATUS)).default(TRAINER_LOG_STATUS.CONDUCTED),
  substituteTrainerId: yup.string().trim().nullable(),
  checkInTime: yup.string().trim().nullable(),
  checkOutTime: yup.string().trim().nullable(),
  durationMinutes: yup.number().min(0).default(60),
  attendeesCount: yup.number().min(0).default(0),
  notes: yup.string().trim().nullable(),
});

module.exports = {
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
  createTrainerLogSchema,
};
