"use strict";

const dns = require("dns");
const mongoose = require("mongoose");
const { MONGODB_URI, IS_TEST } = require("./env");

// Ensure MongoDB Atlas SRV records resolve properly on Windows/local networks
try {
  dns.setServers(["8.8.8.8", "1.1.1.1"]);
} catch (dnsErr) {
  // Fall back to system DNS
}

if (typeof global.performance === "undefined") {
  try {
    global.performance = require("perf_hooks").performance;
  } catch (_) {}
}

if (typeof global.crypto === "undefined") {
  try {
    global.crypto = require("crypto");
  } catch (_) {}
}

let isConnected = false;

/**
 * Connects to MongoDB Atlas using the URI from environment.
 * Safe to call multiple times — subsequent calls are no-ops if already connected.
 */
async function connectDB(retries = 3, delayMs = 2000) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    if (mongoose.connection.readyState === 1) {
      isConnected = true;
      return;
    }

    try {
      const connection = await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 15_000,
        socketTimeoutMS: 45_000,
      });

      isConnected = true;

      if (!IS_TEST) {
        console.log(
          `[DB] ✓ Connected to MongoDB → ${connection.connection.host} / ${connection.connection.name}`
        );
      }
      return;
    } catch (err) {
      console.error(`[DB] ✗ Connection failed (attempt ${attempt}/${retries}):`, err.message);
      if (attempt === retries) {
        if (IS_TEST) {
          throw err;
        }
        // Exit so the process doesn't run without a database
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
}

/**
 * Gracefully closes the Mongoose connection.
 * Used in tests and graceful shutdown handlers.
 */
async function disconnectDB(force = false) {
  if (IS_TEST && !force) return; // Keep connection open between in-band test suites
  if (mongoose.connection.readyState === 0) {
    isConnected = false;
    return;
  }
  await mongoose.connection.close();
  isConnected = false;
  if (!IS_TEST) {
    console.log("[DB] Connection closed.");
  }
}

// ─── Connection lifecycle events ─────────────────────────────────────────────
mongoose.connection.on("disconnected", () => {
  isConnected = false;
  if (!IS_TEST) {
    console.warn("[DB] Disconnected from MongoDB.");
  }
});

mongoose.connection.on("error", (err) => {
  if (!IS_TEST) {
    console.error("[DB] Mongoose error:", err.message);
  }
});

module.exports = { connectDB, disconnectDB };
