"use strict";

const batchRepository = require("./batch.repository");
const { NotFoundError, ConflictError } = require("../../shared/apiError");
const { BATCH_STATUS } = require("../../shared/constants");
const {
  SHIFT_SLOTS,
  SEED_COACH_SHIFTS,
  SEED_SCHEDULED_CLASSES,
} = require("../../seeds/data/batches.seed");

const { resolveDaysDetails } = require("./batch.utils");
const { getBatchMonthTracking } = require("./batchTracking.service");

class BatchService {
  // ─── Batches ────────────────────────────────────────────────────────────────
  async getAll({ status } = {}) {
    const filter = {};
    if (status && status !== "All" && status !== "ALL") filter.status = status;
    const batches = await batchRepository.findAll({ filter });

    const Member = require("../members/member.model");
    const Trainer = require("../trainers/trainer.model");

    const allMembers = await Member.find(
      { isDeleted: false },
      { id: 1, batchId: 1, schedule: 1 }
    ).lean();
    const allTrainers = await Trainer.find(
      { isDeleted: false },
      { id: 1, name: 1, batchIds: 1 }
    ).lean();
    const validTrainerMap = new Map(allTrainers.map((t) => [t.id, t]));

    return batches.map((b) => {
      const activeMembers = allMembers.filter(
        (m) => m.batchId === b.id || m.schedule?.batchId === b.id
      );
      const rawTrainerIds = Array.isArray(b.trainerIds) ? b.trainerIds : [];
      const trainerIdsFromTrainers = allTrainers
        .filter((t) => Array.isArray(t.batchIds) && t.batchIds.includes(b.id))
        .map((t) => t.id);

      const unionTrainerIds = Array.from(
        new Set([
          ...rawTrainerIds.filter((tid) => validTrainerMap.has(tid)),
          ...trainerIdsFromTrainers,
        ])
      );

      return {
        ...b,
        currentPax: activeMembers.length,
        memberIds: activeMembers.map((m) => m.id),
        trainerIds: unionTrainerIds,
      };
    });
  }

  async getById(id) {
    const batch = await batchRepository.findById(id);
    if (!batch) throw new NotFoundError(`Batch "${id}" not found.`);

    const Member = require("../members/member.model");
    const Trainer = require("../trainers/trainer.model");

    const canonicalId = batch.id;
    const batchIdCandidates = [canonicalId, id, id.toUpperCase(), id.toLowerCase()];

    const activeMembers = await Member.find(
      { isDeleted: false, $or: [{ batchId: { $in: batchIdCandidates } }, { "schedule.batchId": { $in: batchIdCandidates } }] },
      { id: 1 }
    ).lean();
    const allTrainers = await Trainer.find(
      { isDeleted: false },
      { id: 1, name: 1, batchIds: 1 }
    ).lean();
    const validTrainerMap = new Map(allTrainers.map((t) => [t.id, t]));
    const rawTrainerIds = Array.isArray(batch.trainerIds) ? batch.trainerIds : [];
    const trainerIdsFromTrainers = allTrainers
      .filter((t) => Array.isArray(t.batchIds) && t.batchIds.some((bId) => batchIdCandidates.includes(bId)))
      .map((t) => t.id);

    const unionTrainerIds = Array.from(
      new Set([
        ...rawTrainerIds.filter((tid) => validTrainerMap.has(tid)),
        ...trainerIdsFromTrainers,
      ])
    );

    return {
      ...batch,
      currentPax: activeMembers.length,
      memberIds: activeMembers.map((m) => m.id),
      trainerIds: unionTrainerIds,
    };
  }

  async create(body) {
    const existing = await batchRepository.findById(body.id);
    if (existing) throw new ConflictError(`Batch "${body.id}" already exists.`);

    const daysInfo = resolveDaysDetails(body.daysPattern, body.daysLabel, body.daysList);
    const timingLabel = body.timingLabel || `${body.startTime} - ${body.endTime}`;

    return batchRepository.create({
      id: body.id,
      name: body.name,
      shortName: body.shortName || body.name,
      startTime: body.startTime,
      endTime: body.endTime,
      timingLabel,
      daysPattern: daysInfo.daysPattern,
      daysLabel: daysInfo.daysLabel,
      daysList: daysInfo.daysList,
      maxPax: Number(body.maxPax) || 28,
      currentPax: Array.isArray(body.memberIds) ? body.memberIds.length : 0,
      status: body.status || BATCH_STATUS.ACTIVE,
      trainerIds: Array.isArray(body.trainerIds) ? body.trainerIds : [],
      memberIds: Array.isArray(body.memberIds) ? body.memberIds : [],
      description: body.description || "",
    });
  }

  async update(id, body) {
    const existing = await this.getById(id);

    const updates = { ...body };

    if (body.startTime || body.endTime) {
      const start = body.startTime || existing.startTime;
      const end = body.endTime || existing.endTime;
      updates.timingLabel = `${start} - ${end}`;
    }

    if (body.daysPattern || body.daysLabel || body.daysList) {
      const daysInfo = resolveDaysDetails(
        body.daysPattern !== undefined ? body.daysPattern : existing.daysPattern,
        body.daysLabel !== undefined ? body.daysLabel : existing.daysLabel,
        body.daysList !== undefined ? body.daysList : existing.daysList
      );
      updates.daysPattern = daysInfo.daysPattern;
      updates.daysLabel = daysInfo.daysLabel;
      updates.daysList = daysInfo.daysList;
    }

    if (Array.isArray(body.memberIds)) {
      updates.currentPax = body.memberIds.length;
    }

    if (Array.isArray(body.trainerIds)) {
      const Trainer = require("../trainers/trainer.model");
      if (body.trainerIds.length > 0) {
        await Trainer.updateMany(
          { id: { $in: body.trainerIds } },
          { $addToSet: { batchIds: id } }
        );
      }
      await Trainer.updateMany(
        { id: { $nin: body.trainerIds }, batchIds: id },
        { $pull: { batchIds: id } }
      );
    }

    return batchRepository.updateById(id, updates);
  }

  async delete(id) {
    await this.getById(id);
    await batchRepository.deleteById(id);
    await batchRepository.deleteClassesByBatchId(id);

    // Unassign members who were assigned to this batch
    const Member = require("../members/member.model");
    await Member.updateMany(
      { $or: [{ batchId: id }, { "schedule.batchId": id }] },
      {
        $set: {
          batchId: "",
          batchName: "",
          batchTiming: "",
          assignedBatch: "Unassigned",
          schedule: null,
          updatedAt: new Date(),
        },
      }
    );

    // Remove this batch from all trainers
    const Trainer = require("../trainers/trainer.model");
    await Trainer.updateMany(
      { batchIds: id },
      { $pull: { batchIds: id } }
    );

    // Clean up floor sessions mapped to this batch
    try {
      const Session = require("../schedules/session.model");
      await Session.deleteMany({ batchId: id });
    } catch {
      // Non-fatal if session model not found
    }

    return { id, deleted: true };
  }

  async enrollMember(batchId, memberId) {
    const batch = await this.getById(batchId);
    if (batch.memberIds && batch.memberIds.includes(memberId)) {
      return batch; // already enrolled
    }
    if (batch.currentPax >= batch.maxPax) {
      throw new ConflictError(
        `Batch "${batch.name}" is already at full capacity (${batch.maxPax} members).`
      );
    }

    await batchRepository.addMember(batchId, memberId);
    return batchRepository.syncPaxCount(batchId);
  }

  async unenrollMember(batchId, memberId) {
    await this.getById(batchId);
    await batchRepository.removeMember(batchId, memberId);

    // Also clear member's batch assignment in Member collection
    const Member = require("../members/member.model");
    await Member.findOneAndUpdate(
      { id: memberId },
      {
        $set: {
          batchId: "",
          batchName: "",
          batchTiming: "",
          assignedBatch: "Unassigned",
          schedule: null,
          updatedAt: new Date(),
        },
      }
    );

    return batchRepository.syncPaxCount(batchId);
  }

  async syncTrainers(batchId, trainerIds) {
    await this.getById(batchId);
    return batchRepository.updateById(batchId, {
      trainerIds: Array.isArray(trainerIds) ? trainerIds : [],
    });
  }

  async toggleStatus(batchId) {
    const existing = await this.getById(batchId);
    const nextStatus =
      existing.status === BATCH_STATUS.ACTIVE ? BATCH_STATUS.INACTIVE : BATCH_STATUS.ACTIVE;
    return batchRepository.updateById(batchId, { status: nextStatus });
  }

  // ─── Coach Shift Matrix ─────────────────────────────────────────────────────
  async getCoachShifts() {
    const count = await batchRepository.countCoachShifts();
    if (count === 0 && SEED_COACH_SHIFTS && SEED_COACH_SHIFTS.length > 0) {
      await batchRepository.insertManyCoachShifts(SEED_COACH_SHIFTS);
    }
    return batchRepository.findAllCoachShifts();
  }

  async toggleCoachShift(coachId, slotKey) {
    let coach = await batchRepository.findCoachShiftById(coachId);
    if (!coach) {
      // If collection was empty, seed and retry
      await this.getCoachShifts();
      coach = await batchRepository.findCoachShiftById(coachId);
    }
    if (!coach) {
      throw new NotFoundError(`Coach "${coachId}" not found in shift matrix.`);
    }

    const currentShifts = coach.shifts || {};
    const nextVal = !currentShifts[slotKey];
    currentShifts[slotKey] = nextVal;

    const updatedCoach = await batchRepository.upsertCoachShift(coachId, {
      shifts: currentShifts,
    });

    // Sync with batch trainerIds if slotKey maps to a batchId
    const slot = SHIFT_SLOTS.find((s) => s.key === slotKey);
    if (slot && slot.batchId) {
      const batch = await batchRepository.findById(slot.batchId);
      if (batch) {
        let currentTrainers = Array.isArray(batch.trainerIds) ? [...batch.trainerIds] : [];
        if (nextVal && !currentTrainers.includes(coachId)) {
          currentTrainers.push(coachId);
          await batchRepository.updateById(slot.batchId, { trainerIds: currentTrainers });
        } else if (!nextVal && currentTrainers.includes(coachId)) {
          currentTrainers = currentTrainers.filter((id) => id !== coachId);
          await batchRepository.updateById(slot.batchId, { trainerIds: currentTrainers });
        }
      }
    }

    return updatedCoach;
  }

  // ─── Scheduled Classes ──────────────────────────────────────────────────────
  async getAllClasses() {
    const count = await batchRepository.countClasses();
    if (count === 0 && SEED_SCHEDULED_CLASSES && SEED_SCHEDULED_CLASSES.length > 0) {
      await batchRepository.insertManyClasses(SEED_SCHEDULED_CLASSES);
    }
    return batchRepository.findAllClasses();
  }

  async getClassesByBatch(batchId) {
    await this.getAllClasses(); // ensures seeded
    return batchRepository.findAllClasses({ batchId });
  }

  async createClass(batchId, classData) {
    await this.getById(batchId);
    const newId = classData.id || `CLS-${Date.now().toString().slice(-4)}`;
    return batchRepository.createClass({
      id: newId,
      batchId,
      day: classData.day,
      title: classData.title,
      category: classData.category || "Functional Fitness",
      focus: classData.focus || "",
      intensity: classData.intensity || "High",
      room: classData.room || "Main Rig & Platforms",
      coachName: classData.coachName || "",
      time: classData.time || "",
    });
  }

  async updateClass(classId, updates) {
    const existing = await batchRepository.findClassById(classId);
    if (!existing) {
      throw new NotFoundError(`Class "${classId}" not found.`);
    }
    return batchRepository.updateClassById(classId, updates);
  }

  async deleteClass(classId) {
    const existing = await batchRepository.findClassById(classId);
    if (!existing) {
      throw new NotFoundError(`Class "${classId}" not found.`);
    }
    await batchRepository.deleteClassById(classId);
    return { id: classId, deleted: true };
  }

  // ─── Month-Wise Category Tracking ───────────────────────────────────────────
  async getBatchMonthTracking(batchId, yearMonth) {
    return getBatchMonthTracking(this, batchId, yearMonth);
  }
}

module.exports = new BatchService();
