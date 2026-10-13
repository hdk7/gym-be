"use strict";

/**
 * Custom error class hierarchy for Strengthway Backend.
 *
 * Usage:
 *   throw new NotFoundError("Member not found.");
 *   throw new ValidationError("Validation failed.", [{ field: "email", message: "..." }]);
 *
 * All ApiError subclasses set `isOperational = true`, which tells the global
 * error handler they are expected/handled errors (not programming bugs).
 */

// ─── Base class ───────────────────────────────────────────────────────────────
class ApiError extends Error {
  /**
   * @param {number}   statusCode   - HTTP status code to send in the response
   * @param {string}   message      - Human-readable error message
   * @param {Array}    errors       - Optional array of field-level error objects
   * @param {boolean}  isOperational - true = expected error; false = programming bug
   */
  constructor(statusCode, message, errors = [], isOperational = true) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.errors = errors;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

// ─── 400 Bad Request ─────────────────────────────────────────────────────────
class BadRequestError extends ApiError {
  constructor(message = "Bad request.", errors = []) {
    super(400, message, errors);
  }
}

// ─── 401 Unauthorized ────────────────────────────────────────────────────────
class UnauthorizedError extends ApiError {
  constructor(message = "Authentication required.") {
    super(401, message);
  }
}

// ─── 403 Forbidden ───────────────────────────────────────────────────────────
class ForbiddenError extends ApiError {
  constructor(message = "Access denied. Insufficient permissions.") {
    super(403, message);
  }
}

// ─── 404 Not Found ───────────────────────────────────────────────────────────
class NotFoundError extends ApiError {
  constructor(message = "The requested resource was not found.") {
    super(404, message);
  }
}

// ─── 409 Conflict ────────────────────────────────────────────────────────────
class ConflictError extends ApiError {
  constructor(message = "A conflict occurred with the current state of the resource.") {
    super(409, message);
  }
}

// ─── 422 Unprocessable Entity (Validation) ───────────────────────────────────
class ValidationError extends ApiError {
  /**
   * @param {string} message  - Summary message
   * @param {Array}  errors   - Array of { field, message } objects
   */
  constructor(message = "Validation failed.", errors = []) {
    super(422, message, errors);
  }
}

// ─── 500 Internal Server Error ───────────────────────────────────────────────
class InternalError extends ApiError {
  constructor(message = "An unexpected internal server error occurred.") {
    // isOperational = false → global handler will log stack trace
    super(500, message, [], false);
  }
}

module.exports = {
  ApiError,
  BadRequestError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  ValidationError,
  InternalError,
};
