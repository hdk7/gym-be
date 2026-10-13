"use strict";

const memberService = require("./member.service");
const { success, created, paginated } = require("../../shared/response");
const { parsePaginationParams, buildPaginationResult } = require("../../shared/pagination");

async function getAll(req, res, next) {
  try {
    const { page, pageSize, skip } = parsePaginationParams(req.query);
    const { status, includeDeleted, search } = req.query;

    const { data, total } = await memberService.getAll({
      page,
      pageSize,
      skip,
      status,
      includeDeleted: includeDeleted === "true" || includeDeleted === true,
      search: search?.trim() || "",
    });

    return paginated(
      res,
      {
        data,
        ...buildPaginationResult(total, page, pageSize),
      },
      "Members retrieved successfully."
    );
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const member = await memberService.getById(req.params.id);
    return success(res, member, "Member retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const member = await memberService.create(req.body);
    return created(res, member, "Member registered successfully.");
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const member = await memberService.update(req.params.id, req.body);
    return success(res, member, "Member updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function softDelete(req, res, next) {
  try {
    const member = await memberService.softDelete(req.params.id);
    return success(res, member, "Member archived successfully.");
  } catch (err) {
    next(err);
  }
}

async function restore(req, res, next) {
  try {
    const member = await memberService.restore(req.params.id);
    return success(res, member, "Member restored successfully.");
  } catch (err) {
    next(err);
  }
}

async function permanentDelete(req, res, next) {
  try {
    const result = await memberService.permanentDelete(req.params.id);
    return success(res, result, "Member permanently deleted.");
  } catch (err) {
    next(err);
  }
}

async function toggleStatus(req, res, next) {
  try {
    const member = await memberService.toggleStatus(req.params.id);
    return success(res, member, `Member status changed to ${member.status}.`);
  } catch (err) {
    next(err);
  }
}

async function convertLead(req, res, next) {
  try {
    const member = await memberService.convertLead(req.params.id, req.body);
    return success(res, member, "Lead converted to Active member successfully.");
  } catch (err) {
    next(err);
  }
}

async function getMonthTracking(req, res, next) {
  try {
    const { month } = req.query;
    const tracking = await memberService.getMemberMonthTracking(req.params.id, month);
    return success(res, tracking, "Member month tracking retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function recordContact(req, res, next) {
  try {
    const member = await memberService.recordContact(req.params.id, req.body);
    return success(res, member, "Contact details recorded successfully.");
  } catch (err) {
    next(err);
  }
}

async function archiveInquiry(req, res, next) {
  try {
    const member = await memberService.archiveInquiry(req.params.id, req.body?.reason);
    return success(res, member, "Inquiry moved to archived.");
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
  permanentDelete,
  toggleStatus,
  convertLead,
  recordContact,
  archiveInquiry,
  getMonthTracking,
};

