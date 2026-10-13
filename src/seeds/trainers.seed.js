"use strict";

require("../config/env");
const { connectDB, disconnectDB } = require("../config/database");
const Trainer = require("../modules/trainers/trainer.model");
const { SEED_TRAINERS } = require("./data/trainers.seed");

/**
 * Seeds Trainers into MongoDB Atlas.
 * Idempotent: upserts by trainer ID.
 */
async function seedTrainers(options = {}) {
  const { drop = false, silent = false } = options;

  if (drop) {
    try {
      await Trainer.collection.drop();
      if (!silent) console.log("[Seed:Trainers] Collection dropped.");
    } catch (e) {
      // Ignore if collection doesn't exist
    }
  }

  let upserted = 0;
  for (const trainer of SEED_TRAINERS) {
    await Trainer.findOneAndUpdate(
      { id: trainer.id },
      { $set: trainer },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    upserted++;
  }

  if (!silent) {
    console.log(`[Seed:Trainers] ✓ ${upserted} trainers seeded/upserted.`);
  }

  return { total: SEED_TRAINERS.length, upserted };
}

// Standalone execution support: node src/seeds/trainers.seed.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const drop = process.argv.includes("--drop");
      await seedTrainers({ drop });
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("[Seed:Trainers] ✗ Error:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = seedTrainers;
