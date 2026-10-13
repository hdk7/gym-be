"use strict";

const classRepository = require("./class.repository");
const { generateClassId } = require("../../shared/idGenerator");
const { NotFoundError, ConflictError, BadRequestError } = require("../../shared/apiError");
const { CLASS_STATUS } = require("../../shared/constants");
const Session = require("../schedules/session.model");

class ClassService {
  async getAllClasses({ search, status, page = 1, limit = 50 } = {}) {
    const filter = {};
    if (status && status !== "ALL" && status !== "All") {
      filter.status = status;
    }
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { name: regex },
        { beginnerWorkouts: regex },
        { intermediateWorkouts: regex },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [classes, total] = await Promise.all([
      classRepository.findAll({ filter, skip, limit: Number(limit) }),
      classRepository.count(filter),
    ]);

    return {
      classes,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
    };
  }

  async getClassById(id) {
    const cls = await classRepository.findById(id);
    if (!cls) throw new NotFoundError(`Class "${id}" not found.`);

    // Active session usage count
    const activeSessionsCount = await classRepository.countActiveUpcomingSessions(id);

    return {
      ...cls,
      activeSessionsCount,
    };
  }

  async createClass(body) {
    const name = body.name?.trim();
    if (!name) throw new BadRequestError("Class Program Name is required.");

    const existing = await classRepository.findByName(name);
    if (existing) {
      throw new ConflictError(`A Class Program with the name "${name}" already exists.`);
    }

    const maxSuffix = await classRepository.getMaxNumericSuffix();
    const id = generateClassId(maxSuffix);

    const newClass = await classRepository.create({
      id,
      name,
      beginnerWorkouts: body.beginnerWorkouts?.trim() || "Not specified",
      intermediateWorkouts: body.intermediateWorkouts?.trim() || "Not specified",
      workouts: Array.isArray(body.workouts) ? body.workouts : [],
      status: CLASS_STATUS.ACTIVE,
      isDeleted: false,
    });

    return newClass.toObject();
  }

  async updateClass(id, body) {
    const cls = await classRepository.findById(id);
    if (!cls) throw new NotFoundError(`Class "${id}" not found.`);

    const updateData = {};
    if (body.name !== undefined) {
      const trimmedName = body.name.trim();
      if (!trimmedName) throw new BadRequestError("Class Program Name cannot be empty.");
      if (trimmedName.toLowerCase() !== cls.name.toLowerCase()) {
        const existing = await classRepository.findByName(trimmedName);
        if (existing && existing.id !== id) {
          throw new ConflictError(`A Class Program with the name "${trimmedName}" already exists.`);
        }
      }
      updateData.name = trimmedName;
    }

    if (body.beginnerWorkouts !== undefined) {
      updateData.beginnerWorkouts = body.beginnerWorkouts.trim() || "Not specified";
    }
    if (body.intermediateWorkouts !== undefined) {
      updateData.intermediateWorkouts = body.intermediateWorkouts.trim() || "Not specified";
    }
    if (body.workouts !== undefined) {
      updateData.workouts = Array.isArray(body.workouts) ? body.workouts : [];
    }
    if (body.status !== undefined) {
      updateData.status = body.status;
    }

    const updated = await classRepository.update(id, updateData);

    // Sync updated class details across all sessions referencing this class
    const sessionUpdates = {};
    if (updated.name) {
      sessionUpdates.className = updated.name;
      sessionUpdates.subject = updated.name;
    }
    if (updated.beginnerWorkouts !== undefined) {
      sessionUpdates.beginnerWorkouts = updated.beginnerWorkouts;
    }
    if (updated.intermediateWorkouts !== undefined) {
      sessionUpdates.intermediateWorkouts = updated.intermediateWorkouts;
    }
    if (updated.beginnerWorkouts || updated.intermediateWorkouts) {
      sessionUpdates.message = `Beginner: ${updated.beginnerWorkouts || "Not specified"}\nIntermediate: ${updated.intermediateWorkouts || "Not specified"}`;
    }

    if (Object.keys(sessionUpdates).length > 0) {
      await Session.updateMany(
        { $or: [{ classId: id }, { className: cls.name }, { subject: cls.name }] },
        { $set: sessionUpdates }
      );
      try {
        const ScheduleItem = require("../schedules/schedule-item.model");
        await ScheduleItem.updateMany(
          { $or: [{ classId: id }, { subject: cls.name }] },
          { $set: { subject: updated.name, message: sessionUpdates.message || "" } }
        );
      } catch (_) {
        // ScheduleItem update optional if model not present
      }
    }

    return updated;
  }

  async deleteClass(id) {
    const cls = await classRepository.findById(id);
    if (!cls) throw new NotFoundError(`Class "${id}" not found.`);

    const activeSessions = await classRepository.countActiveUpcomingSessions(id);
    if (activeSessions > 0) {
      throw new BadRequestError(
        `Cannot delete class "${cls.name}": it is currently assigned to ${activeSessions} active/upcoming scheduled session(s). Unassign or replace them first.`
      );
    }

    return classRepository.softDelete(id);
  }

  /**
   * Cross-batch calendar view: returns sessions across all batches or filtered by date/month.
   */
  async getCalendarView({ date, month, dayOfWeek, batchId } = {}) {
    const filter = {};
    if (batchId) filter.batchId = batchId;
    if (date) filter.sessionDate = date;
    if (dayOfWeek) filter.dayOfWeek = dayOfWeek;
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      filter.sessionDate = { $regex: `^${month}` };
    }

    const sessions = await Session.find(filter)
      .sort({ sessionDate: 1, startTime: 1 })
      .lean();

    return sessions;
  }
}

module.exports = new ClassService();
