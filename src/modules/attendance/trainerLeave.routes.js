"use strict";

const router = require("express").Router();
const ctrl = require("./trainerLeave.controller");

// ─── Trainer Leave Requests Endpoints ─────────────────────────────────────────
router.post("/", ctrl.createLeaveRequest);
router.get("/", ctrl.getLeaveRequests);
router.get("/monthly-summary", ctrl.getMonthlyLeaveSummary);
router.get("/:id", ctrl.getLeaveRequestById);
router.patch("/:id/status", ctrl.updateLeaveStatus);
router.delete("/:id", ctrl.cancelLeaveRequest);
router.post("/:id/cancel", ctrl.cancelLeaveRequest);

module.exports = router;
