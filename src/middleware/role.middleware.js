"use strict";

const { ForbiddenError, UnauthorizedError } = require("../shared/apiError");

/**
 * Role-based access control (RBAC) middleware factory.
 *
 * Must be used AFTER authenticate() — it assumes req.user is already set.
 *
 * Usage:
 *   const { authenticate } = require("../middleware/auth.middleware");
 *   const { requireRole }  = require("../middleware/role.middleware");
 *
 *   // Require admin role
 *   router.delete("/:id", authenticate, requireRole("admin"), ctrl.permanentDelete);
 *
 *   // Allow either admin OR staff
 *   router.post("/", authenticate, requireRole("admin", "staff"), ctrl.create);
 *
 * Defined roles (from constants.js USER_ROLES):
 *   "admin" — Full access: create, read, update, delete, manage users
 *   "staff" — Limited: read, create, update; no permanent delete or user management
 *
 * @param {...string} roles - One or more allowed role strings
 * @returns {import('express').RequestHandler}
 */
function requireRole(...roles) {
  return (req, res, next) => {
    // Ensure authenticate() ran first
    if (!req.user) {
      return next(
        new UnauthorizedError("Authentication required before checking role.")
      );
    }

    const userRole = req.user.role;

    if (!roles.includes(userRole)) {
      return next(
        new ForbiddenError(
          `Access denied. This action requires role: [${roles.join(", ")}]. Your role: ${userRole}.`
        )
      );
    }

    next();
  };
}

/**
 * Shorthand guard for admin-only routes.
 */
const requireAdmin = requireRole("admin");

/**
 * Shorthand guard for admin or staff routes.
 */
const requireStaff = requireRole("admin", "staff");

module.exports = { requireRole, requireAdmin, requireStaff };
