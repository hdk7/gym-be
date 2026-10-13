"use strict";

const router = require("express").Router();
const ctrl = require("./session.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
  updateSessionStatusSchema,
  updateSessionSchema,
} = require("./schedule.schema");

router.get("/", ctrl.getAll);
router.get("/:id", ctrl.getById);
router.patch("/:id/status", validate(updateSessionStatusSchema), ctrl.updateStatus);
router.put("/:id", validate(updateSessionSchema), ctrl.update);

module.exports = router;
