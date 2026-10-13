"use strict";

const { connectDB, disconnectDB } = require("./config/database");
const { PORT, NODE_ENV } = require("./config/env");
const app = require("./app");

/**
 * Bootstrap the HTTP server:
 *   1. Connect to MongoDB Atlas
 *   2. Start the Express server
 *   3. Register graceful shutdown handlers (SIGTERM, SIGINT)
 */
async function bootstrap() {
  // 1. Establish database connection before accepting traffic
  await connectDB();

  // 2. Start listening
  const server = app.listen(PORT, () => {
    console.log("─────────────────────────────────────────────");
    console.log(`  Strengthway API`);
    console.log(`  ENV  : ${NODE_ENV}`);
    console.log(`  PORT : ${PORT}`);
    console.log(`  URL  : http://localhost:${PORT}/api/health`);
    console.log("─────────────────────────────────────────────");
  });

  // 3. Graceful shutdown — finish in-flight requests before closing
  async function shutdown(signal) {
    console.log(`\n[Server] ${signal} received. Shutting down gracefully…`);
    server.close(async () => {
      await disconnectDB();
      console.log("[Server] Graceful shutdown complete.");
      process.exit(0);
    });

    // Force-kill after 10 seconds if shutdown stalls
    setTimeout(() => {
      console.error("[Server] Forced shutdown after timeout.");
      process.exit(1);
    }, 10_000);
  }

  process.on("SIGTERM", () => shutdown("SIGTERM")); // Docker / cloud stop
  process.on("SIGINT",  () => shutdown("SIGINT"));  // Ctrl+C in terminal

  // Catch unhandled promise rejections and uncaught exceptions
  process.on("unhandledRejection", (reason) => {
    console.error("[Server] Unhandled Promise Rejection:", reason);
  });

  process.on("uncaughtException", (err) => {
    console.error("[Server] Uncaught Exception:", err.message);
    process.exit(1);
  });
}

bootstrap();
