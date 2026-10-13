"use strict";

/**
 * StrengthWay Master Database Seeder
 * ==================================
 * Sequentially seeds all core collections into MongoDB Atlas:
 *   1. Admin Accounts
 *   2. Membership Plans
 *   3. Trainers
 *   4. Batches
 *   5. Members
 *   6. Master Schedules, Items, Sessions & Holidays
 *   7. Reusable Classes (15 TSW Programs)
 *
 * Supports CLI flags:
 *   --drop    : Drops existing collections before seeding (clean reload)
 *   --only=X  : Seeds only a specific collection (admin, plans, trainers, batches, members, schedules, classes)
 */

require("../config/env");
const { connectDB, disconnectDB } = require("../config/database");
const seedAdmin     = require("./seed.admin");
const seedPlans     = require("./plans.seed");
const seedTrainers  = require("./trainers.seed");
const seedBatches   = require("./batches.seed");
const seedMembers   = require("./members.seed");
const seedSchedules = require("./schedules.seed");
const seedClasses   = require("./classes.seed");

const DROP_FIRST = process.argv.includes("--drop");
const ONLY_ARG = process.argv.find((arg) => arg.startsWith("--only="));
const ONLY = ONLY_ARG ? ONLY_ARG.split("=")[1].toLowerCase() : null;

async function runSeed() {
  const startTime = Date.now();
  console.log("=========================================");
  console.log("  StrengthWay Database Seeder (Phase 9)  ");
  console.log("=========================================");
  if (DROP_FIRST) console.log("  MODE: DROP & RELOAD");
  if (ONLY) console.log(`  FILTER: Only seeding "${ONLY}"`);

  await connectDB();
  console.log("\n[Seed] Starting seed sequence…");

  const shouldRun = (name) => !ONLY || ONLY === name;

  if (shouldRun("admin")) {
    await seedAdmin({ silent: false });
  }

  if (shouldRun("plans")) {
    await seedPlans({ drop: DROP_FIRST });
  }

  if (shouldRun("trainers")) {
    await seedTrainers({ drop: DROP_FIRST });
  }

  if (shouldRun("batches")) {
    await seedBatches({ drop: DROP_FIRST });
  }

  if (shouldRun("members")) {
    await seedMembers({ drop: DROP_FIRST });
  }

  if (shouldRun("schedules")) {
    await seedSchedules({ drop: DROP_FIRST });
  }

  if (shouldRun("classes")) {
    await seedClasses({ drop: DROP_FIRST });
  }

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log("\n=========================================");
  console.log(`[Seed] ✓ Complete in ${durationSec}s. Exiting.`);
  console.log("=========================================\n");

  await disconnectDB();
  process.exit(0);
}

runSeed().catch(async (err) => {
  console.error("[Seed] ✗ Seeding failed:", err.message);
  try {
    await disconnectDB();
  } catch (_) {}
  process.exit(1);
});
