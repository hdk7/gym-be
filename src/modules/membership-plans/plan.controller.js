"use strict";

const planService = require("./plan.service");
const { success, created } = require("../../shared/response");

async function getAll(req, res, next) {
  try {
    const { includeDeleted, status } = req.query;
    const plans = await planService.getAll({
      includeDeleted: includeDeleted === "true",
      status,
    });
    return success(res, plans, "Membership plans retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const plan = await planService.getById(req.params.id);
    return success(res, plan, "Membership plan retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const plan = await planService.create(req.body);
    return created(res, plan, "Membership plan created successfully.");
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const plan = await planService.update(req.params.id, req.body);
    return success(res, plan, "Membership plan updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function softDelete(req, res, next) {
  try {
    const plan = await planService.softDelete(req.params.id);
    return success(res, plan, "Membership plan archived successfully.");
  } catch (err) {
    next(err);
  }
}

async function restore(req, res, next) {
  try {
    const plan = await planService.restore(req.params.id);
    return success(res, plan, "Membership plan restored successfully.");
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const plan = await planService.toggleStatus(req.params.id);
    return success(res, plan, `Membership plan status changed to ${plan.status}.`);
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await planService.delete(req.params.id);
    return success(res, result, "Membership plan permanently deleted.");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getAll,
  getById,
  create,
  update,
  softDelete,
  restore,
  toggleStatus,
  remove,
};
