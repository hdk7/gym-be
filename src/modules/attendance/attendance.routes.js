"use strict";

const router = require("express").Router();
const ctrl = require("./attendance.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
  markAttendanceSchema,
  bulkMarkAttendanceSchema,
  createTrainerLogSchema,
} = require("./attendance.schema");

// ─── Attendance Core Endpoints ────────────────────────────────────────────────
router.post("/mark", validate(markAttendanceSchema), ctrl.markAttendance);
router.post("/bulk-mark", validate(bulkMarkAttendanceSchema), ctrl.bulkMarkAttendance);

// ─── Attendance Query Endpoints ───────────────────────────────────────────────
router.get("/batch/:batchId", ctrl.getBatchAttendanceGrid);
router.get("/member/:memberId", ctrl.getMemberAttendance);
router.get("/", ctrl.getAttendanceRecords);

// ─── Trainer Logs Endpoints ───────────────────────────────────────────────────
router.post("/trainer-logs", validate(createTrainerLogSchema), ctrl.recordTrainerLog);
router.get("/trainer-logs", ctrl.getAllTrainerLogs);
router.get("/trainer-logs/:trainerId", ctrl.getTrainerLogs);

// ─── Trainer Leave Policy Endpoints ──────────────────────────────────────────
router.get("/leave-policy", ctrl.getTrainerLeavePolicy);
router.put("/leave-policy", ctrl.saveTrainerLeavePolicy);
router.post("/leave-policy", ctrl.saveTrainerLeavePolicy);
router.post("/leave-policy/validate", ctrl.validateTrainerLeaveNotice);

module.exports = router;

