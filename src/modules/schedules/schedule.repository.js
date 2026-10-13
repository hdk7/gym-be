"use strict";

const MasterSchedule = require("./schedule.model");
const ScheduleItem = require("./schedule-item.model");
const Session = require("./session.model");
const Holiday = require("./holiday.model");
const {
  SEED_SCHEDULES,
  SEED_HOLIDAYS,
  createItemsForSchedule,
  generateSessionsForSchedule,
} = require("./schedule.seed");

class ScheduleRepository {
  async ensureSeeded() {
    const scheduleCount = await MasterSchedule.countDocuments();
    if (scheduleCount === 0) {
      for (const schedData of SEED_SCHEDULES) {
        await MasterSchedule.create(schedData);
        const items = createItemsForSchedule(schedData);
        if (items.length > 0) {
          await ScheduleItem.insertMany(items);
        }
        const sessions = generateSessionsForSchedule(schedData, items);
        if (sessions.length > 0) {
          await Session.insertMany(sessions);
        }
      }
    }

    const holidayCount = await Holiday.countDocuments();
    if (holidayCount === 0) {
      await Holiday.insertMany(SEED_HOLIDAYS);
    }
  }

  // ─── Master Schedules ──────────────────────────────────────────────────────────
  async findAllSchedules({ filter = {}, sort = { createdAt: 1 } } = {}) {
    await this.ensureSeeded();
    return MasterSchedule.find(filter).sort(sort).lean();
  }

  async findScheduleById(id) {
    await this.ensureSeeded();
    return MasterSchedule.findOne({ id }).lean();
  }

  async createSchedule(data) {
    const schedule = new MasterSchedule(data);
    return (await schedule.save()).toObject();
  }

  async updateScheduleById(id, updates) {
    return MasterSchedule.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteScheduleById(id) {
    return MasterSchedule.findOneAndDelete({ id });
  }

  async countSchedules(filter = {}) {
    return MasterSchedule.countDocuments(filter);
  }

  // ─── Schedule Items (Curriculum) ──────────────────────────────────────────────
  async findItemsByScheduleId(masterScheduleId) {
    await this.ensureSeeded();
    return ScheduleItem.find({ masterScheduleId }).sort({ classNumber: 1 }).lean();
  }

  async findItemById(id) {
    return ScheduleItem.findOne({ id }).lean();
  }

  async createItem(itemData) {
    const item = new ScheduleItem(itemData);
    return (await item.save()).toObject();
  }

  async createManyItems(items) {
    if (!items || items.length === 0) return [];
    return ScheduleItem.insertMany(items);
  }

  async updateItemById(id, updates) {
    return ScheduleItem.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteItemById(id) {
    return ScheduleItem.findOneAndDelete({ id });
  }

  async deleteItemsByScheduleId(masterScheduleId) {
    return ScheduleItem.deleteMany({ masterScheduleId });
  }

  // ─── Sessions ─────────────────────────────────────────────────────────────────
  async findAllSessions({ filter = {}, sort = { sessionDate: 1, classNumber: 1 } } = {}) {
    await this.ensureSeeded();
    return Session.find(filter).sort(sort).lean();
  }

  async findSessionById(id) {
    return Session.findOne({ id }).lean();
  }

  async createSession(data) {
    const session = new Session(data);
    return (await session.save()).toObject();
  }

  async createManySessions(sessions) {
    if (!sessions || sessions.length === 0) return [];
    const bulkOps = sessions.map((s) => ({
      updateOne: {
        filter: { batchId: s.batchId, sessionDate: s.sessionDate },
        update: { $set: s },
        upsert: true,
      },
    }));
    await Session.bulkWrite(bulkOps);
    return sessions;
  }

  async updateSessionById(id, updates) {
    return Session.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async updateSessionsByFilter(filter, updates) {
    return Session.updateMany(
      filter,
      { $set: { ...updates, updatedAt: new Date() } }
    );
  }

  async deleteSessionsByScheduleId(masterScheduleId) {
    return Session.deleteMany({ masterScheduleId });
  }

  async deleteSessionsByBatchIdAndScheduleId(masterScheduleId, batchId) {
    return Session.deleteMany({ masterScheduleId, batchId });
  }

  // ─── Holidays ─────────────────────────────────────────────────────────────────
  async findAllHolidays({ filter = {}, sort = { date: 1 } } = {}) {
    await this.ensureSeeded();
    return Holiday.find(filter).sort(sort).lean();
  }

  async findHolidayById(id) {
    await this.ensureSeeded();
    return Holiday.findOne({ id }).lean();
  }

  async createHoliday(data) {
    const holiday = new Holiday(data);
    return (await holiday.save()).toObject();
  }

  async updateHolidayById(id, updates) {
    return Holiday.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteHolidayById(id) {
    return Holiday.findOneAndDelete({ id });
  }
}

module.exports = new ScheduleRepository();
