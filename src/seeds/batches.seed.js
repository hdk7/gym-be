"use strict";

require("../config/env");
const { connectDB, disconnectDB } = require("../config/database");
const Batch = require("../modules/batches/batch.model");
const { SEED_BATCHES } = require("./data/batches.seed");

/**
 * Seeds Batches into MongoDB Atlas.
 * Idempotent: upserts by batch ID.
 */
async function seedBatches(options = {}) {
  const { drop = false, silent = false } = options;

  if (drop) {
    try {
      await Batch.collection.drop();
      if (!silent) console.log("[Seed:Batches] Collection dropped.");
    } catch (e) {
      // Ignore if collection doesn't exist
    }
  }

  let upserted = 0;
  for (const batch of SEED_BATCHES) {
    await Batch.findOneAndUpdate(
      { id: batch.id },
      { $set: batch },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    upserted++;
  }

  if (!silent) {
    console.log(`[Seed:Batches] ✓ ${upserted} batches seeded/upserted.`);
  }

  return { total: SEED_BATCHES.length, upserted };
}

// Standalone execution support: node src/seeds/batches.seed.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const drop = process.argv.includes("--drop");
      await seedBatches({ drop });
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("[Seed:Batches] ✗ Error:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = seedBatches;
