"use strict";

require("../config/env");
const { connectDB, disconnectDB } = require("../config/database");
const ClassProgram = require("../modules/classes/class.model");
const { SEED_CLASSES } = require("./data/classes.seed");

/**
 * Seeds Reusable Class Programs into MongoDB Atlas.
 * Idempotent: upserts by class ID or name.
 */
async function seedClasses(options = {}) {
  const { drop = false, silent = false } = options;

  if (drop) {
    try {
      await ClassProgram.collection.drop();
      if (!silent) console.log("[Seed:Classes] Collection dropped.");
    } catch (e) {
      // Ignore if collection doesn't exist
    }
  }

  let upserted = 0;
  for (const cls of SEED_CLASSES) {
    await ClassProgram.findOneAndUpdate(
      { $or: [{ id: cls.id }, { name: cls.name }] },
      {
        $set: {
          id: cls.id,
          name: cls.name,
          beginnerWorkouts: cls.beginnerWorkouts,
          intermediateWorkouts: cls.intermediateWorkouts,
          status: cls.status || "ACTIVE",
          isDeleted: false,
        },
      },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    upserted++;
  }

  if (!silent) {
    console.log(`[Seed:Classes] ✓ ${upserted} reusable class programs seeded/upserted.`);
  }

  return { total: SEED_CLASSES.length, upserted };
}

// Standalone execution support: node src/seeds/classes.seed.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const drop = process.argv.includes("--drop");
      await seedClasses({ drop });
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("[Seed:Classes] ✗ Error:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = seedClasses;
