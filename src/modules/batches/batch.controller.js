"use strict";

const batchService = require("./batch.service");
const batchAssignmentService = require("./batchAssignment.service");
const { success, created } = require("../../shared/response");

// ─── Batches ──────────────────────────────────────────────────────────────────
async function getAll(req, res, next) {
  try {
    const { status } = req.query;
    const batches = await batchService.getAll({ status });
    return success(res, batches, "Batches retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const batch = await batchService.getById(req.params.id);
    return success(res, batch, "Batch retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const batch = await batchService.create(req.body);
    return created(res, batch, "Batch created successfully.");
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const batch = await batchService.update(req.params.id, req.body);
    return success(res, batch, "Batch updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await batchService.delete(req.params.id);
    return success(res, result, "Batch deleted successfully.");
  } catch (err) {
    next(err);
  }
}

async function enroll(req, res, next) {
  try {
    const batch = await batchService.enrollMember(req.params.id, req.body.memberId);
    return success(res, batch, "Member enrolled in batch successfully.");
  } catch (err) {
    next(err);
  }
}

async function unenroll(req, res, next) {
  try {
    const batch = await batchService.unenrollMember(req.params.id, req.body.memberId);
    return success(res, batch, "Member unenrolled from batch successfully.");
  } catch (err) {
    next(err);
  }
}

async function syncTrainers(req, res, next) {
  try {
    const batch = await batchService.syncTrainers(req.params.id, req.body.trainerIds);
    return success(res, batch, "Batch trainers synchronized successfully.");
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const batch = await batchService.toggleStatus(req.params.id);
    return success(res, batch, `Batch status changed to ${batch.status}.`);
  } catch (err) {
    next(err);
  }
}

// ─── Coach Shifts ─────────────────────────────────────────────────────────────
async function getCoachShifts(req, res, next) {
  try {
    const shifts = await batchService.getCoachShifts();
    return success(res, shifts, "Coach shift matrix retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function toggleCoachShift(req, res, next) {
  try {
    const { coachId, slotKey } = req.body;
    const coach = await batchService.toggleCoachShift(coachId, slotKey);
    return success(res, coach, "Coach shift slot toggled successfully.");
  } catch (err) {
    next(err);
  }
}

// ─── Scheduled Classes ────────────────────────────────────────────────────────
async function getAllClasses(req, res, next) {
  try {
    const classes = await batchService.getAllClasses();
    return success(res, classes, "All scheduled classes retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getClassesByBatch(req, res, next) {
  try {
    const classes = await batchService.getClassesByBatch(req.params.id);
    return success(res, classes, "Batch scheduled classes retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function createClass(req, res, next) {
  try {
    const cls = await batchService.createClass(req.params.id, req.body);
    return created(res, cls, "Scheduled class created successfully.");
  } catch (err) {
    next(err);
  }
}

async function updateClass(req, res, next) {
  try {
    const classId = req.params.classId || req.params.id;
    const cls = await batchService.updateClass(classId, req.body);
    return success(res, cls, "Scheduled class updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function deleteClass(req, res, next) {
  try {
    const classId = req.params.classId || req.params.id;
    const result = await batchService.deleteClass(classId);
    return success(res, result, "Scheduled class deleted successfully.");
  } catch (err) {
    next(err);
  }
}

// ─── Batch Assignments & Transfers ───────────────────────────────────────────
async function transferMember(req, res, next) {
  try {
    const result = await batchAssignmentService.executePermanentTransfer({
      ...req.body,
      transferredBy: req.user?.name || req.body.transferredBy || "Admin",
    });
    return success(res, result, "Member transferred to new batch successfully.");
  } catch (err) {
    next(err);
  }
}

async function createFlexAssignment(req, res, next) {
  try {
    const result = await batchAssignmentService.createFlexibleAssignment({
      ...req.body,
      transferredBy: req.user?.name || req.body.transferredBy || "Admin",
    });
    return created(res, result, "Flexible batch pass created successfully.");
  } catch (err) {
    next(err);
  }
}

async function getMemberAssignments(req, res, next) {
  try {
    const data = await batchAssignmentService.getMemberAssignments(req.params.memberId);
    return success(res, data, "Member batch assignments retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function revokeFlexAssignment(req, res, next) {
  try {
    const assignmentId = req.params.assignmentId || req.params.id;
    const result = await batchAssignmentService.revokeFlexibleAssignment(
      assignmentId,
      req.body?.reason,
      req.user?.name || req.body?.revokedBy || "Admin"
    );
    return success(res, result, "Flexible assignment revoked successfully.");
  } catch (err) {
    next(err);
  }
}

// ─── Month-Wise Category Tracking & Capacity ──────────────────────────────────
async function getMonthTracking(req, res, next) {
  try {
    const { month } = req.query;
    const tracking = await batchService.getBatchMonthTracking(req.params.id, month);
    return success(res, tracking, "Batch month tracking retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getCapacityCheck(req, res, next) {
  try {
    const targetDate = req.query.date || new Date().toISOString().slice(0, 10);
    const capacity = await batchAssignmentService.calculateBatchCapacityOnDate(
      req.params.id,
      targetDate
    );
    return success(res, capacity, "Batch capacity calculated successfully.");
  } catch (err) {
    next(err);
  }
}

async function getEffectiveAttendees(req, res, next) {
  try {
    const targetDate = req.query.date || new Date().toISOString().slice(0, 10);
    const attendees = await batchAssignmentService.getBatchEffectiveAttendeesForDate(
      req.params.id,
      targetDate
    );
    return success(res, attendees, "Effective batch attendees retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  remove,
  enroll,
  unenroll,
  syncTrainers,
  toggleStatus,
  getCoachShifts,
  toggleCoachShift,
  getAllClasses,
  getClassesByBatch,
  createClass,
  updateClass,
  deleteClass,
  transferMember,
  createFlexAssignment,
  getMemberAssignments,
  revokeFlexAssignment,
  getMonthTracking,
  getCapacityCheck,
  getEffectiveAttendees,
};

