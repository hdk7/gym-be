"use strict";

const jwt = require("jsonwebtoken");
const { JWT_SECRET } = require("../config/env");
const { UnauthorizedError } = require("../shared/apiError");

/**
 * authenticate — Protects routes that require a valid JWT.
 *
 * Expects the token in the Authorization header:
 *   Authorization: Bearer <token>
 *
 * On success: attaches the decoded payload to req.user and calls next().
 * On failure: passes a 401 UnauthorizedError to the global error handler.
 *
 * Decoded payload shape (set by auth.service.js at login):
 *   { id, email, role, iat, exp }
 */
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return next(
      new UnauthorizedError(
        "Authentication required. Please provide a valid Bearer token."
      )
    );
  }

  const token = authHeader.split(" ")[1];

  if (!token || token.trim() === "") {
    return next(new UnauthorizedError("Authentication token is missing."));
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET);
    req.user = payload; // { id, email, role, iat, exp }
    next();
  } catch (err) {
    if (err.name === "TokenExpiredError") {
      return next(new UnauthorizedError("Your session has expired. Please log in again."));
    }
    if (err.name === "JsonWebTokenError") {
      return next(new UnauthorizedError("Invalid authentication token."));
    }
    return next(new UnauthorizedError("Authentication failed."));
  }
}

/**
 * optionalAuth — Attaches user to req if a valid token is present,
 * but does NOT block requests without a token.
 *
 * Useful for routes that behave differently for authenticated vs
 * anonymous users (e.g. public member registration page).
 */
function optionalAuth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split(" ")[1];
    try {
      req.user = jwt.verify(token, JWT_SECRET);
    } catch {
      // Silently ignore invalid/expired tokens in optional mode
      req.user = null;
    }
  } else {
    req.user = null;
  }

  next();
}

module.exports = { authenticate, optionalAuth };
