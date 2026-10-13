"use strict";

const express = require("express");
const cors    = require("cors");
const { CLIENT_ORIGIN, NODE_ENV } = require("./config/env");

// ── Middleware imports ─────────────────────────────────────────────────────────
const loggerMiddleware    = require("./middleware/logger.middleware");
const rateLimitMiddleware = require("./middleware/rateLimit.middleware");
const errorMiddleware     = require("./middleware/error.middleware");
const notFoundMiddleware  = require("./middleware/notFound.middleware");

const app = express();

// ── Trust proxy (required behind Render / Vercel / cloud load balancer) ────────
app.set("trust proxy", 1);

// ── CORS ──────────────────────────────────────────────────────────────────────
// Parse configured origins (supports comma-separated list, trims whitespace and trailing slashes)
const configuredOrigins = (CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().replace(/\/+$/, ""))
  .filter(Boolean);

const defaultAllowedOrigins = [
  ...configuredOrigins,
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:5176",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:5174",
  "http://127.0.0.1:5175",
  "http://127.0.0.1:5176",
];

function isOriginAllowed(origin) {
  if (!origin) return true;

  const normalized = origin.trim().replace(/\/+$/, "");

  // 1. Wildcard configured in CLIENT_ORIGIN
  if (configuredOrigins.includes("*")) {
    return true;
  }

  // 2. Exact match in default / configured allowed origins (case-insensitive)
  if (
    defaultAllowedOrigins.some(
      (allowed) => allowed.toLowerCase() === normalized.toLowerCase()
    )
  ) {
    return true;
  }

  // 3. Allow any Vercel domain (*.vercel.app - production and preview deployments)
  try {
    const url = new URL(normalized);
    if (url.hostname === "vercel.app" || url.hostname.endsWith(".vercel.app")) {
      return true;
    }
    // Also allow Render domain (*.onrender.com)
    if (url.hostname === "onrender.com" || url.hostname.endsWith(".onrender.com")) {
      return true;
    }
  } catch (_) {}

  // 4. In development / non-production, allow any localhost or 127.0.0.1 port
  if (
    NODE_ENV !== "production" &&
    /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(normalized)
  ) {
    return true;
  }

  return false;
}

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g. mobile apps, curl, Postman, server-to-server)
      if (!origin) return callback(null, true);

      if (isOriginAllowed(origin)) {
        return callback(null, true);
      }

      console.warn(`[CORS Blocked] Origin not allowed: "${origin}"`);
      return callback(null, false);
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS", "HEAD"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "Accept",
      "Origin",
      "Cache-Control",
      "Pragma",
    ],
    exposedHeaders: ["RateLimit-Limit", "RateLimit-Remaining", "RateLimit-Reset"],
    optionsSuccessStatus: 204,
  })
);

// ── Body parsers ──────────────────────────────────────────────────────────────
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// ── HTTP request logger ───────────────────────────────────────────────────────
app.use(loggerMiddleware);

// ── Rate limiter ──────────────────────────────────────────────────────────────
app.use(rateLimitMiddleware);

// ── Health check ──────────────────────────────────────────────────────────────
// Intentionally before auth middleware — must always respond
app.get("/api/health", (req, res) => {
  res.status(200).json({
    success:     true,
    message:     "Strengthway API is running.",
    version:     "1.0.0",
    environment: NODE_ENV,
    timestamp:   new Date().toISOString(),
  });
});

// ── API info route ────────────────────────────────────────────────────────────
app.get("/api/v1", (req, res) => {
  res.status(200).json({
    success: true,
    message: "Strengthway API v1",
    endpoints: {
      auth:     "/api/v1/auth",
      members:  "/api/v1/members",
      trainers: "/api/v1/trainers",
      plans:    "/api/v1/plans",
      batches:  "/api/v1/batches",
      inquiries: "/api/v1/inquiries",
      schedules:  "/api/v1/schedules",
      classes:    "/api/v1/classes",
      sessions:   "/api/v1/sessions",
      holidays:   "/api/v1/holidays",
      attendance: "/api/v1/attendance",
      trainerLeaves: "/api/v1/trainer-leaves",
      uploads:    "/api/v1/uploads",
      portfolio:  "/api/v1/portfolio",
    },
    docs: "See README.md for full API reference.",
  });
});

// ── Feature module routes ─────────────────────────────────────────────────────
const authRoutes         = require("./modules/auth/auth.routes");
const memberRoutes       = require("./modules/members/member.routes");
const trainerRoutes      = require("./modules/trainers/trainer.routes");
const planRoutes         = require("./modules/membership-plans/plan.routes");
const batchRoutes        = require("./modules/batches/batch.routes");
const inquiryRoutes      = require("./modules/inquiries/inquiry.routes");
const scheduleRoutes     = require("./modules/schedules/schedule.routes");
const sessionRoutes      = require("./modules/schedules/session.routes");
const holidayRoutes      = require("./modules/schedules/holiday.routes");
const attendanceRoutes   = require("./modules/attendance/attendance.routes");
const trainerLeaveRoutes = require("./modules/attendance/trainerLeave.routes");
const uploadRoutes       = require("./modules/uploads/upload.routes");
const classRoutes        = require("./modules/classes/class.routes");
const portfolioRoutes    = require("./modules/portfolio/portfolio.routes");

app.use("/api/v1/auth",           authRoutes);
app.use("/api/v1/members",        memberRoutes);
app.use("/api/v1/trainers",       trainerRoutes);
app.use("/api/v1/plans",          planRoutes);
app.use("/api/v1/batches",        batchRoutes);
app.use("/api/v1/inquiries",      inquiryRoutes);
app.use("/api/v1/schedules",      scheduleRoutes);
app.use("/api/v1/classes",        classRoutes);
app.use("/api/v1/sessions",       sessionRoutes);
app.use("/api/v1/holidays",       holidayRoutes);
app.use("/api/v1/attendance",     attendanceRoutes);
app.use("/api/v1/trainer-leaves", trainerLeaveRoutes);
app.use("/api/v1/uploads",        uploadRoutes);
app.use("/api/v1/portfolio",      portfolioRoutes);



// ── 404 handler (must come AFTER all valid routes) ────────────────────────────
app.use(notFoundMiddleware);

// ── Global error handler (must be the VERY LAST middleware) ───────────────────
app.use(errorMiddleware);

module.exports = app;
