"use strict";

const classService = require("./class.service");
const { success, created, paginated } = require("../../shared/response");

class ClassController {
  async getAll(req, res, next) {
    try {
      const { search, status, page, limit } = req.query;
      const result = await classService.getAllClasses({ search, status, page, limit });
      return paginated(
        res,
        {
          data: result.classes,
          total: result.pagination.total,
          page: result.pagination.page,
          pageSize: result.pagination.limit,
          totalPages: result.pagination.totalPages,
        },
        "Classes retrieved successfully"
      );
    } catch (err) {
      next(err);
    }
  }

  async getById(req, res, next) {
    try {
      const { id } = req.params;
      const data = await classService.getClassById(id);
      return success(res, data, "Class details retrieved successfully");
    } catch (err) {
      next(err);
    }
  }

  async create(req, res, next) {
    try {
      const data = await classService.createClass(req.body);
      return created(res, data, "Reusable Class Program created successfully");
    } catch (err) {
      next(err);
    }
  }

  async update(req, res, next) {
    try {
      const { id } = req.params;
      const data = await classService.updateClass(id, req.body);
      return success(res, data, "Class Program updated successfully");
    } catch (err) {
      next(err);
    }
  }

  async remove(req, res, next) {
    try {
      const { id } = req.params;
      await classService.deleteClass(id);
      return success(res, null, "Class Program deleted successfully");
    } catch (err) {
      next(err);
    }
  }

  async getCalendar(req, res, next) {
    try {
      const { date, month, dayOfWeek, batchId } = req.query;
      const data = await classService.getCalendarView({ date, month, dayOfWeek, batchId });
      return success(res, data, "Class calendar schedule retrieved successfully");
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new ClassController();
