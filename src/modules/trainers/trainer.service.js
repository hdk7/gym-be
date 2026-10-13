"use strict";

const trainerRepository = require("./trainer.repository");
const batchService = require("../batches/batch.service");
const { generateTrainerId } = require("../../shared/idGenerator");
const { NotFoundError, ConflictError } = require("../../shared/apiError");
const { TRAINER_STATUS } = require("../../shared/constants");

class TrainerService {
  async getAll({ page = 1, pageSize = 50, skip = 0, status, search = "", includeDeleted = false } = {}) {
    const filter = {};

    if (!includeDeleted) {
      filter.isDeleted = false;
    }

    if (status && status !== "All") {
      filter.status = status;
    }

    if (search && search.trim() !== "") {
      const clean = search.trim();
      filter.$or = [
        { name: { $regex: clean, $options: "i" } },
        { email: { $regex: clean, $options: "i" } },
        { phone: { $regex: clean, $options: "i" } },
        { id: { $regex: clean, $options: "i" } },
      ];
    }

    return trainerRepository.findAll({ filter, skip, limit: pageSize });
  }

  async getById(id) {
    const trainer = await trainerRepository.findById(id);
    if (!trainer) {
      throw new NotFoundError(`Trainer with ID "${id}" not found.`);
    }
    return trainer;
  }

  async create(body) {
    // 1. Uniqueness check
    const existingEmail = await trainerRepository.findByEmail(body.email);
    if (existingEmail) {
      throw new ConflictError(`A trainer with email "${body.email}" already exists.`);
    }

    // 2. Generate sequential ID TRN-XXX
    const maxSuffix = await trainerRepository.getMaxIdSuffix();
    const id = body.id || generateTrainerId(maxSuffix);

    // 3. Normalize array fields
    const certifications = this._normalizeArray(body.certifications);
    const programs = this._normalizeArray(body.programs);
    const batchIds = Array.isArray(body.batchIds) ? body.batchIds : [];

    const newTrainer = {
      id,
      name: body.name.trim(),
      gender: body.gender || "Male",
      experience: body.experience.trim(),
      phone: body.phone.trim(),
      email: body.email.toLowerCase().trim(),
      specialization: body.specialization ? body.specialization.trim() : "Faculty Coach",
        shift: body.shift || "General (06:00 - 14:00)",
      status: body.status || TRAINER_STATUS.ACTIVE,
      isDeleted: false,
      deletedAt: null,
      bio: body.bio.trim(),
      quote: body.quote || "",
      photo: body.photo || null,
      certifications,
      programs,
      stats: body.stats || {
        clients: "50+",
        successRate: "98%",
        hours: "300+",
      },
      batchIds,
      joinedAt: body.joinedAt ? new Date(body.joinedAt) : new Date(),
    };

    const saved = await trainerRepository.create(newTrainer);

    // Link trainer to batches if batchIds specified
    if (batchIds.length > 0) {
      for (const batchId of batchIds) {
        try {
          const batch = await batchService.getById(batchId);
          if (batch && !batch.trainerIds.includes(id)) {
            await batchService.syncTrainers(batchId, [...batch.trainerIds, id]);
          }
        } catch (e) {
          // Non-fatal batch linking
        }
      }
    }

    return saved;
  }

  async update(id, body) {
    const existing = await this.getById(id);

    if (body.email && body.email.toLowerCase().trim() !== existing.email) {
      const emailConflict = await trainerRepository.findByEmail(body.email);
      if (emailConflict && emailConflict.id !== id) {
        throw new ConflictError(`Email "${body.email}" is already used by another trainer.`);
      }
    }

    const updates = { ...body };

    if (body.certifications !== undefined) {
      updates.certifications = this._normalizeArray(body.certifications);
    }
    if (body.programs !== undefined) {
      updates.programs = this._normalizeArray(body.programs);
    }
    if (body.email) {
      updates.email = body.email.toLowerCase().trim();
    }

    const updated = await trainerRepository.updateById(id, updates);

    // Sync batches if batchIds updated
    if (Array.isArray(body.batchIds)) {
      await this.syncBatches(id, body.batchIds);
    }

    return updated;
  }

  async delete(id) {
    const existing = await this.getById(id);
    await trainerRepository.deleteById(id);
    return { id: existing.id, deleted: true };
  }

  async softDelete(id) {
    const existing = await this.getById(id);
    if (existing.isDeleted) {
      throw new ConflictError(`Trainer "${id}" is already inactive/deleted.`);
    }

    return trainerRepository.updateById(id, {
      isDeleted: true,
      deletedAt: new Date(),
      status: TRAINER_STATUS.INACTIVE,
    });
  }

  async restore(id) {
    const existing = await trainerRepository.findById(id);
    if (!existing) {
      throw new NotFoundError(`Trainer with ID "${id}" not found.`);
    }
    if (!existing.isDeleted) {
      throw new ConflictError(`Trainer "${id}" is not deleted.`);
    }

    return trainerRepository.updateById(id, {
      isDeleted: false,
      deletedAt: null,
      status: TRAINER_STATUS.ACTIVE,
    });
  }

  async toggleStatus(id) {
    const existing = await this.getById(id);
    const nextStatus =
      existing.status === TRAINER_STATUS.ACTIVE ? TRAINER_STATUS.INACTIVE : TRAINER_STATUS.ACTIVE;

    return trainerRepository.updateById(id, { status: nextStatus });
  }

  async syncBatches(id, batchIds) {
    await this.getById(id);
    const safeBatchIds = Array.isArray(batchIds) ? batchIds : [];

    const Batch = require("../batches/batch.model");
    if (safeBatchIds.length > 0) {
      await Batch.updateMany(
        { id: { $in: safeBatchIds } },
        { $addToSet: { trainerIds: id } }
      );
    }
    await Batch.updateMany(
      { id: { $nin: safeBatchIds }, trainerIds: id },
      { $pull: { trainerIds: id } }
    );

    return trainerRepository.updateById(id, { batchIds: safeBatchIds });
  }

  _normalizeArray(value) {
    if (Array.isArray(value)) return value.map((s) => String(s).trim()).filter(Boolean);
    if (typeof value === "string") {
      return value
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    }
    return [];
  }

  // ─── Month-Wise Tracking for Individual Trainer ─────────────────────────────
  async getTrainerMonthTracking(id, yearMonth) {
    const trainer = await this.getById(id);
    const ym = yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)
      ? yearMonth
      : new Date().toISOString().slice(0, 7);

    const TrainerLog = require("../attendance/trainerLog.model");
    const Session = require("../schedules/session.model");
    const Batch = require("../batches/batch.model");

    const allBatches = await Batch.find({}).lean();
    const batchMap = new Map(allBatches.map((b) => [b.id, b.name]));

    const allTrainerLogs = await TrainerLog.find({
      $or: [{ trainerId: id }, { substituteTrainerId: id }],
      monthYear: ym,
    }).sort({ date: 1 }).lean();

    const assignedBatches = await Batch.find({
      $or: [{ trainerIds: id }, { id: { $in: trainer.batchIds || [] } }],
    }).lean();

    const scheduledSessions = await Session.find({
      coachId: id,
      sessionDate: { $regex: `^${ym}` },
    }).sort({ sessionDate: 1 }).lean();

    const enrichedLogs = allTrainerLogs.map((log) => ({
      ...log,
      batchName: batchMap.get(log.batchId) || log.batchId,
    }));

    const conductedLogs = enrichedLogs.filter(
      (l) => l.trainerId === id && l.status === "CONDUCTED"
    );
    const totalMinutes = conductedLogs.reduce((sum, l) => sum + (l.durationMinutes || 60), 0);
    const totalAttendeesCoached = conductedLogs.reduce((sum, l) => sum + (l.attendeesCount || 0), 0);

    const substituteLogs = enrichedLogs.filter(
      (l) => l.status === "SUBSTITUTE" || l.substituteTrainerId || l.trainerId !== id
    );

    return {
      trainerId: trainer.id,
      name: trainer.name,
      email: trainer.email,
      phone: trainer.phone,
      photo: trainer.photo || null,
      shift: trainer.shift,
      status: trainer.status,
      monthYear: ym,
      summary: {
        totalBatchesAssigned: assignedBatches.length,
        totalClassesScheduled: scheduledSessions.length,
        totalClassesConducted: conductedLogs.length,
        totalCoachingHours: Math.round((totalMinutes / 60) * 10) / 10,
        totalAttendeesCoached,
        averageClassAttendance: conductedLogs.length > 0
          ? Math.round(totalAttendeesCoached / conductedLogs.length)
          : 0,
      },
      assignedBatches: assignedBatches.map((b) => ({
        id: b.id,
        name: b.name,
        timingLabel: b.timingLabel,
        daysLabel: b.daysLabel,
        currentPax: b.currentPax || 0,
        maxPax: b.maxPax || 25,
      })),
      scheduledSessions,
      trainerLogs: enrichedLogs,
      substituteLogs,
    };
  }
}

module.exports = new TrainerService();

