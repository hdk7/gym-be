"use strict";

const scheduleService = require("./schedule.service");
const { success } = require("../../shared/response");

async function getAll(req, res, next) {
  try {
    const { scheduleId, batchId, status, date } = req.query;
    const sessions = await scheduleService.getAllSessions({
      scheduleId,
      batchId,
      status,
      date,
    });
    return success(res, sessions, "Sessions retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const session = await scheduleService.getSessionById(req.params.id);
    return success(res, session, "Session retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const session = await scheduleService.updateSessionStatus(req.params.id, req.body.status);
    return success(res, session, `Session status changed to ${session.status}.`);
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const session = await scheduleService.updateSession(req.params.id, req.body);
    return success(res, session, "Session updated successfully.");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  updateStatus,
  update,
};
