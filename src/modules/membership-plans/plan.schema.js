"use strict";

const yup = require("yup");
const { PLAN_STATUS } = require("../../shared/constants");

const createPlanSchema = yup.object().shape({
  id: yup.string().trim().nullable(),
  name: yup.string().trim().required("Plan name is required.").min(2),
  durationMonths: yup.number().required("Duration is required.").min(1),
  price: yup.number().required("Price is required.").min(0),
  period: yup.string().trim().nullable(),
  description: yup.string().trim().nullable(),
  badge: yup.string().trim().nullable(),
  popular: yup.boolean().nullable(),
  status: yup.string().oneOf(Object.values(PLAN_STATUS)).nullable(),
  features: yup.array().of(yup.string()).nullable(),
});

const updatePlanSchema = yup.object().shape({
  name: yup.string().trim().min(2).nullable(),
  durationMonths: yup.number().min(1).nullable(),
  price: yup.number().min(0).nullable(),
  period: yup.string().trim().nullable(),
  description: yup.string().trim().nullable(),
  badge: yup.string().trim().nullable(),
  popular: yup.boolean().nullable(),
  status: yup.string().oneOf(Object.values(PLAN_STATUS)).nullable(),
  features: yup.array().of(yup.string()).nullable(),
});

module.exports = { createPlanSchema, updatePlanSchema };
