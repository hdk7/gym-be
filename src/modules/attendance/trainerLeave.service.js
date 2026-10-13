"use strict";

const TrainerLeave = require("./trainerLeave.model");
const TrainerLog = require("./trainerLog.model");
const Trainer = require("../trainers/trainer.model");
const Batch = require("../batches/batch.model");
const trainerLeavePolicyService = require("./trainerLeavePolicy.service");
const { generateTrainerLeaveId, generateTrainerLogId } = require("../../shared/idGenerator");
const { TRAINER_LEAVE_STATUS, TRAINER_LOG_STATUS } = require("../../shared/constants");
const { BadRequestError, NotFoundError } = require("../../shared/apiError");

class TrainerLeaveService {
  /**
   * 1. Submit / create a new trainer leave request with policy validation.
   */
  async createLeaveRequest(data, user) {
    if (!data.trainerId) {
      throw new BadRequestError("Trainer ID is required.");
    }
    if (!data.leaveStartDate || !data.leaveEndDate) {
      throw new BadRequestError("Both leave start date and end date are required.");
    }
    if (data.leaveEndDate < data.leaveStartDate) {
      throw new BadRequestError("Leave end date cannot be earlier than start date.");
    }

    // 1. Resolve trainer name
    let trainerName = data.trainerName || "";
    if (!trainerName) {
      const trainer = await Trainer.findOne({ id: data.trainerId }).lean();
      if (trainer) {
        trainerName = `${trainer.firstName || ""} ${trainer.lastName || ""}`.trim() || trainer.name || data.trainerId;
      } else {
        trainerName = data.trainerId;
      }
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    const submittedOn = data.submittedOn || todayStr;

    // 2. Check for overlapping pending or approved leave requests for the same trainer
    const overlap = await TrainerLeave.findOne({
      trainerId: data.trainerId,
      status: { $in: [TRAINER_LEAVE_STATUS.PENDING, TRAINER_LEAVE_STATUS.APPROVED] },
      leaveStartDate: { $lte: data.leaveEndDate },
      leaveEndDate: { $gte: data.leaveStartDate },
    }).lean();

    if (overlap) {
      throw new BadRequestError(
        `Trainer already has an existing ${overlap.status} leave (${overlap.id}) from ${overlap.leaveStartDate} to ${overlap.leaveEndDate}.`
      );
    }

    // 3. Validate against active Trainer Leave Policy
    const policyResult = await trainerLeavePolicyService.validateLeaveNotice(
      data.leaveStartDate,
      data.leaveEndDate,
      submittedOn
    );

    const allowOverride = Boolean(data.allowPolicyOverride);

    if (!policyResult.isValid && !allowOverride) {
      throw new BadRequestError(policyResult.message);
    }

    // 4. Resolve affected batches
    const batches = await Batch.find({ trainerIds: data.trainerId, status: "Active" }).lean();
    const affectedBatchIds = batches.map((b) => b.id);

    // 5. Create leave request
    const leaveId = generateTrainerLeaveId();
    const newLeave = await TrainerLeave.create({
      id: leaveId,
      trainerId: data.trainerId,
      trainerName,
      leaveStartDate: data.leaveStartDate,
      leaveEndDate: data.leaveEndDate,
      totalDays: policyResult.totalDays,
      submittedOn,
      actualNoticeDays: policyResult.actualNoticeDays,
      requiredNoticeDays: policyResult.requiredNoticeDays,
      tierLabel: policyResult.tier?.label || "",
      isNoticeCompliant: policyResult.isValid,
      allowPolicyOverride: allowOverride,
      overrideReason: allowOverride ? data.overrideReason || "Admin authorized notice override" : "",
      reason: data.reason ? String(data.reason).trim() : "",
      status: TRAINER_LEAVE_STATUS.PENDING,
      reviewedBy: null,
      reviewNote: "",
      reviewedAt: null,
      affectedBatchIds,
    });

    return newLeave.toObject ? newLeave.toObject() : newLeave;
  }

  /**
   * 2. Query leave requests with filters (trainerId, status, month, search).
   */
  async getLeaveRequests(query = {}) {
    const filter = {};

    if (query.trainerId && query.trainerId !== "all") {
      filter.trainerId = query.trainerId;
    }

    if (query.status && query.status !== "all" && query.status !== "ALL") {
      if (query.status.includes(",")) {
        filter.status = { $in: query.status.split(",").map((s) => s.trim().toUpperCase()) };
      } else {
        filter.status = query.status.toUpperCase();
      }
    }

    if (query.month) {
      // Month format: YYYY-MM
      // Matches leaves that start in this month OR end in this month
      filter.$or = [
        { leaveStartDate: { $regex: `^${query.month}` } },
        { leaveEndDate: { $regex: `^${query.month}` } },
      ];
    }

    if (query.startDate && query.endDate) {
      filter.leaveStartDate = { $lte: query.endDate };
      filter.leaveEndDate = { $gte: query.startDate };
    }

    if (query.search && query.search.trim()) {
      const regex = new RegExp(query.search.trim(), "i");
      const searchConditions = [
        { trainerName: regex },
        { trainerId: regex },
        { reason: regex },
        { id: regex },
      ];
      if (filter.$or) {
        filter.$and = [{ $or: filter.$or }, { $or: searchConditions }];
        delete filter.$or;
      } else {
        filter.$or = searchConditions;
      }
    }

    return TrainerLeave.find(filter).sort({ createdAt: -1 }).lean();
  }

  /**
   * 3. Get single leave request by id.
   */
  async getLeaveRequestById(id) {
    const leave = await TrainerLeave.findOne({ id }).lean();
    if (!leave) {
      throw new NotFoundError(`Trainer leave request "${id}" not found.`);
    }
    return leave;
  }

  /**
   * 4. Update status: APPROVED, REJECTED, or CANCELLED.
   * On APPROVED: automatically seeds TrainerLog entries with status LEAVE for all affected days.
   */
  async updateLeaveStatus(id, { status, reviewNote, reviewedBy }) {
    const leave = await TrainerLeave.findOne({ id });
    if (!leave) {
      throw new NotFoundError(`Trainer leave request "${id}" not found.`);
    }

    const nextStatus = status ? status.toUpperCase() : "";
    const validStatuses = Object.values(TRAINER_LEAVE_STATUS);
    if (!validStatuses.includes(nextStatus)) {
      throw new BadRequestError(`Invalid status "${status}". Allowed values: ${validStatuses.join(", ")}`);
    }

    const previousStatus = leave.status;

    leave.status = nextStatus;
    leave.reviewNote = reviewNote !== undefined ? String(reviewNote).trim() : leave.reviewNote;
    leave.reviewedBy = reviewedBy || "admin";
    leave.reviewedAt = new Date();

    await leave.save();

    // Side effects on status changes:
    // If APPROVED -> generate TrainerLog records for each date in range with status: LEAVE
    if (nextStatus === TRAINER_LEAVE_STATUS.APPROVED) {
      await this._seedLeaveLogsForTrainer(leave);
    } else if (previousStatus === TRAINER_LEAVE_STATUS.APPROVED && nextStatus !== TRAINER_LEAVE_STATUS.APPROVED) {
      // If was previously approved but now REJECTED or CANCELLED, clean up any seeded LEAVE logs
      await this._revertLeaveLogsForTrainer(leave);
    }

    return leave.toObject();
  }

  /**
   * 5. Helper to seed TrainerLog entries for each day of an approved leave.
   */
  async _seedLeaveLogsForTrainer(leave) {
    const dStart = new Date(leave.leaveStartDate + "T00:00:00Z");
    const dEnd = new Date(leave.leaveEndDate + "T00:00:00Z");

    const batches = await Batch.find({ trainerIds: leave.trainerId, status: "Active" }).lean();
    const batchList = batches.length > 0 ? batches : [{ id: "GENERAL", name: "General Duty" }];

    for (let cur = new Date(dStart); cur <= dEnd; cur.setUTCDate(cur.getUTCDate() + 1)) {
      const dateStr = cur.toISOString().slice(0, 10);
      const monthYear = dateStr.slice(0, 7);

      for (const batch of batchList) {
        await TrainerLog.findOneAndUpdate(
          { date: dateStr, trainerId: leave.trainerId, batchId: batch.id },
          {
            $set: {
              date: dateStr,
              monthYear,
              trainerId: leave.trainerId,
              trainerName: leave.trainerName,
              batchId: batch.id,
              status: TRAINER_LOG_STATUS.LEAVE,
              notes: `Approved Leave [${leave.id}]${leave.reason ? `: ${leave.reason}` : ""}`.trim(),
            },
            $setOnInsert: {
              id: generateTrainerLogId(),
            },
          },
          { upsert: true, returnDocument: "after" }
        );
      }
    }
  }

  /**
   * 6. Helper to clean up any seeded TrainerLog entries when leave is cancelled/revoked.
   */
  async _revertLeaveLogsForTrainer(leave) {
    await TrainerLog.deleteMany({
      trainerId: leave.trainerId,
      status: TRAINER_LOG_STATUS.LEAVE,
      notes: { $regex: leave.id },
    });
  }

  /**
   * 7. Cancel leave request.
   */
  async cancelLeaveRequest(id, user) {
    return this.updateLeaveStatus(id, {
      status: TRAINER_LEAVE_STATUS.CANCELLED,
      reviewNote: "Cancelled by applicant / admin.",
      reviewedBy: user?.name || user?.username || "admin",
    });
  }

  /**
   * 8. Aggregate monthly leave summary per trainer with paid/unpaid balance and deductions.
   */
  async getMonthlyLeaveSummary(query) {
    const month = query?.month || new Date().toISOString().slice(0, 7); // YYYY-MM

    // Fetch active policy to get allowance and deduction rate
    const policy = await trainerLeavePolicyService.getPolicy();
    const monthlyAllowance = typeof policy?.monthlyPaidLeaveAllowance === "number" ? policy.monthlyPaidLeaveAllowance : 2;
    const deductionPerDay = typeof policy?.unpaidDeductionPerDay === "number" ? policy.unpaidDeductionPerDay : 1000;

    // Fetch leaves that overlap with this month
    const leaves = await TrainerLeave.find({
      $or: [
        { leaveStartDate: { $regex: `^${month}` } },
        { leaveEndDate: { $regex: `^${month}` } },
      ],
    }).lean();

    // Group leaves by trainerId
    const summaryMap = {};
    for (const l of leaves) {
      if (!summaryMap[l.trainerId]) {
        summaryMap[l.trainerId] = {
          trainerId: l.trainerId,
          trainerName: l.trainerName,
          approvedDays: 0,
          pendingDays: 0,
          rejectedDays: 0,
          leaves: [],
        };
      }
      summaryMap[l.trainerId].leaves.push(l);

      // Calculate days falling inside this month
      const [year, m] = month.split("-").map(Number);
      const lastDayOfMonth = new Date(Date.UTC(year, m, 0)).toISOString().slice(0, 10);
      const firstDayOfMonth = `${month}-01`;

      const effectiveStart = l.leaveStartDate < firstDayOfMonth ? firstDayOfMonth : l.leaveStartDate;
      const effectiveEnd = l.leaveEndDate > lastDayOfMonth ? lastDayOfMonth : l.leaveEndDate;

      let daysInMonth = 0;
      if (effectiveStart <= effectiveEnd) {
        const d1 = new Date(effectiveStart + "T00:00:00Z");
        const d2 = new Date(effectiveEnd + "T00:00:00Z");
        daysInMonth = Math.max(1, Math.round((d2 - d1) / (1000 * 60 * 60 * 24)) + 1);
      }

      if (l.status === TRAINER_LEAVE_STATUS.APPROVED) {
        summaryMap[l.trainerId].approvedDays += daysInMonth;
      } else if (l.status === TRAINER_LEAVE_STATUS.PENDING) {
        summaryMap[l.trainerId].pendingDays += daysInMonth;
      } else if (l.status === TRAINER_LEAVE_STATUS.REJECTED) {
        summaryMap[l.trainerId].rejectedDays += daysInMonth;
      }
    }

    // Also get all trainers to provide a comprehensive list
    const allTrainers = await Trainer.find().lean();
    const trainersSummary = allTrainers.map((t) => {
      const summary = summaryMap[t.id] || {
        trainerId: t.id,
        trainerName: `${t.firstName || ""} ${t.lastName || ""}`.trim() || t.name || t.id,
        approvedDays: 0,
        pendingDays: 0,
        rejectedDays: 0,
        leaves: [],
      };

      const approvedDays = summary.approvedDays;
      const paidDays = Math.min(approvedDays, monthlyAllowance);
      const unpaidDays = Math.max(0, approvedDays - monthlyAllowance);
      const totalDeduction = unpaidDays * deductionPerDay;
      const remainingBalance = Math.max(0, monthlyAllowance - approvedDays);

      return {
        ...summary,
        monthlyAllowance,
        paidDays,
        unpaidDays,
        remainingBalance,
        deductionPerDay,
        totalDeduction,
      };
    });

    return {
      month,
      monthlyAllowance,
      deductionPerDay,
      trainersSummary,
      totalApprovedLeaveDays: trainersSummary.reduce((acc, r) => acc + r.approvedDays, 0),
      totalUnpaidLeaveDays: trainersSummary.reduce((acc, r) => acc + r.unpaidDays, 0),
      totalLeaveDeductions: trainersSummary.reduce((acc, r) => acc + r.totalDeduction, 0),
    };
  }
}

module.exports = new TrainerLeaveService();
