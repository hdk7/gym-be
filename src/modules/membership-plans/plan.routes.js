"use strict";

const router = require("express").Router();
const ctrl = require("./plan.controller");
const { validate } = require("../../middleware/validate.middleware");
const { createPlanSchema, updatePlanSchema } = require("./plan.schema");

router.get("/", ctrl.getAll);
router.post("/", validate(createPlanSchema), ctrl.create);

router.get("/:id", ctrl.getById);
router.put("/:id", validate(updatePlanSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

router.patch("/:id/soft-delete", ctrl.softDelete);
router.patch("/:id/restore", ctrl.restore);
router.patch("/:id/toggle-status", ctrl.toggleStatus);

module.exports = router;
