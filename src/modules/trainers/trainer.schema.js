"use strict";

const yup = require("yup");
const { TRAINER_STATUS, GENDER } = require("../../shared/constants");

const EMAIL_PATTERN = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;

const createTrainerSchema = yup.object().shape({
  id: yup.string().trim().nullable(),
  name: yup
    .string()
    .trim()
    .required("Trainer name is required.")
    .min(2, "Name must be at least 2 characters."),
  gender: yup.string().trim().oneOf(GENDER).default("Male"),
  experience: yup.string().trim().required("Experience is required (e.g. '5 Years')."),
  phone: yup
    .string()
    .trim()
    .required("Phone number is required.")
    .test("valid-phone", "Please enter a valid phone number (at least 10 digits).", (v) => {
      if (!v) return false;
      return v.replace(/\D/g, "").length >= 10;
    }),
  email: yup
    .string()
    .trim()
    .lowercase()
    .required("Email is required.")
    .matches(EMAIL_PATTERN, "Please enter a valid email address."),
  specialization: yup.string().trim().nullable().default("Faculty Coach"),
  shift: yup.string().trim().nullable().default("Morning (06:00 - 14:00)"),
  status: yup.string().oneOf(Object.values(TRAINER_STATUS)).default(TRAINER_STATUS.ACTIVE),
  bio: yup
    .string()
    .trim()
    .required("Bio is required.")
    .min(10, "Bio must be at least 10 characters."),
  quote: yup.string().trim().nullable().default(""),
  photo: yup.string().trim().nullable(),
  certifications: yup.mixed().nullable(),
  programs: yup.mixed().nullable(),
  stats: yup.mixed().nullable(),
  batchIds: yup.array().of(yup.string()).nullable().default([]),
});

const updateTrainerSchema = yup.object().shape({
  name: yup.string().trim().min(2).nullable(),
  gender: yup.string().trim().oneOf([...GENDER, null, ""]).nullable(),
  experience: yup.string().trim().nullable(),
  phone: yup
    .string()
    .trim()
    .nullable()
    .test("valid-phone", "Please enter a valid phone number (at least 10 digits).", (v) => {
      if (!v) return true;
      return v.replace(/\D/g, "").length >= 10;
    }),
  email: yup.string().trim().lowercase().matches(EMAIL_PATTERN).nullable(),
  specialization: yup.string().trim().nullable(),
  shift: yup.string().trim().nullable(),
  status: yup.string().oneOf(Object.values(TRAINER_STATUS)).nullable(),
  bio: yup.string().trim().min(10).nullable(),
  quote: yup.string().trim().nullable(),
  photo: yup.string().trim().nullable(),
  certifications: yup.mixed().nullable(),
  programs: yup.mixed().nullable(),
  stats: yup.mixed().nullable(),
  batchIds: yup.array().of(yup.string()).nullable(),
});

const syncBatchesSchema = yup.object().shape({
  batchIds: yup.array().of(yup.string()).required("batchIds array is required."),
});

module.exports = {
  createTrainerSchema,
  updateTrainerSchema,
  syncBatchesSchema,
};
