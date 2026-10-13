"use strict";

const { NotFoundError } = require("../shared/apiError");

/**
 * 404 Not Found middleware.
 *
 * Registered in app.js AFTER all valid routes but BEFORE the global error
 * handler. Any request that doesn't match a defined route falls through here
 * and receives a standardized 404 JSON response.
 *
 * The error is passed to the global error handler (error.middleware.js)
 * via next() so the response envelope stays consistent.
 */
module.exports = (req, res, next) => {
  next(
    new NotFoundError(
      `Route not found: ${req.method} ${req.originalUrl}`
    )
  );
};
