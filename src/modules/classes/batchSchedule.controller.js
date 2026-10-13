"use strict";

const batchScheduleService = require("./batchSchedule.service");
const { success, created } = require("../../shared/response");

class BatchScheduleController {
  async assignClasses(req, res, next) {
    try {
      const { id } = req.params; // batchId
      const { classIds, startDate, overrideExisting, coachId, reason } = req.body;
      const performedBy = req.user?.name || req.user?.email || "Admin";

      const result = await batchScheduleService.assignClassesToBatch({
        batchId: id,
        classIds,
        startDate,
        overrideExisting,
        coachId,
        performedBy,
        reason,
      });

      return created(res, result, `Successfully mapped and assigned ${result.assignedCount} classes to batch.`);
    } catch (err) {
      next(err);
    }
  }

  async shuffleClasses(req, res, next) {
    try {
      const { id } = req.params; // batchId
      const { mode, sourceSessionId, targetSessionId, startDate, endDate, reason } = req.body;
      const performedBy = req.user?.name || req.user?.email || "Admin";

      const result = await batchScheduleService.shuffleClasses({
        batchId: id,
        mode,
        sourceSessionId,
        targetSessionId,
        startDate,
        endDate,
        performedBy,
        reason,
      });

      return success(res, result, result.message || "Class schedule updated successfully.");
    } catch (err) {
      next(err);
    }
  }

  async getBatchSchedule(req, res, next) {
    try {
      const { id } = req.params; // batchId
      const { month, status, date, dayOfWeek, page, limit } = req.query;

      const result = await batchScheduleService.getBatchSchedule(id, {
        month,
        status,
        date,
        dayOfWeek,
        page,
        limit,
      });

      return success(
        res,
        {
          batch: result.batch,
          summary: result.summary,
          pagination: result.pagination,
          sessions: result.sessions,
        },
        "Batch schedule retrieved successfully"
      );
    } catch (err) {
      next(err);
    }
  }

  async getScheduleHistory(req, res, next) {
    try {
      const { id } = req.params; // batchId
      const { limit } = req.query;
      const history = await batchScheduleService.getBatchScheduleHistory(id, limit);

      return success(res, history, "Batch schedule history retrieved successfully");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new BatchScheduleController();
