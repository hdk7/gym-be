"use strict";

const yup = require("yup");
const { CLASS_STATUS } = require("../../shared/constants");

/**
 * Strict 3-field Create Class validation schema.
 * Replaces legacy Program schemas and permits ONLY:
 * 1. name (Class Program Name)
 * 2. beginnerWorkouts (Beginner Workouts)
 * 3. intermediateWorkouts (Intermediate Workouts)
 */
const createClassSchema = yup
  .object({
    name: yup
      .string()
      .trim()
      .required("Class Program Name is required")
      .min(2, "Class Program Name must be at least 2 characters")
      .max(100, "Class Program Name cannot exceed 100 characters"),
    beginnerWorkouts: yup
      .string()
      .trim()
      .default("Not specified"),
    intermediateWorkouts: yup
      .string()
      .trim()
      .default("Not specified"),
    workouts: yup
      .array()
      .of(
        yup.object({
          id: yup.string().nullable(),
          subject: yup.string().trim().default(""),
          message: yup.string().trim().default(""),
        })
      )
      .nullable()
      .default([]),
  })
  .noUnknown("Only Class Program Name, Beginner Workouts, Intermediate Workouts, and Workouts are allowed.");

const updateClassSchema = yup
  .object({
    name: yup
      .string()
      .trim()
      .min(2, "Class Program Name must be at least 2 characters")
      .max(100, "Class Program Name cannot exceed 100 characters"),
    beginnerWorkouts: yup
      .string()
      .trim(),
    intermediateWorkouts: yup
      .string()
      .trim(),
    workouts: yup
      .array()
      .of(
        yup.object({
          id: yup.string().nullable(),
          subject: yup.string().trim().default(""),
          message: yup.string().trim().default(""),
        })
      )
      .nullable(),
    status: yup
      .string()
      .oneOf(Object.values(CLASS_STATUS), "Invalid status"),
  })
  .noUnknown("Unknown fields are not allowed in class updates.");

module.exports = {
  createClassSchema,
  updateClassSchema,
};
