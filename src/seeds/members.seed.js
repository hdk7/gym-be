"use strict";

require("../config/env");
const { connectDB, disconnectDB } = require("../config/database");
const Member = require("../modules/members/member.model");
const { SEED_MEMBERS } = require("./data/members.seed");

/**
 * Seeds Members into MongoDB Atlas.
 * Idempotent: upserts by member ID.
 */
async function seedMembers(options = {}) {
  const { drop = false, silent = false } = options;

  if (drop) {
    try {
      await Member.collection.drop();
      if (!silent) console.log("[Seed:Members] Collection dropped.");
    } catch (e) {
      // Ignore if collection doesn't exist
    }
  }

  let upserted = 0;
  let skipped = 0;

  for (const member of SEED_MEMBERS) {
    try {
      await Member.findOneAndUpdate(
        { id: member.id },
        { $set: member },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      upserted++;
    } catch (err) {
      if (err.code === 11000) {
        skipped++;
      } else {
        throw err;
      }
    }
  }

  if (!silent) {
    console.log(
      `[Seed:Members] ✓ ${upserted} members seeded/upserted${skipped > 0 ? ` (${skipped} duplicates skipped)` : ""}.`
    );
  }

  return { total: SEED_MEMBERS.length, upserted, skipped };
}

// Standalone execution support: node src/seeds/members.seed.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const drop = process.argv.includes("--drop");
      await seedMembers({ drop });
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("[Seed:Members] ✗ Error:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = seedMembers;
