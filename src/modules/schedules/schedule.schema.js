"use strict";

const yup = require("yup");
const { SCHEDULE_STATUS, SESSION_STATUS, HOLIDAY_TYPE } = require("../../shared/constants");

const createScheduleSchema = yup.object().shape({
  id: yup.string().trim().nullable(),
  name: yup.string().trim().required("Schedule name is required."),
  batchIds: yup.array().of(yup.string()).nullable(),
  batchId: yup.string().trim().nullable(),
  batchName: yup.string().trim().nullable(),
  shift: yup.string().trim().nullable(),
  timing: yup.string().trim().nullable(),
  startTime: yup.string().trim().nullable(),
  endTime: yup.string().trim().nullable(),
  daysPattern: yup.string().trim().nullable(),
  daysLabel: yup.string().trim().nullable(),
  daysList: yup.array().of(yup.string()).nullable(),
  coachId: yup.string().trim().nullable(),
  coachName: yup.string().trim().nullable(),
  totalClasses: yup.number().min(1).nullable(),
  capacity: yup.number().nullable(),
  status: yup.string().oneOf(Object.values(SCHEDULE_STATUS)).nullable(),
  startDate: yup.string().trim().nullable(),
  description: yup.string().trim().nullable(),
  items: yup.array().nullable(),
});

const updateScheduleSchema = yup.object().shape({
  name: yup.string().trim().min(2).nullable(),
  batchIds: yup.array().of(yup.string()).nullable(),
  batchId: yup.string().trim().nullable(),
  batchName: yup.string().trim().nullable(),
  shift: yup.string().trim().nullable(),
  timing: yup.string().trim().nullable(),
  startTime: yup.string().trim().nullable(),
  endTime: yup.string().trim().nullable(),
  daysPattern: yup.string().trim().nullable(),
  daysLabel: yup.string().trim().nullable(),
  daysList: yup.array().of(yup.string()).nullable(),
  coachId: yup.string().trim().nullable(),
  coachName: yup.string().trim().nullable(),
  totalClasses: yup.number().min(1).nullable(),
  capacity: yup.number().nullable(),
  status: yup.string().oneOf(Object.values(SCHEDULE_STATUS)).nullable(),
  startDate: yup.string().trim().nullable(),
  description: yup.string().trim().nullable(),
  items: yup.array().nullable(),
});

const assignBatchesSchema = yup.object().shape({
  batchIds: yup.array().of(yup.string()).required("batchIds array is required."),
});

const createItemSchema = yup.object().shape({
  classNumber: yup.number().min(1).nullable(),
  subject: yup.string().trim().required("Subject is required."),
  message: yup.string().trim().nullable(),
  dayOfWeek: yup.string().trim().nullable(),
  weekNumber: yup.number().nullable(),
  sessionDate: yup.string().trim().nullable(),
  displayDate: yup.string().trim().nullable(),
  status: yup.string().trim().nullable(),
});

const updateItemSchema = yup.object().shape({
  classNumber: yup.number().min(1).nullable(),
  subject: yup.string().trim().nullable(),
  message: yup.string().trim().nullable(),
  className: yup.string().trim().nullable(),
  classId: yup.string().trim().nullable(),
  beginnerWorkouts: yup.string().trim().nullable(),
  intermediateWorkouts: yup.string().trim().nullable(),
  dayOfWeek: yup.string().trim().nullable(),
  weekNumber: yup.number().nullable(),
  sessionDate: yup.string().trim().nullable(),
  displayDate: yup.string().trim().nullable(),
  status: yup.string().trim().nullable(),
});

const updateSessionStatusSchema = yup.object().shape({
  status: yup.string().oneOf(Object.values(SESSION_STATUS), "Invalid session status.").required("Status is required."),
});

const updateSessionSchema = yup.object().shape({
  status: yup.string().oneOf(Object.values(SESSION_STATUS)).nullable(),
  notes: yup.string().trim().nullable(),
  attendedCount: yup.number().min(0).nullable(),
  feedback: yup.string().trim().nullable(),
  coachName: yup.string().trim().nullable(),
  subject: yup.string().trim().nullable(),
  message: yup.string().trim().nullable(),
  className: yup.string().trim().nullable(),
  classId: yup.string().trim().nullable(),
  beginnerWorkouts: yup.string().trim().nullable(),
  intermediateWorkouts: yup.string().trim().nullable(),
});

const createHolidaySchema = yup.object().shape({
  id: yup.string().trim().nullable(),
  name: yup.string().trim().required("Holiday name is required."),
  date: yup.string().trim().required("Date is required."),
  type: yup.string().trim().nullable(),
  affectedBatches: yup.string().trim().nullable(),
  description: yup.string().trim().nullable(),
  status: yup.string().trim().nullable(),
});

const updateHolidaySchema = yup.object().shape({
  name: yup.string().trim().nullable(),
  date: yup.string().trim().nullable(),
  type: yup.string().trim().nullable(),
  affectedBatches: yup.string().trim().nullable(),
  description: yup.string().trim().nullable(),
  status: yup.string().trim().nullable(),
});

module.exports = {
  createScheduleSchema,
  updateScheduleSchema,
  assignBatchesSchema,
  createItemSchema,
  updateItemSchema,
  updateSessionStatusSchema,
  updateSessionSchema,
  createHolidaySchema,
  updateHolidaySchema,
};
