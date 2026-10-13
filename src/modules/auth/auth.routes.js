"use strict";

const router = require("express").Router();
const ctrl = require("./auth.controller");
const { validate } = require("../../middleware/validate.middleware");
const { authenticate } = require("../../middleware/auth.middleware");
const { loginSchema, registerSchema, changePasswordSchema } = require("./auth.schema");

// ─── Public routes ─────────────────────────────────────────────────────────
// POST /api/v1/auth/register  — create a new admin account (restrict in prod)
router.post("/register", validate(registerSchema), ctrl.register);

// POST /api/v1/auth/login  — { email, password } → { token, user }
router.post("/login", validate(loginSchema), ctrl.login);

// POST /api/v1/auth/logout  — client-side token removal; server confirms
router.post("/logout", ctrl.logout);

// POST /api/v1/auth/refresh  — { token } → { token, user }
router.post("/refresh", ctrl.refresh);

// ─── Protected routes (require valid JWT) ─────────────────────────────────
// GET  /api/v1/auth/me  — returns the current user profile
router.get("/me", authenticate, ctrl.getMe);

// PATCH /api/v1/auth/change-password
router.patch(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  ctrl.changePassword
);

module.exports = router;
