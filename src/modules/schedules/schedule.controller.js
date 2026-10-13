"use strict";

const scheduleService = require("./schedule.service");
const { success, created } = require("../../shared/response");

async function getAll(req, res, next) {
  try {
    const { status, batchId, search, includeDeleted } = req.query;
    const schedules = await scheduleService.getAllSchedules({
      status,
      batchId,
      search,
      includeDeleted: includeDeleted === "true",
    });
    return success(res, schedules, "Schedules retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const schedule = await scheduleService.getScheduleById(req.params.id);
    return success(res, schedule, "Schedule retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const schedule = await scheduleService.createSchedule(req.body);
    return created(res, schedule, "Schedule created successfully.");
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const schedule = await scheduleService.updateSchedule(req.params.id, req.body);
    return success(res, schedule, "Schedule updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await scheduleService.deleteSchedule(req.params.id);
    return success(res, result, "Schedule deleted successfully.");
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const schedule = await scheduleService.toggleScheduleStatus(req.params.id);
    return success(res, schedule, `Schedule status changed to ${schedule.status}.`);
  } catch (err) {
    next(err);
  }
}

async function assignBatches(req, res, next) {
  try {
    const schedule = await scheduleService.assignBatches(req.params.id, req.body.batchIds);
    return success(res, schedule, "Batches assigned successfully.");
  } catch (err) {
    next(err);
  }
}

async function duplicate(req, res, next) {
  try {
    const schedule = await scheduleService.duplicateSchedule(req.params.id);
    return created(res, schedule, "Schedule duplicated successfully.");
  } catch (err) {
    next(err);
  }
}

async function getTracking(req, res, next) {
  try {
    const tracking = await scheduleService.getBatchTrackingSummary(req.params.id);
    return success(res, tracking, "Batch tracking summary retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

// ─── Curriculum Items ───────────────────────────────────────────────────────────
async function getItems(req, res, next) {
  try {
    const items = await scheduleService.getScheduleItems(req.params.id);
    return success(res, items, "Curriculum items retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function addItem(req, res, next) {
  try {
    const item = await scheduleService.addItem(req.params.id, req.body);
    return created(res, item, "Curriculum item added successfully.");
  } catch (err) {
    next(err);
  }
}

async function updateItem(req, res, next) {
  try {
    const item = await scheduleService.updateItem(req.params.id, req.params.itemId, req.body);
    return success(res, item, "Curriculum item updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function deleteItem(req, res, next) {
  try {
    const result = await scheduleService.deleteItem(req.params.id, req.params.itemId);
    return success(res, result, "Curriculum item deleted successfully.");
  } catch (err) {
    next(err);
  }
}

async function updateItemDirect(req, res, next) {
  try {
    const item = await scheduleService.updateItemDirect(req.params.itemId, req.body);
    return success(res, item, "Curriculum item updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function deleteItemDirect(req, res, next) {
  try {
    const result = await scheduleService.deleteItemDirect(req.params.itemId);
    return success(res, result, "Curriculum item deleted successfully.");
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
  toggleStatus,
  assignBatches,
  duplicate,
  getTracking,
  getItems,
  addItem,
  updateItem,
  deleteItem,
  updateItemDirect,
  deleteItemDirect,
};

