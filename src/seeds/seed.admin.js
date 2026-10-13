"use strict";

/**
 * Admin User Seeder
 * =================
 * Creates the default administrative accounts if they don't already exist.
 * Run standalone with:  node src/seeds/seed.admin.js
 */

require("../config/env");
const bcrypt = require("bcryptjs");
const { connectDB, disconnectDB } = require("../config/database");
const User = require("../modules/auth/user.model");

const DEFAULT_ADMINS = [
  {
    name: "StrengthWay Admin",
    email: "admin@strengthway.com",
    password: "Admin@2026",
    role: "admin",
  }
];

async function seedAdmin(options = {}) {
  const { silent = false } = options;
  let seeded = 0;
  let skipped = 0;

  for (const adminData of DEFAULT_ADMINS) {
    const passwordHash = await bcrypt.hash(adminData.password, 12);
    const existing = await User.findOne({ email: adminData.email.toLowerCase() });
    if (existing) {
      existing.passwordHash = passwordHash;
      existing.name = adminData.name;
      existing.role = adminData.role;
      existing.isActive = true;
      await existing.save();
      seeded++;
      if (!silent) console.log(`[Seed:Admin] ✓ Admin account updated: ${adminData.email} with password ${adminData.password}`);
      continue;
    }

    await User.create({
      name: adminData.name,
      email: adminData.email.toLowerCase(),
      passwordHash,
      role: adminData.role,
    });
    seeded++;
    if (!silent) {
      console.log(`[Seed:Admin] ✓ Admin account created: ${adminData.email} (${adminData.name})`);
    }
  }

  return { seeded, skipped };
}

// Standalone execution support: node src/seeds/seed.admin.js
if (require.main === module) {
  (async () => {
    try {
      console.log("[ADMIN SEED] Connecting to database...");
      await connectDB();
      await seedAdmin({ silent: false });
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("[ADMIN SEED] ✗ Failed:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = seedAdmin;
