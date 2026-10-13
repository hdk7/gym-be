"use strict";

require("../config/env");
const { connectDB, disconnectDB } = require("../config/database");
const MembershipPlan = require("../modules/membership-plans/plan.model");
const { SEED_PLANS } = require("./data/plans.seed");

/**
 * Seeds Membership Plans into MongoDB Atlas.
 * Idempotent: upserts by plan ID.
 */
async function seedPlans(options = {}) {
  const { drop = false, silent = false } = options;

  if (drop) {
    try {
      await MembershipPlan.collection.drop();
      if (!silent) console.log("[Seed:Plans] Collection dropped.");
    } catch (e) {
      // Ignore if collection doesn't exist
    }
  }

  let upserted = 0;
  for (const plan of SEED_PLANS) {
    await MembershipPlan.findOneAndUpdate(
      { id: plan.id },
      { $set: plan },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    upserted++;
  }

  if (!silent) {
    console.log(`[Seed:Plans] ✓ ${upserted} membership plans seeded/upserted.`);
  }

  return { total: SEED_PLANS.length, upserted };
}

// Standalone execution support: node src/seeds/plans.seed.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const drop = process.argv.includes("--drop");
      await seedPlans({ drop });
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("[Seed:Plans] ✗ Error:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = seedPlans;
