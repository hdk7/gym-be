"use strict";

/**
 * Standardized API response builder.
 *
 * Every endpoint should use one of these helpers instead of calling
 * res.json() / res.status() directly. This ensures a consistent envelope
 * shape across the entire API:
 *
 * Success:
 *   { success: true, message, data, timestamp }
 *
 * Paginated:
 *   { success: true, message, data, pagination: { total, page, pageSize, totalPages }, timestamp }
 *
 * Error (used by error.middleware.js):
 *   { success: false, message, errors, timestamp }
 */

/**
 * Generic success response.
 * @param {import('express').Response} res
 * @param {*}      data        - Payload to send (object, array, or null)
 * @param {string} message     - Human-readable success message
 * @param {number} statusCode  - HTTP status code (default 200)
 */
function success(res, data = null, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
    timestamp: new Date().toISOString(),
  });
}

/**
 * 201 Created response (used for POST operations that create new resources).
 * @param {import('express').Response} res
 * @param {*}      data     - The newly created resource
 * @param {string} message  - Human-readable message
 */
function created(res, data = null, message = "Created successfully.") {
  return success(res, data, message, 201);
}

/**
 * Paginated list response.
 * @param {import('express').Response} res
 * @param {{ data: Array, total: number, page: number, pageSize: number, totalPages: number }} payload
 * @param {string} message
 */
function paginated(res, { data, total, page, pageSize, totalPages }, message = "Success") {
  return res.status(200).json({
    success: true,
    message,
    data,
    pagination: {
      total,
      page,
      pageSize,
      totalPages,
    },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Generic error response — primarily used by error.middleware.js.
 * Controllers should throw ApiError subclasses instead of calling this directly.
 * @param {import('express').Response} res
 * @param {string} message    - Summary error message
 * @param {number} statusCode - HTTP status code (default 500)
 * @param {Array}  errors     - Optional array of field-level errors
 */
function error(res, message = "An error occurred.", statusCode = 500, errors = []) {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
    timestamp: new Date().toISOString(),
  });
}

module.exports = { success, created, paginated, error };
