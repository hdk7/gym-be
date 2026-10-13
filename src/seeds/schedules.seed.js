"use strict";

require("../config/env");
const { connectDB, disconnectDB } = require("../config/database");
const MasterSchedule = require("../modules/schedules/schedule.model");
const ScheduleItem = require("../modules/schedules/schedule-item.model");
const Session = require("../modules/schedules/session.model");
const Holiday = require("../modules/schedules/holiday.model");
const {
  SEED_SCHEDULES,
  SEED_HOLIDAYS,
  createItemsForSchedule,
  generateSessionsForSchedule,
} = require("../modules/schedules/schedule.seed");

/**
 * Seeds Master Schedules, Curriculum Items, Batch Sessions, and Holidays into MongoDB.
 * Idempotent: upserts by ID.
 */
async function seedSchedules(options = {}) {
  const { drop = false, silent = false } = options;

  if (drop) {
    try {
      await MasterSchedule.collection.drop();
      await ScheduleItem.collection.drop();
      await Session.collection.drop();
      await Holiday.collection.drop();
      if (!silent) console.log("[Seed:Schedules] Schedule, item, session, and holiday collections dropped.");
    } catch (_) {
      // Ignore if collections do not exist
    }
  }

  let seededSchedules = 0;
  let seededItems = 0;
  let seededSessions = 0;

  for (const schedData of SEED_SCHEDULES) {
    await MasterSchedule.findOneAndUpdate(
      { id: schedData.id },
      { $set: schedData },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    seededSchedules++;

    const items = createItemsForSchedule(schedData);
    for (const item of items) {
      await ScheduleItem.findOneAndUpdate(
        { id: item.id },
        { $set: item },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      seededItems++;
    }

    const sessions = generateSessionsForSchedule(schedData, items);
    for (const ses of sessions) {
      await Session.findOneAndUpdate(
        { id: ses.id },
        { $set: ses },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );
      seededSessions++;
    }
  }

  let seededHolidays = 0;
  for (const hol of SEED_HOLIDAYS) {
    await Holiday.findOneAndUpdate(
      { id: hol.id },
      { $set: hol },
      { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
    );
    seededHolidays++;
  }

  if (!silent) {
    console.log(
      `[Seed:Schedules] ✓ ${seededSchedules} schedules, ${seededItems} items, ${seededSessions} sessions, and ${seededHolidays} holidays seeded/upserted.`
    );
  }

  return {
    schedules: seededSchedules,
    items: seededItems,
    sessions: seededSessions,
    holidays: seededHolidays,
  };
}

// Standalone execution support: node src/seeds/schedules.seed.js
if (require.main === module) {
  (async () => {
    try {
      await connectDB();
      const drop = process.argv.includes("--drop");
      await seedSchedules({ drop });
      await disconnectDB();
      process.exit(0);
    } catch (err) {
      console.error("[Seed:Schedules] ✗ Error:", err.message);
      process.exit(1);
    }
  })();
}

module.exports = seedSchedules;
