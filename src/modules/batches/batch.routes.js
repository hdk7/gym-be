"use strict";

const router = require("express").Router();
const ctrl = require("./batch.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
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
} = require("./batch.schema");

// ─── Literal Routes (Must precede /:id) ───────────────────────────────────────
router.get("/coach-shifts", ctrl.getCoachShifts);
router.patch("/coach-shifts/toggle", validate(toggleCoachSlotSchema), ctrl.toggleCoachShift);

router.get("/classes", ctrl.getAllClasses);
router.put("/classes/:classId", validate(updateClassSchema), ctrl.updateClass);
router.delete("/classes/:classId", ctrl.deleteClass);

// ─── Batch Assignments & Transfers Literal Routes ─────────────────────────────
router.post("/assignments/transfer", validate(permanentTransferSchema), ctrl.transferMember);
router.post("/assignments/flex", validate(flexibleAssignmentSchema), ctrl.createFlexAssignment);
router.get("/assignments/member/:memberId", ctrl.getMemberAssignments);
router.delete("/assignments/:assignmentId/revoke", validate(revokeFlexAssignmentSchema), ctrl.revokeFlexAssignment);
router.delete("/assignments/:id/revoke", validate(revokeFlexAssignmentSchema), ctrl.revokeFlexAssignment);
router.post("/assignments/:assignmentId/revoke", validate(revokeFlexAssignmentSchema), ctrl.revokeFlexAssignment);
router.post("/assignments/:id/revoke", validate(revokeFlexAssignmentSchema), ctrl.revokeFlexAssignment);

// ─── Batches Core ─────────────────────────────────────────────────────────────
router.get("/", ctrl.getAll);
router.post("/", validate(createBatchSchema), ctrl.create);
router.get("/:id", ctrl.getById);
router.put("/:id", validate(updateBatchSchema), ctrl.update);
router.patch("/:id", validate(updateBatchSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

// ─── Batch Sub-routes ─────────────────────────────────────────────────────────
router.patch("/:id/enroll", validate(enrollMemberSchema), ctrl.enroll);
router.patch("/:id/unenroll", validate(enrollMemberSchema), ctrl.unenroll);
router.patch("/:id/sync-trainers", validate(syncTrainersSchema), ctrl.syncTrainers);
router.patch("/:id/toggle-status", ctrl.toggleStatus);

// ─── Month-Wise Tracking & Dynamic Capacity Sub-routes ────────────────────────
router.get("/:id/month-tracking", ctrl.getMonthTracking);
router.get("/:id/capacity-check", ctrl.getCapacityCheck);
router.get("/:id/effective-attendees", ctrl.getEffectiveAttendees);

// ─── Batch Scheduled Classes Sub-routes ───────────────────────────────────────
router.get("/:id/classes", ctrl.getClassesByBatch);
router.post("/:id/classes", validate(createClassSchema), ctrl.createClass);
router.put("/:id/classes/:classId", validate(updateClassSchema), ctrl.updateClass);
router.delete("/:id/classes/:classId", ctrl.deleteClass);

// ─── Batch Reusable Classes Scheduling, Shuffling & History Sub-routes ────────
const batchScheduleCtrl = require("../classes/batchSchedule.controller");
router.get("/:id/schedule", batchScheduleCtrl.getBatchSchedule);
router.post("/:id/schedule/assign-classes", batchScheduleCtrl.assignClasses);
router.post("/:id/schedule/shuffle", batchScheduleCtrl.shuffleClasses);
router.get("/:id/schedule/history", batchScheduleCtrl.getScheduleHistory);

module.exports = router;

