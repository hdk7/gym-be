"use strict";

const router = require("express").Router();
const ctrl = require("./class.controller");
const { validate } = require("../../middleware/validate.middleware");
const { createClassSchema, updateClassSchema } = require("./class.schema");

// ─── Literal Routes (Must precede /:id) ───────────────────────────────────────
router.get("/calendar", ctrl.getCalendar);

// ─── Core CRUD Routes ─────────────────────────────────────────────────────────
router.get("/", ctrl.getAll);
router.post("/", validate(createClassSchema), ctrl.create);

router.get("/:id", ctrl.getById);
router.put("/:id", validate(updateClassSchema), ctrl.update);
router.patch("/:id", validate(updateClassSchema), ctrl.update);
router.delete("/:id", ctrl.remove);

module.exports = router;
