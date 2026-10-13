"use strict";

const trainerLeaveService = require("./trainerLeave.service");
const { success, created } = require("../../shared/response");

async function createLeaveRequest(req, res, next) {
  try {
    const leave = await trainerLeaveService.createLeaveRequest(req.body, req.user);
    return created(res, leave, "Trainer leave request submitted successfully.");
  } catch (err) {
    next(err);
  }
}

async function getLeaveRequests(req, res, next) {
  try {
    const leaves = await trainerLeaveService.getLeaveRequests(req.query);
    return success(res, leaves, "Trainer leave requests retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getLeaveRequestById(req, res, next) {
  try {
    const leave = await trainerLeaveService.getLeaveRequestById(req.params.id);
    return success(res, leave, "Trainer leave request details retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function updateLeaveStatus(req, res, next) {
  try {
    const leave = await trainerLeaveService.updateLeaveStatus(req.params.id, {
      ...req.body,
      reviewedBy: req.user?.name || req.body.reviewedBy || "admin",
    });
    return success(res, leave, `Leave request status updated to ${leave.status}.`);
  } catch (err) {
    next(err);
  }
}

async function cancelLeaveRequest(req, res, next) {
  try {
    const leave = await trainerLeaveService.cancelLeaveRequest(req.params.id, req.user);
    return success(res, leave, "Leave request cancelled successfully.");
  } catch (err) {
    next(err);
  }
}

async function getMonthlyLeaveSummary(req, res, next) {
  try {
    const summary = await trainerLeaveService.getMonthlyLeaveSummary(req.query);
    return success(res, summary, "Monthly trainer leave summary retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createLeaveRequest,
  getLeaveRequests,
  getLeaveRequestById,
  updateLeaveStatus,
  cancelLeaveRequest,
  getMonthlyLeaveSummary,
};
