"use strict";

const router = require("express").Router();
const ctrl = require("./inquiry.controller");
const { validate } = require("../../middleware/validate.middleware");
const {
  createInquirySchema,
  updateInquirySchema,
  updateStatusSchema,
  recordContactSchema,
} = require("./inquiry.schema");

router.get("/next-id", ctrl.getNextId);
router.get("/", ctrl.getAll);
router.post("/", validate(createInquirySchema), ctrl.create);

router.get("/:id", ctrl.getById);
router.put("/:id", validate(updateInquirySchema), ctrl.update);
router.post("/:id/contact", validate(recordContactSchema), ctrl.recordContact);
router.patch("/:id/status", validate(updateStatusSchema), ctrl.updateStatus);
router.patch("/:id/archive", ctrl.archive);
router.patch("/:id/soft-delete", ctrl.softDelete);
router.patch("/:id/restore", ctrl.restore);
router.delete("/:id", ctrl.remove);

module.exports = router;
