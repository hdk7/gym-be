"use strict";

const yup = require("yup");

/**
 * Yup schema for POST /api/v1/auth/login
 */
const loginSchema = yup.object().shape({
  email: yup
    .string()
    .trim()
    .lowercase()
    .required("Email is required.")
    .email("Please enter a valid email address."),
  password: yup
    .string()
    .required("Password is required.")
    .min(6, "Password must be at least 6 characters."),
});

/**
 * Yup schema for POST /api/v1/auth/register  (dev / admin-only)
 */
const registerSchema = yup.object().shape({
  name: yup
    .string()
    .trim()
    .required("Name is required.")
    .min(2, "Name must be at least 2 characters."),
  email: yup
    .string()
    .trim()
    .lowercase()
    .required("Email is required.")
    .email("Please enter a valid email address."),
  password: yup
    .string()
    .required("Password is required.")
    .min(8, "Password must be at least 8 characters."),
  role: yup.string().oneOf(["admin", "staff"]).default("admin"),
});

/**
 * Yup schema for POST /api/v1/auth/change-password
 */
const changePasswordSchema = yup.object().shape({
  currentPassword: yup.string().required("Current password is required."),
  newPassword: yup
    .string()
    .required("New password is required.")
    .min(8, "Password must be at least 8 characters."),
});

module.exports = { loginSchema, registerSchema, changePasswordSchema };
