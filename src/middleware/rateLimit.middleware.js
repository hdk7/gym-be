"use strict";

const rateLimit = require("express-rate-limit");
const { RATE_LIMIT_WINDOW_MS, RATE_LIMIT_MAX, IS_TEST } = require("../config/env");

/**
 * Global rate limiter — applied to all API routes in app.js.
 *
 * Default config (from .env):
 *   RATE_LIMIT_WINDOW_MS = 900000  (15 minutes)
 *   RATE_LIMIT_MAX       = 200     (200 requests per window per IP)
 *
 * The limiter sends standardized JSON matching the rest of the API
 * so the frontend can handle it uniformly.
 */
const rateLimitMiddleware = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: RATE_LIMIT_MAX,
  standardHeaders: true,   // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false,     // Disable the `X-RateLimit-*` headers
  message: {
    success: false,
    message: "Too many requests from this IP. Please try again later.",
    errors: [],
    timestamp: new Date().toISOString(),
  },
  // Skip during tests and skip health check endpoint from rate limiting
  skip: (req) => IS_TEST || process.env.NODE_ENV === "development" || req.path === "/api/health",
});

module.exports = rateLimitMiddleware;
