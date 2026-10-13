"use strict";

const scheduleRepository = require("./schedule.repository");
const { NotFoundError, ConflictError, BadRequestError } = require("../../shared/apiError");
const { SCHEDULE_STATUS, SESSION_STATUS } = require("../../shared/constants");
const {
  calculateSequentialMapping,
  createItemsForSchedule,
  generateSessionsForSchedule,
  DEFAULT_12_CLASS_CURRICULUM,
} = require("./schedule.seed");
const holidayService = require("./holiday.service");
const sessionService = require("./session.service");



class ScheduleService {
  // ─── Master Schedules ──────────────────────────────────────────────────────────
  async getAllSchedules({ status, batchId, search, includeDeleted = false } = {}) {
    const filter = {};
    if (!includeDeleted) {
      filter.isDeleted = false;
    }
    if (status && status !== "All") {
      filter.status = status;
    }
    if (batchId) {
      const candidates = [batchId, batchId.toUpperCase(), batchId.toLowerCase()];
      const numMatch = batchId.match(/\d+/);
      if (numMatch) {
        const n = parseInt(numMatch[0], 10);
        candidates.push(`BATCH-${String(n).padStart(2, "0")}`);
        candidates.push(`BATCH-${n}`);
      }
      filter.$or = [{ batchIds: { $in: candidates } }, { batchId: { $in: candidates } }];
    }
    if (search && search.trim()) {
      const q = search.trim();
      const regex = new RegExp(q, "i");
      filter.$or = [
        { name: regex },
        { coachName: regex },
        { batchName: regex },
        { description: regex },
      ];
    }

    return scheduleRepository.findAllSchedules({ filter });
  }

  async getScheduleById(id) {
    const schedule = await scheduleRepository.findScheduleById(id);
    if (!schedule) {
      throw new NotFoundError(`Schedule "${id}" not found.`);
    }
    const items = await scheduleRepository.findItemsByScheduleId(id);
    return { ...schedule, items };
  }

  async createSchedule(body) {
    let id = body.id?.trim();
    if (!id) {
      const timestamp = Date.now().toString().slice(-6);
      const rand = Math.floor(100 + Math.random() * 900);
      id = `SCH-${timestamp}${rand}`;
    }

    const existing = await scheduleRepository.findScheduleById(id);
    if (existing) {
      throw new ConflictError(`Schedule with ID "${id}" already exists.`);
    }

    const batchIds = Array.isArray(body.batchIds)
      ? body.batchIds
      : body.batchId
        ? [body.batchId]
        : [];

    const scheduleData = {
      id,
      name: body.name.trim(),
      batchIds,
      batchId: batchIds[0] || body.batchId || "",
      batchName: body.batchName || (batchIds.length > 0 ? batchIds.join(" • ") : "Reusable Template (Unassigned)"),
      shift: body.shift || "06:00 AM",
      timing: body.timing || `${body.startTime || "06:00 AM"} - ${body.endTime || "07:00 AM"}`,
      startTime: body.startTime || "06:00 AM",
      endTime: body.endTime || "07:00 AM",
      daysPattern: body.daysPattern || "MWF",
      daysLabel: body.daysLabel || "Monday • Wednesday • Friday",
      daysList: Array.isArray(body.daysList) && body.daysList.length > 0
        ? body.daysList
        : ["Monday", "Wednesday", "Friday"],
      coachId: body.coachId || "TRN-101",
      coachName: body.coachName || "Dolliee Ellens",
      totalClasses: Number(body.totalClasses) || 12,
      capacity: Number(body.capacity) || 28,
      status: body.status || SCHEDULE_STATUS.ACTIVE,
      startDate: body.startDate || new Date().toISOString().slice(0, 10),
      description: body.description || "",
    };

    const createdSchedule = await scheduleRepository.createSchedule(scheduleData);

    // Curriculum items
    let itemsToInsert = [];
    if (Array.isArray(body.items)) {
      if (body.items.length > 0) {
        const mapping = calculateSequentialMapping(
          createdSchedule.daysList,
          body.items.length,
          createdSchedule.startDate
        );
        itemsToInsert = body.items.map((item, idx) => {
          const m = mapping[idx] || {};
          return {
            id: item.id || `item_${createdSchedule.id}_${String(item.classNumber || idx + 1).padStart(2, "0")}`,
            masterScheduleId: createdSchedule.id,
            classNumber: item.classNumber || idx + 1,
            weekNumber: item.weekNumber || m.weekNumber || 1,
            dayOfWeek: item.dayOfWeek || m.dayOfWeek || "Monday",
            subject: item.subject || `Class ${idx + 1}`,
            message: item.message || "",
            sessionDate: item.sessionDate || m.date || "",
            displayDate: item.displayDate || m.displayDate || "",
            status: item.status || "ACTIVE",
          };
        });
      } else {
        itemsToInsert = [];
      }
    } else {
      itemsToInsert = createItemsForSchedule(createdSchedule);
    }

    if (itemsToInsert.length > 0) {
      await scheduleRepository.createManyItems(itemsToInsert);
    }

    // Sessions for assigned batches
    const sessions = generateSessionsForSchedule(createdSchedule, itemsToInsert);
    if (sessions.length > 0) {
      await scheduleRepository.createManySessions(sessions);
    }

    return { ...createdSchedule, items: itemsToInsert };
  }

  async updateSchedule(id, updates) {
    const existing = await scheduleRepository.findScheduleById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule "${id}" not found.`);
    }

    const patch = { ...updates };
    if (patch.batchIds && !patch.batchId) {
      patch.batchId = patch.batchIds[0] || "";
    }

    delete patch.id;
    delete patch.items;

    const updated = await scheduleRepository.updateScheduleById(id, patch);

    // If items were passed in, sync items
    if (Array.isArray(updates.items)) {
      await scheduleRepository.deleteItemsByScheduleId(id);
      const mapping = calculateSequentialMapping(
        updated.daysList,
        updates.items.length,
        updated.startDate
      );
      const itemsToInsert = updates.items.map((item, idx) => {
        const m = mapping[idx] || {};
        return {
          id: item.id || `item_${updated.id}_${String(item.classNumber || idx + 1).padStart(2, "0")}`,
          masterScheduleId: updated.id,
          classNumber: item.classNumber || idx + 1,
          weekNumber: item.weekNumber || m.weekNumber || 1,
          dayOfWeek: item.dayOfWeek || m.dayOfWeek || "Monday",
          subject: item.subject || `Class ${idx + 1}`,
          message: item.message || "",
          sessionDate: item.sessionDate || m.date || "",
          displayDate: item.displayDate || m.displayDate || "",
          status: item.status || "ACTIVE",
        };
      });
      await scheduleRepository.createManyItems(itemsToInsert);

      // Re-generate sessions if assigned batches exist
      if (updated.batchIds && updated.batchIds.length > 0) {
        await scheduleRepository.deleteSessionsByScheduleId(id);
        const sessions = generateSessionsForSchedule(updated, itemsToInsert);
        if (sessions.length > 0) {
          await scheduleRepository.createManySessions(sessions);
        }
      }
    }

    const items = await scheduleRepository.findItemsByScheduleId(id);
    return { ...updated, items };
  }

  async deleteSchedule(id) {
    const existing = await scheduleRepository.findScheduleById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule "${id}" not found.`);
    }
    await scheduleRepository.deleteScheduleById(id);
    await scheduleRepository.deleteItemsByScheduleId(id);
    await scheduleRepository.deleteSessionsByScheduleId(id);
    return { id, message: `Schedule "${id}" deleted.` };
  }

  async toggleScheduleStatus(id) {
    const existing = await scheduleRepository.findScheduleById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule "${id}" not found.`);
    }
    const newStatus =
      existing.status === SCHEDULE_STATUS.ACTIVE
        ? SCHEDULE_STATUS.INACTIVE
        : SCHEDULE_STATUS.ACTIVE;

    const updated = await scheduleRepository.updateScheduleById(id, { status: newStatus });
    const items = await scheduleRepository.findItemsByScheduleId(id);
    return { ...updated, items };
  }

  async assignBatches(id, batchIds = []) {
    const existing = await scheduleRepository.findScheduleById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule "${id}" not found.`);
    }

    const cleanBatchIds = Array.isArray(batchIds) ? batchIds : [];
    const batchName = cleanBatchIds.length > 0 ? cleanBatchIds.join(" • ") : "Reusable Template (Unassigned)";

    const updated = await scheduleRepository.updateScheduleById(id, {
      batchIds: cleanBatchIds,
      batchId: cleanBatchIds[0] || "",
      batchName,
    });

    const items = await scheduleRepository.findItemsByScheduleId(id);

    // Sync sessions for assigned batches
    await scheduleRepository.deleteSessionsByScheduleId(id);
    if (cleanBatchIds.length > 0) {
      const sessions = generateSessionsForSchedule(updated, items);
      if (sessions.length > 0) {
        await scheduleRepository.createManySessions(sessions);
      }
    }

    return { ...updated, items };
  }

  async duplicateSchedule(id) {
    const existing = await scheduleRepository.findScheduleById(id);
    if (!existing) {
      throw new NotFoundError(`Schedule "${id}" not found.`);
    }

    const items = await scheduleRepository.findItemsByScheduleId(id);

    const newId = `${existing.id}_copy_${Date.now().toString().slice(-4)}`;
    const clonedScheduleData = {
      ...existing,
      id: newId,
      name: `${existing.name} (Copy)`,
      batchIds: [],
      batchId: "",
      batchName: "Reusable Template (Unassigned)",
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    delete clonedScheduleData._id;

    const clonedSchedule = await scheduleRepository.createSchedule(clonedScheduleData);

    const clonedItems = items.map((item) => ({
      id: `item_${newId}_${String(item.classNumber).padStart(2, "0")}`,
      masterScheduleId: newId,
      classNumber: item.classNumber,
      weekNumber: item.weekNumber,
      dayOfWeek: item.dayOfWeek,
      subject: item.subject,
      message: item.message,
      sessionDate: item.sessionDate,
      displayDate: item.displayDate,
      status: item.status,
    }));

    if (clonedItems.length > 0) {
      await scheduleRepository.createManyItems(clonedItems);
    }

    return { ...clonedSchedule, items: clonedItems };
  }

  async getBatchTrackingSummary(programId) {
    const schedule = await scheduleRepository.findScheduleById(programId);
    if (!schedule) {
      throw new NotFoundError(`Schedule "${programId}" not found.`);
    }

    const assignedBatchIds = Array.isArray(schedule.batchIds) && schedule.batchIds.length > 0
      ? schedule.batchIds
      : schedule.batchId
        ? [schedule.batchId]
        : [];

    const allSessions = await scheduleRepository.findAllSessions({
      filter: { masterScheduleId: programId },
    });

    const now = new Date();
    const todayLocal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    const todayUtc = now.toISOString().slice(0, 10);

    return assignedBatchIds.map((bId) => {
      const batchSessions = allSessions
        .filter((s) => s.batchId === bId)
        .sort((a, b) => a.classNumber - b.classNumber);

      let completed = 0;
      let today = 0;
      let scheduled = 0;
      let cancelled = 0;

      batchSessions.forEach((s) => {
        if (s.status === "CANCELLED") {
          cancelled++;
        } else if (s.status === "COMPLETED") {
          completed++;
        } else if (
          s.status === "TODAY" ||
          s.sessionDate === todayLocal ||
          s.sessionDate === todayUtc
        ) {
          today++;
        } else {
          scheduled++;
        }
      });

      const total = batchSessions.length || schedule.totalClasses || 12;
      const percentComplete = Math.min(100, Math.round((completed / (total || 1)) * 100));

      const nextSession =
        batchSessions.find((s) => s.status === "TODAY") ||
        batchSessions.find((s) => s.status === "SCHEDULED") ||
        null;

      return {
        batchId: bId,
        batchName: schedule.batchName || bId,
        startTime: schedule.startTime || "06:00 AM",
        endTime: schedule.endTime || "07:00 AM",
        timing: schedule.timing || `${schedule.startTime || "06:00 AM"} - ${schedule.endTime || "07:00 AM"}`,
        daysPattern: schedule.daysPattern || "MWF",
        daysLabel: schedule.daysLabel || "Monday • Wednesday • Friday",
        currentPax: 0,
        maxPax: schedule.capacity || 28,
        totalSessions: total,
        completed,
        today,
        scheduled,
        cancelled,
        percentComplete,
        nextSession,
        sessions: batchSessions,
      };
    });
  }

  // ─── Curriculum Items ─────────────────────────────────────────────────────────
  async getScheduleItems(scheduleId) {
    return scheduleRepository.findItemsByScheduleId(scheduleId);
  }

  async addItem(scheduleId, itemData) {
    const schedule = await scheduleRepository.findScheduleById(scheduleId);
    if (!schedule) {
      throw new NotFoundError(`Schedule "${scheduleId}" not found.`);
    }

    const currentItems = await scheduleRepository.findItemsByScheduleId(scheduleId);
    const nextClassNumber = currentItems.length + 1;

    const newItem = {
      id: `item_${scheduleId}_${String(nextClassNumber).padStart(2, "0")}`,
      masterScheduleId: scheduleId,
      classNumber: itemData.classNumber || nextClassNumber,
      weekNumber: itemData.weekNumber || Math.floor((nextClassNumber - 1) / (schedule.daysList?.length || 3)) + 1,
      dayOfWeek: itemData.dayOfWeek || "Monday",
      subject: itemData.subject,
      message: itemData.message || "",
      sessionDate: itemData.sessionDate || "",
      displayDate: itemData.displayDate || `Class ${nextClassNumber}`,
      status: itemData.status || "ACTIVE",
    };

    const saved = await scheduleRepository.createItem(newItem);
    await scheduleRepository.updateScheduleById(scheduleId, { totalClasses: nextClassNumber });
    return saved;
  }

  async updateItem(scheduleId, itemId, updates) {
    const existing = await scheduleRepository.findItemById(itemId);
    if (!existing) {
      throw new NotFoundError(`Curriculum item "${itemId}" not found.`);
    }
    const updated = await scheduleRepository.updateItemById(itemId, updates);

    // Also update any matching sessions that link to this item
    if (
      updates.subject ||
      updates.message !== undefined ||
      updates.beginnerWorkouts !== undefined ||
      updates.intermediateWorkouts !== undefined ||
      updates.className
    ) {
      const sessionUpdates = {};
      if (updates.subject) {
        sessionUpdates.subject = updates.subject;
        sessionUpdates.className = updates.className || updates.subject;
      }
      if (updates.message !== undefined) sessionUpdates.message = updates.message;
      if (updates.beginnerWorkouts !== undefined) sessionUpdates.beginnerWorkouts = updates.beginnerWorkouts;
      if (updates.intermediateWorkouts !== undefined) sessionUpdates.intermediateWorkouts = updates.intermediateWorkouts;

      await scheduleRepository.updateSessionsByFilter(
        { masterScheduleId: scheduleId, classNumber: existing.classNumber },
        sessionUpdates
      );
    }

    return updated;
  }

  async deleteItem(scheduleId, itemId) {
    const existing = await scheduleRepository.findItemById(itemId);
    if (!existing) {
      throw new NotFoundError(`Curriculum item "${itemId}" not found.`);
    }
    await scheduleRepository.deleteItemById(itemId);

    // Re-index remaining items
    const remaining = await scheduleRepository.findItemsByScheduleId(scheduleId);
    for (let i = 0; i < remaining.length; i++) {
      const clsNum = i + 1;
      await scheduleRepository.updateItemById(remaining[i].id, {
        classNumber: clsNum,
      });
    }

    await scheduleRepository.updateScheduleById(scheduleId, { totalClasses: remaining.length });
    return { id: itemId, message: "Item deleted." };
  }

  async updateItemDirect(itemId, updates) {
    const existing = await scheduleRepository.findItemById(itemId);
    if (!existing) {
      throw new NotFoundError(`Curriculum item "${itemId}" not found.`);
    }
    return this.updateItem(existing.masterScheduleId, itemId, updates);
  }

  async deleteItemDirect(itemId) {
    const existing = await scheduleRepository.findItemById(itemId);
    if (!existing) {
      throw new NotFoundError(`Curriculum item "${itemId}" not found.`);
    }
    return this.deleteItem(existing.masterScheduleId, itemId);
  }

  // ─── Sessions (delegated to session.service) ──────────────────────────────────
  async getAllSessions(params) {
    return sessionService.getAllSessions(params);
  }

  async getSessionById(id) {
    return sessionService.getSessionById(id);
  }

  async updateSessionStatus(id, newStatus) {
    return sessionService.updateSessionStatus(id, newStatus);
  }

  async updateSession(id, updates) {
    return sessionService.updateSession(id, updates);
  }


  // ─── Holidays (delegated to holiday.service) ──────────────────────────────────
  async getAllHolidays(params) {
    return holidayService.getAllHolidays(params);
  }

  async getHolidayById(id) {
    return holidayService.getHolidayById(id);
  }

  async createHoliday(body) {
    return holidayService.createHoliday(body);
  }

  async updateHoliday(id, updates) {
    return holidayService.updateHoliday(id, updates);
  }

  async deleteHoliday(id) {
    return holidayService.deleteHoliday(id);
  }
}

module.exports = new ScheduleService();

