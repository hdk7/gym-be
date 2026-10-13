"use strict";

const Batch = require("../batches/batch.model");
const ClassProgram = require("./class.model");
const Session = require("../schedules/session.model");
const Holiday = require("../schedules/holiday.model");
const ScheduleHistory = require("./scheduleHistory.model");
const { generateScheduleHistoryId } = require("../../shared/idGenerator");
const { NotFoundError, BadRequestError } = require("../../shared/apiError");
const { SCHEDULE_CHANGE_ACTION, SESSION_STATUS } = require("../../shared/constants");

/**
 * Helper to generate sequential session dates based on batch daysList and holidays.
 */
async function generateBatchDates(batch, startDateStr, count = 12) {
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  
  // Resolve scheduled operating days for this batch
  let scheduledDays = Array.isArray(batch.daysList) && batch.daysList.length > 0
    ? batch.daysList
    : [];

  if (scheduledDays.length === 0) {
    if (batch.daysPattern === "TTS") {
      scheduledDays = ["Tuesday", "Thursday", "Saturday"];
    } else if (batch.daysPattern === "MWF") {
      scheduledDays = ["Monday", "Wednesday", "Friday"];
    } else {
      scheduledDays = ["Monday", "Wednesday", "Friday"];
    }
  }

  const daysLower = scheduledDays.map((d) => d.toLowerCase());

  let start = startDateStr ? new Date(startDateStr) : new Date();
  if (isNaN(start.getTime())) start = new Date();
  start.setHours(0, 0, 0, 0);

  // Look up active holidays in range (next 120 days)
  const maxRangeEnd = new Date(start);
  maxRangeEnd.setDate(maxRangeEnd.getDate() + 180);
  const startIso = start.toISOString().slice(0, 10);
  const endIso = maxRangeEnd.toISOString().slice(0, 10);

  const holidays = await Holiday.find({
    date: { $gte: startIso, $lte: endIso },
    isDeleted: false,
    status: "Active",
  }).lean();
  const holidayDates = new Set(holidays.map((h) => h.date));

  const resultDates = [];
  let currentDate = new Date(start);
  let safety = 0;

  while (resultDates.length < count && safety < 180) {
    const dayName = dayNames[currentDate.getDay()];
    const yyyy = currentDate.getFullYear();
    const mm = String(currentDate.getMonth() + 1).padStart(2, "0");
    const dd = String(currentDate.getDate()).padStart(2, "0");
    const dateStr = `${yyyy}-${mm}-${dd}`;

    if (daysLower.includes(dayName.toLowerCase()) && !holidayDates.has(dateStr)) {
      resultDates.push({
        date: dateStr,
        dayOfWeek: dayName,
        displayDate: currentDate.toLocaleDateString("en-US", {
          weekday: "short",
          month: "short",
          day: "numeric",
          year: "numeric",
        }),
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
    safety++;
  }

  return resultDates;
}

class BatchScheduleService {
  /**
   * 1. Multi-Class Batch Assignment & Calendar Generation Engine
   * Maps an ordered array of classIds to the batch's scheduled operating dates and days.
   */
  async assignClassesToBatch({
    batchId,
    classIds = [],
    startDate = new Date().toISOString().slice(0, 10),
    overrideExisting = false,
    coachId,
    performedBy = "Admin",
    reason = "",
  }) {
    if (!batchId) throw new BadRequestError("batchId is required.");
    if (!Array.isArray(classIds) || classIds.length === 0) {
      throw new BadRequestError("At least one classId must be provided for batch assignment.");
    }

    const batch = await Batch.findOne({ id: batchId }).lean();
    if (!batch) throw new NotFoundError(`Batch "${batchId}" not found.`);

    // Fetch the reusable class definitions
    const classes = await ClassProgram.find({
      id: { $in: classIds },
      isDeleted: false,
    }).lean();

    const classMap = new Map(classes.map((c) => [c.id, c]));

    // Preserve exact selection sequence provided by the caller
    const orderedClasses = [];
    for (const cid of classIds) {
      const found = classMap.get(cid);
      if (!found) {
        throw new BadRequestError(`Class "${cid}" does not exist or has been deleted.`);
      }
      orderedClasses.push(found);
    }

    // Generate date sequence matching batch days (1 class per day)
    const dates = await generateBatchDates(batch, startDate, orderedClasses.length);
    const targetDates = dates.map((d) => d.date);

    // Enforce strictly one class per day: purge any existing sessions on the target dates for this batch
    if (overrideExisting) {
      await Session.deleteMany({
        batchId,
        sessionDate: { $gte: startDate },
        status: { $in: [SESSION_STATUS.SCHEDULED] },
        attendedCount: 0,
      });
    } else {
      await Session.deleteMany({
        batchId,
        sessionDate: { $in: targetDates },
        status: { $in: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.TODAY] },
        attendedCount: 0,
      });
    }

    const createdSessions = [];
    const todayStr = new Date().toISOString().slice(0, 10);
    const resolvedCoachId = coachId || (batch.trainerIds && batch.trainerIds[0]) || "TRN-101";

    for (let i = 0; i < orderedClasses.length; i++) {
      const cls = orderedClasses[i];
      const slot = dates[i];
      const timestamp = Date.now().toString().slice(-6);
      const rand = Math.floor(100 + Math.random() * 900);
      const sessionId = `SES-${timestamp}${rand}-${i + 1}`;

      const sessionStatus = slot.date === todayStr ? SESSION_STATUS.TODAY : SESSION_STATUS.SCHEDULED;

      const sessionDoc = await Session.findOneAndUpdate(
        { batchId, sessionDate: slot.date },
        {
          $set: {
            id: sessionId,
            batchId: batch.id,
            batchName: batch.name,
            classId: cls.id,
            className: cls.name,
            subject: cls.name,
            message: `Beginner: ${cls.beginnerWorkouts}\nIntermediate: ${cls.intermediateWorkouts}`,
            beginnerWorkouts: cls.beginnerWorkouts,
            intermediateWorkouts: cls.intermediateWorkouts,
            classNumber: i + 1,
            weekNumber: Math.floor(i / (batch.daysList?.length || 3)) + 1,
            dayOfWeek: slot.dayOfWeek,
            sessionDate: slot.date,
            displayDate: slot.displayDate,
            startTime: batch.startTime || "06:00 AM",
            endTime: batch.endTime || "07:00 AM",
            timing: batch.timingLabel || `${batch.startTime} - ${batch.endTime}`,
            coachId: resolvedCoachId,
            coachName: batch.coachName || "Assigned Floor Coach",
            status: sessionStatus,
          },
        },
        { upsert: true, returnDocument: "after", setDefaultsOnInsert: true }
      );

      createdSessions.push(sessionDoc);
    }

    // Record audit trail in ScheduleHistory
    await ScheduleHistory.create({
      id: generateScheduleHistoryId(),
      batchId: batch.id,
      action: SCHEDULE_CHANGE_ACTION.ASSIGN_CLASSES,
      description: `Assigned ${orderedClasses.length} reusable classes starting from ${startDate}`,
      changeDetails: {
        startDate,
        totalClasses: orderedClasses.length,
        classes: orderedClasses.map((c, idx) => ({
          classId: c.id,
          name: c.name,
          date: dates[idx]?.date,
          day: dates[idx]?.dayOfWeek,
        })),
      },
      performedBy,
      reason: reason || "Batch class curriculum assignment",
    });

    return {
      batchId: batch.id,
      batchName: batch.name,
      assignedCount: createdSessions.length,
      sessions: createdSessions,
    };
  }

  /**
   * 2. Shuffle & Interchange Option
   * Interchanges class assignments between scheduled dates and days within a batch.
   * e.g., swapping Monday's class with Wednesday's class.
   */
  async shuffleClasses({
    batchId,
    mode = "SWAP",
    sourceSessionId,
    targetSessionId,
    startDate,
    endDate,
    performedBy = "Admin",
    reason = "",
  }) {
    if (!batchId) throw new BadRequestError("batchId is required.");

    const batch = await Batch.findOne({ id: batchId }).lean();
    if (!batch) throw new NotFoundError(`Batch "${batchId}" not found.`);

    if (mode === "SWAP") {
      if (!sourceSessionId || !targetSessionId) {
        throw new BadRequestError("Both sourceSessionId and targetSessionId are required for SWAP mode.");
      }

      const sourceSession = await Session.findOne({ id: sourceSessionId, batchId });
      const targetSession = await Session.findOne({ id: targetSessionId, batchId });

      if (!sourceSession) {
        throw new NotFoundError(`Source session "${sourceSessionId}" not found in batch "${batchId}".`);
      }
      if (!targetSession) {
        throw new NotFoundError(`Target session "${targetSessionId}" not found in batch "${batchId}".`);
      }

      // Protection: Cannot swap past completed sessions or sessions with attendance
      if (sourceSession.status === SESSION_STATUS.COMPLETED || sourceSession.attendedCount > 0) {
        throw new BadRequestError(`Cannot swap session on ${sourceSession.sessionDate}: class is already completed.`);
      }
      if (targetSession.status === SESSION_STATUS.COMPLETED || targetSession.attendedCount > 0) {
        throw new BadRequestError(`Cannot swap session on ${targetSession.sessionDate}: class is already completed.`);
      }

      // Capture before-swap details for history
      const beforeSource = {
        sessionId: sourceSession.id,
        date: sourceSession.sessionDate,
        day: sourceSession.dayOfWeek,
        classId: sourceSession.classId,
        className: sourceSession.className || sourceSession.subject,
      };
      const beforeTarget = {
        sessionId: targetSession.id,
        date: targetSession.sessionDate,
        day: targetSession.dayOfWeek,
        classId: targetSession.classId,
        className: targetSession.className || targetSession.subject,
      };

      // Atomic swap of class payload
      const tempClass = {
        classId: sourceSession.classId,
        className: sourceSession.className,
        subject: sourceSession.subject,
        message: sourceSession.message,
        beginnerWorkouts: sourceSession.beginnerWorkouts,
        intermediateWorkouts: sourceSession.intermediateWorkouts,
      };

      sourceSession.classId = targetSession.classId;
      sourceSession.className = targetSession.className;
      sourceSession.subject = targetSession.subject;
      sourceSession.message = targetSession.message;
      sourceSession.beginnerWorkouts = targetSession.beginnerWorkouts;
      sourceSession.intermediateWorkouts = targetSession.intermediateWorkouts;

      targetSession.classId = tempClass.classId;
      targetSession.className = tempClass.className;
      targetSession.subject = tempClass.subject;
      targetSession.message = tempClass.message;
      targetSession.beginnerWorkouts = tempClass.beginnerWorkouts;
      targetSession.intermediateWorkouts = tempClass.intermediateWorkouts;

      await sourceSession.save();
      await targetSession.save();

      // Log in ScheduleHistory
      await ScheduleHistory.create({
        id: generateScheduleHistoryId(),
        batchId: batch.id,
        action: SCHEDULE_CHANGE_ACTION.SWAP_DATES,
        description: `Swapped ${beforeSource.day}'s class (${beforeSource.className}) on ${beforeSource.date} with ${beforeTarget.day}'s class (${beforeTarget.className}) on ${beforeTarget.date}`,
        changeDetails: {
          swappedFrom: beforeSource,
          swappedTo: beforeTarget,
        },
        performedBy,
        reason: reason || "User requested schedule interchange",
      });

      return {
        message: `Successfully swapped ${beforeSource.day} with ${beforeTarget.day}`,
        sourceSession: sourceSession.toObject(),
        targetSession: targetSession.toObject(),
      };
    }

    if (mode === "SHUFFLE_RANGE") {
      const filter = {
        batchId,
        status: { $in: [SESSION_STATUS.SCHEDULED, SESSION_STATUS.TODAY] },
        attendedCount: 0,
      };
      if (startDate) filter.sessionDate = { ...filter.sessionDate, $gte: startDate };
      if (endDate) filter.sessionDate = { ...filter.sessionDate, $lte: endDate };

      const sessions = await Session.find(filter).sort({ sessionDate: 1 });
      if (sessions.length < 2) {
        throw new BadRequestError("Need at least 2 scheduled sessions to perform a shuffle.");
      }

      // Collect current class payloads
      const payloads = sessions.map((s) => ({
        classId: s.classId,
        className: s.className,
        subject: s.subject,
        message: s.message,
        beginnerWorkouts: s.beginnerWorkouts,
        intermediateWorkouts: s.intermediateWorkouts,
      }));

      // Fisher-Yates shuffle
      for (let i = payloads.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [payloads[i], payloads[j]] = [payloads[j], payloads[i]];
      }

      // Apply shuffled payloads
      for (let i = 0; i < sessions.length; i++) {
        Object.assign(sessions[i], payloads[i]);
        await sessions[i].save();
      }

      await ScheduleHistory.create({
        id: generateScheduleHistoryId(),
        batchId: batch.id,
        action: SCHEDULE_CHANGE_ACTION.REORDER,
        description: `Shuffled ${sessions.length} upcoming classes across dates`,
        changeDetails: {
          sessionCount: sessions.length,
          startDate: sessions[0].sessionDate,
          endDate: sessions[sessions.length - 1].sessionDate,
        },
        performedBy,
        reason: reason || "Auto-shuffle upcoming classes",
      });

      return {
        message: `Successfully shuffled ${sessions.length} scheduled classes.`,
        shuffledCount: sessions.length,
      };
    }

    throw new BadRequestError(`Unsupported shuffle mode: "${mode}". Valid modes: SWAP, SHUFFLE_RANGE.`);
  }

  /**
   * 3. Batch-wise, Date-wise, Day-wise & Month-wise Retrieval
   */
  async getBatchSchedule(batchId, { month, status, date, dayOfWeek, page = 1, limit = 50 } = {}) {
    const batch = await Batch.findOne({ id: batchId }).lean();
    if (!batch) throw new NotFoundError(`Batch "${batchId}" not found.`);

    const filter = { batchId };
    if (month && /^\d{4}-\d{2}$/.test(month)) {
      filter.sessionDate = { $regex: `^${month}` };
    }
    if (status && status !== "ALL" && status !== "All") {
      filter.status = status;
    }
    if (date) {
      filter.sessionDate = date;
    }
    if (dayOfWeek) {
      filter.dayOfWeek = dayOfWeek;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const sessions = await Session.find(filter)
      .sort({ sessionDate: 1, startTime: 1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    const total = await Session.countDocuments(filter);

    // Month summary metrics
    const allBatchSessions = await Session.find({ batchId }).lean();
    const scheduledCount = allBatchSessions.filter((s) => s.status === SESSION_STATUS.SCHEDULED).length;
    const completedCount = allBatchSessions.filter((s) => s.status === SESSION_STATUS.COMPLETED).length;
    const todayCount = allBatchSessions.filter((s) => s.status === SESSION_STATUS.TODAY).length;

    return {
      batch: {
        id: batch.id,
        name: batch.name,
        daysPattern: batch.daysPattern,
        daysLabel: batch.daysLabel,
        daysList: batch.daysList || [],
        timingLabel: batch.timingLabel,
      },
      summary: {
        totalSessions: allBatchSessions.length,
        scheduled: scheduledCount,
        completed: completedCount,
        today: todayCount,
      },
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        totalPages: Math.ceil(total / Number(limit)) || 1,
      },
      sessions,
    };
  }

  /**
   * 4. Complete Audit History of Schedule Changes
   */
  async getBatchScheduleHistory(batchId, limit = 50) {
    const batch = await Batch.findOne({ id: batchId }).lean();
    if (!batch) throw new NotFoundError(`Batch "${batchId}" not found.`);

    return ScheduleHistory.find({ batchId })
      .sort({ createdAt: -1 })
      .limit(Number(limit))
      .lean();
  }
}

module.exports = new BatchScheduleService();
