"use strict";

const ClassProgram = require("./class.model");
const ScheduleHistory = require("./scheduleHistory.model");
const Session = require("../schedules/session.model");

class ClassRepository {
  async findAll({ filter = {}, sort = { createdAt: -1 }, skip = 0, limit = 50 } = {}) {
    const query = { isDeleted: false, ...filter };
    return ClassProgram.find(query).sort(sort).skip(skip).limit(limit).lean();
  }

  async count(filter = {}) {
    return ClassProgram.countDocuments({ isDeleted: false, ...filter });
  }

  async findById(id) {
    return ClassProgram.findOne({ id, isDeleted: false }).lean();
  }

  async findByName(name) {
    return ClassProgram.findOne({
      name: { $regex: new RegExp(`^${name.trim()}$`, "i") },
      isDeleted: false,
    }).lean();
  }

  async create(data) {
    const doc = new ClassProgram(data);
    return doc.save();
  }

  async update(id, data) {
    return ClassProgram.findOneAndUpdate(
      { id, isDeleted: false },
      { $set: data },
      { returnDocument: "after", runValidators: true }
    ).lean();
  }

  async softDelete(id) {
    return ClassProgram.findOneAndUpdate(
      { id, isDeleted: false },
      { $set: { isDeleted: true, deletedAt: new Date() } },
      { returnDocument: "after" }
    ).lean();
  }

  async getMaxNumericSuffix() {
    const classes = await ClassProgram.find({}, { id: 1 }).lean();
    let max = 0;
    for (const c of classes) {
      const match = c.id && c.id.match(/^CLS-(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > max) max = num;
      }
    }
    return max;
  }

  // ─── Schedule History Log Helpers ──────────────────────────────────────────
  async logHistory(data) {
    const doc = new ScheduleHistory(data);
    return doc.save();
  }

  async getHistoryByBatchId(batchId, limit = 50) {
    return ScheduleHistory.find({ batchId }).sort({ createdAt: -1 }).limit(limit).lean();
  }

  // ─── Active Floor Sessions Reference Check ────────────────────────────────
  async countActiveUpcomingSessions(classId) {
    return Session.countDocuments({
      classId,
      status: { $in: ["SCHEDULED", "TODAY"] },
    });
  }
}

module.exports = new ClassRepository();
