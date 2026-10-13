"use strict";

const router = require("express").Router();
const ctrl = require("./schedule.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
  createScheduleSchema,
  updateScheduleSchema,
  assignBatchesSchema,
  createItemSchema,
  updateItemSchema,
} = require("./schedule.schema");

// ─── Master Schedules ──────────────────────────────────────────────────────────
router.get("/", ctrl.getAll);
router.post("/", validate(createScheduleSchema), ctrl.create);

// ─── Direct Curriculum Items Routes (Must be before /:id) ────────────────────
router.put("/items/:itemId", validate(updateItemSchema), ctrl.updateItemDirect);
router.delete("/items/:itemId", ctrl.deleteItemDirect);

router.get("/:id", ctrl.getById);
router.put("/:id", validate(updateScheduleSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

router.patch("/:id/toggle-status", ctrl.toggleStatus);
router.patch("/:id/assign-batches", validate(assignBatchesSchema), ctrl.assignBatches);
router.post("/:id/duplicate", ctrl.duplicate);
router.get("/:id/tracking", ctrl.getTracking);

// ─── Curriculum Items (Sub-resource) ───────────────────────────────────────────
router.get("/:id/items", ctrl.getItems);
router.post("/:id/items", validate(createItemSchema), ctrl.addItem);
router.put("/:id/items/:itemId", validate(updateItemSchema), ctrl.updateItem);
router.delete("/:id/items/:itemId", ctrl.deleteItem);

module.exports = router;
