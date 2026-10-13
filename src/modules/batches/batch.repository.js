"use strict";

const Batch = require("./batch.model");
const CoachShift = require("./coachShift.model");
const ScheduledClass = require("./scheduledClass.model");

class BatchRepository {
  // ─── Batches ────────────────────────────────────────────────────────────────
  async findAll({ filter = {}, sort = { id: 1 } } = {}) {
    return Batch.find(filter).sort(sort).lean();
  }

  async findById(id) {
    if (!id) return null;
    let batch = await Batch.findOne({ id }).lean();
    if (!batch) {
      const candidates = [id, id.toUpperCase(), id.toLowerCase()];
      const numMatch = id.match(/\d+/);
      if (numMatch) {
        const n = parseInt(numMatch[0], 10);
        candidates.push(`BATCH-${String(n).padStart(2, "0")}`);
        candidates.push(`BATCH-${n}`);
        candidates.push(`Batch ${n}`);
        candidates.push(`BATCH ${n}`);
        candidates.push(`batch ${n}`);
      }
      batch = await Batch.findOne({
        $or: [
          { id: { $in: candidates } },
          { name: { $in: candidates } },
          { shortName: { $in: candidates } },
        ],
      }).lean();
    }
    return batch;
  }

  async create(data) {
    const batch = new Batch(data);
    return (await batch.save()).toObject();
  }

  async updateById(id, updates) {
    return Batch.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", runValidators: false, lean: true }
    );
  }

  async deleteById(id) {
    return Batch.findOneAndDelete({ id });
  }

  async addMember(batchId, memberId) {
    return Batch.findOneAndUpdate(
      { id: batchId },
      {
        $addToSet: { memberIds: memberId },
      },
      { returnDocument: "after", lean: true }
    );
  }

  async removeMember(batchId, memberId) {
    return Batch.findOneAndUpdate(
      { id: batchId },
      {
        $pull: { memberIds: memberId },
      },
      { returnDocument: "after", lean: true }
    );
  }

  async syncPaxCount(batchId) {
    const Member = require("../members/member.model");
    const activeMembers = await Member.find(
      { isDeleted: false, $or: [{ batchId }, { "schedule.batchId": batchId }] },
      { id: 1 }
    ).lean();
    const count = activeMembers.length;
    const memberIds = activeMembers.map((m) => m.id);

    const batch = await Batch.findOneAndUpdate(
      { id: batchId },
      { $set: { currentPax: count, memberIds, updatedAt: new Date() } },
      { returnDocument: "after", lean: true }
    );
    return batch;
  }

  // ─── Coach Shifts ───────────────────────────────────────────────────────────
  async countCoachShifts() {
    return CoachShift.countDocuments();
  }

  async findAllCoachShifts() {
    return CoachShift.find({}).sort({ coachId: 1 }).lean();
  }

  async findCoachShiftById(coachId) {
    return CoachShift.findOne({ coachId }).lean();
  }

  async upsertCoachShift(coachId, data) {
    return CoachShift.findOneAndUpdate(
      { coachId },
      { $set: { ...data, updatedAt: new Date() } },
      { returnDocument: "after", upsert: true, lean: true }
    );
  }

  async insertManyCoachShifts(shifts) {
    return CoachShift.insertMany(shifts);
  }

  // ─── Scheduled Classes ──────────────────────────────────────────────────────
  async countClasses() {
    return ScheduledClass.countDocuments();
  }

  async findAllClasses(filter = {}) {
    return ScheduledClass.find(filter).sort({ batchId: 1, id: 1 }).lean();
  }

  async findClassById(id) {
    return ScheduledClass.findOne({ id }).lean();
  }

  async createClass(data) {
    const cls = new ScheduledClass(data);
    return (await cls.save()).toObject();
  }

  async updateClassById(id, updates) {
    return ScheduledClass.findOneAndUpdate(
      { id },
      { $set: { ...updates, updatedAt: new Date() } },
      { returnDocument: "after", lean: true }
    );
  }

  async deleteClassById(id) {
    return ScheduledClass.findOneAndDelete({ id });
  }

  async deleteClassesByBatchId(batchId) {
    return ScheduledClass.deleteMany({ batchId });
  }

  async insertManyClasses(classes) {
    return ScheduledClass.insertMany(classes);
  }
}

module.exports = new BatchRepository();
