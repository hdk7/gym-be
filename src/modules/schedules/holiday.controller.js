"use strict";

const scheduleService = require("./schedule.service");
const { success, created } = require("../../shared/response");

async function getAll(req, res, next) {
  try {
    const { search } = req.query;
    const holidays = await scheduleService.getAllHolidays({ search });
    return success(res, holidays, "Holidays retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const holiday = await scheduleService.getHolidayById(req.params.id);
    return success(res, holiday, "Holiday retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const holiday = await scheduleService.createHoliday(req.body);
    return created(res, holiday, "Holiday created successfully.");
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const holiday = await scheduleService.updateHoliday(req.params.id, req.body);
    return success(res, holiday, "Holiday updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await scheduleService.deleteHoliday(req.params.id);
    return success(res, result, "Holiday deleted successfully.");
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
};
