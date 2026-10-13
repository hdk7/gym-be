"use strict";

const router = require("express").Router();
const ctrl = require("./member.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
  createMemberSchema,
  updateMemberSchema,
  convertLeadSchema,
} = require("./member.schema");

// ── Collection routes ────────────────────────────────────────────────────────
router.get("/", ctrl.getAll);
router.post("/", validate(createMemberSchema), ctrl.create);

// ── Document routes ──────────────────────────────────────────────────────────
router.get("/:id", ctrl.getById);
router.get("/:id/month-tracking", ctrl.getMonthTracking);
router.put("/:id", validate(updateMemberSchema), ctrl.update);
router.delete("/:id", ctrl.permanentDelete);

// ── Action routes (PATCH / POST) ─────────────────────────────────────────────
router.patch("/:id/soft-delete", ctrl.softDelete);
router.patch("/:id/restore", ctrl.restore);
router.patch("/:id/toggle-status", ctrl.toggleStatus);
router.patch("/:id/convert", validate(convertLeadSchema), ctrl.convertLead);
router.post("/:id/contact", ctrl.recordContact);
router.patch("/:id/archive", ctrl.archiveInquiry);

module.exports = router;

