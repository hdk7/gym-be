"use strict";

const { ApiError } = require("../shared/apiError");
const { NODE_ENV } = require("../config/env");

/**
 * Global error handling middleware.
 *
 * Must be registered LAST in app.js (after all routes and the 404 handler)
 * with the 4-argument signature: (err, req, res, next).
 *
 * Handles:
 *   1. Custom ApiError subclasses (BadRequestError, NotFoundError, etc.)
 *   2. Mongoose duplicate key errors (code 11000)
 *   3. Mongoose CastError (invalid ObjectId / type cast failure)
 *   4. Mongoose ValidationError (schema-level constraint violations)
 *   5. JWT errors (forwarded from auth.middleware.js)
 *   6. Multer file upload errors
 *   7. Unknown / programming errors (non-operational)
 *
 * All responses use the same JSON envelope:
 *   { success: false, message, errors: [], timestamp }
 *
 * Stack traces are included in development but hidden in production.
 */
// eslint-disable-next-line no-unused-vars
function errorMiddleware(err, req, res, next) {
  // ── 1. Custom ApiError hierarchy (BadRequestError, ValidationError, NotFoundError, etc.) ──
  if (err instanceof ApiError) {
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      errors: err.errors || [],
      timestamp: new Date().toISOString(),
      ...(NODE_ENV !== "production" && { stack: err.stack }),
    });
  }

  // ── 2. Mongoose Duplicate Key (e.g. unique email/mobile) ────────────────────
  if (err.code === 11000) {
    const duplicateField = Object.keys(err.keyValue || {})[0] || "field";
    const duplicateValue = err.keyValue?.[duplicateField] || "";
    return res.status(409).json({
      success: false,
      message: `A record with this ${duplicateField} already exists.`,
      errors: [
        {
          field: duplicateField,
          message: `"${duplicateValue}" is already taken.`,
        },
      ],
      timestamp: new Date().toISOString(),
    });
  }

  // ── 3. Mongoose CastError (bad ID format / wrong field type) ─────────────────
  if (err.name === "CastError") {
    return res.status(400).json({
      success: false,
      message: `Invalid value provided for field: "${err.path}".`,
      errors: [{ field: err.path, message: `"${err.value}" is not a valid value.` }],
      timestamp: new Date().toISOString(),
    });
  }

  // ── 4. Mongoose Schema ValidationError ───────────────────────────────────────
  if (err.name === "ValidationError" && err.errors) {
    const fieldErrors = Object.values(err.errors).map((e) => ({
      field: e.path,
      message: e.message,
    }));
    return res.status(422).json({
      success: false,
      message: "Data validation failed at the database level.",
      errors: fieldErrors,
      timestamp: new Date().toISOString(),
    });
  }

  // ── 4. Multer errors (file upload issues) ────────────────────────────────────
  if (err.name === "MulterError") {
    const messages = {
      LIMIT_FILE_SIZE: "File is too large. Maximum allowed size is 5 MB.",
      LIMIT_FILE_COUNT: "Too many files uploaded at once.",
      LIMIT_UNEXPECTED_FILE: "Unexpected file field in upload request.",
    };
    return res.status(400).json({
      success: false,
      message: messages[err.code] || `File upload error: ${err.message}`,
      errors: [{ field: err.field || "file", message: err.message }],
      timestamp: new Date().toISOString(),
    });
  }


  // ── 6. SyntaxError from JSON body parsing (malformed JSON) ───────────────────
  if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
    return res.status(400).json({
      success: false,
      message: "Invalid JSON in request body.",
      errors: [],
      timestamp: new Date().toISOString(),
    });
  }

  // ── 7. Unknown / Non-operational error (programming bug) ─────────────────────
  // Always log these — they should never happen in a healthy system
  console.error(
    `[Error] ${new Date().toISOString()} — ${req.method} ${req.originalUrl}`
  );
  console.error(err);

  return res.status(500).json({
    success: false,
    message: "An unexpected internal server error occurred.",
    errors: [],
    timestamp: new Date().toISOString(),
    ...(NODE_ENV !== "production" && { stack: err.stack }),
  });
}

module.exports = errorMiddleware;
