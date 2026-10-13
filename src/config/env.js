"use strict";

require("dotenv").config();

// ─── Required variables — app will not start without these ───────────────────
const REQUIRED_VARS = ["MONGODB_URI", "JWT_SECRET"];

REQUIRED_VARS.forEach((key) => {
  if (!process.env[key] || process.env[key].trim() === "") {
    throw new Error(
      `[Config] Missing required environment variable: "${key}". ` +
        `Copy .env.example to .env and fill in the values.`
    );
  }
});

// ─── Exported config object (frozen to prevent mutation) ─────────────────────
const config = Object.freeze({
  // Server
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: parseInt(process.env.PORT, 10) || 5000,
  IS_PRODUCTION: process.env.NODE_ENV === "production",
  IS_TEST: process.env.NODE_ENV === "test" || process.env.JEST_WORKER_ID !== undefined,

  // Database
  MONGODB_URI: process.env.MONGODB_URI,

  // Auth
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || "7d",

  // Cloudinary (optional — only needed when upload module is active)
  CLOUDINARY_CLOUD_NAME: process.env.CLOUDINARY_CLOUD_NAME || "",
  CLOUDINARY_API_KEY: process.env.CLOUDINARY_API_KEY || "",
  CLOUDINARY_API_SECRET: process.env.CLOUDINARY_API_SECRET || "",

  // CORS
  CLIENT_ORIGIN: process.env.CLIENT_ORIGIN || "http://localhost:5173",

  // Rate limiting
  RATE_LIMIT_WINDOW_MS: parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 900_000, // 15 min
  RATE_LIMIT_MAX: parseInt(process.env.RATE_LIMIT_MAX, 10) || 200,
});

module.exports = config;
