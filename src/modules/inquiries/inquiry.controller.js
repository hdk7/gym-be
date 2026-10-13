"use strict";

const inquiryService = require("./inquiry.service");
const { success, created } = require("../../shared/response");

async function getNextId(req, res, next) {
  try {
    const nextId = await inquiryService.getNextId();
    return success(res, { nextId }, "Next inquiry ID generated successfully.");
  } catch (err) {
    next(err);
  }
}

async function getAll(req, res, next) {
  try {
    const { status, search, includeDeleted } = req.query;
    const inquiries = await inquiryService.getAll({
      status,
      search,
      includeDeleted: includeDeleted === "true",
    });
    return success(res, inquiries, "Inquiries retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const inquiry = await inquiryService.getById(req.params.id);
    return success(res, inquiry, "Inquiry retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const inquiry = await inquiryService.create(req.body);
    return created(res, inquiry, "Inquiry logged successfully.");
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const inquiry = await inquiryService.update(req.params.id, req.body);
    return success(res, inquiry, "Inquiry updated successfully.");
  } catch (err) {
    next(err);
  }
}

async function recordContact(req, res, next) {
  try {
    const inquiry = await inquiryService.recordContact(req.params.id, req.body);
    return success(res, inquiry, "Lead contacted successfully. Status updated to Contacted.");
  } catch (err) {
    next(err);
  }
}

async function updateStatus(req, res, next) {
  try {
    const inquiry = await inquiryService.updateStatus(req.params.id, req.body.status, {
      notes: req.body.notes,
      convertedMemberId: req.body.convertedMemberId,
    });
    return success(res, inquiry, `Inquiry status changed to ${inquiry.status}.`);
  } catch (err) {
    next(err);
  }
}

async function archive(req, res, next) {
  try {
    const inquiry = await inquiryService.archive(req.params.id, req.body?.reason);
    return success(res, inquiry, "Inquiry moved to Archived.");
  } catch (err) {
    next(err);
  }
}

async function softDelete(req, res, next) {
  try {
    const inquiry = await inquiryService.softDelete(req.params.id);
    return success(res, inquiry, "Inquiry archived successfully.");
  } catch (err) {
    next(err);
  }
}

async function restore(req, res, next) {
  try {
    const inquiry = await inquiryService.restore(req.params.id);
    return success(res, inquiry, "Inquiry restored successfully.");
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const result = await inquiryService.delete(req.params.id);
    return success(res, result, "Inquiry permanently deleted.");
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getNextId,
  getAll,
  getById,
  create,
  update,
  recordContact,
  updateStatus,
  archive,
  softDelete,
  restore,
  remove,
};
