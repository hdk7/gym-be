"use strict";

const router = require("express").Router();
const ctrl = require("./trainer.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
  createTrainerSchema,
  updateTrainerSchema,
  syncBatchesSchema,
} = require("./trainer.schema");

// ── Collection routes ────────────────────────────────────────────────────────
router.get("/", ctrl.getAll);
router.post("/", validate(createTrainerSchema), ctrl.create);

// ── Document routes ──────────────────────────────────────────────────────────
router.get("/:id", ctrl.getById);
router.get("/:id/month-tracking", ctrl.getMonthTracking);
router.put("/:id", validate(updateTrainerSchema), ctrl.update);
router.patch("/:id", validate(updateTrainerSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

// ── Action routes (PATCH) ────────────────────────────────────────────────────
router.patch("/:id/soft-delete", ctrl.softDelete);
router.patch("/:id/restore", ctrl.restore);
router.patch("/:id/toggle-status", ctrl.toggleStatus);
router.patch("/:id/sync-batches", validate(syncBatchesSchema), ctrl.syncBatches);

module.exports = router;

