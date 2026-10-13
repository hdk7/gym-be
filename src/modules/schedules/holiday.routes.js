"use strict";

const router = require("express").Router();
const ctrl = require("./holiday.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
  createHolidaySchema,
  updateHolidaySchema,
} = require("./schedule.schema");

router.get("/", ctrl.getAll);
router.post("/", validate(createHolidaySchema), ctrl.create);
router.get("/:id", ctrl.getById);
router.put("/:id", validate(updateHolidaySchema), ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
