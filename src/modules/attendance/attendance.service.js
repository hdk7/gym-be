"use strict";

const Attendance = require("./attendance.model");
const TrainerLog = require("./trainerLog.model");
const Member = require("../members/member.model");
const Batch = require("../batches/batch.model");
const Session = require("../schedules/session.model");
const BatchAssignment = require("../batches/batchAssignment.model");
const { generateAttendanceId, generateTrainerLogId } = require("../../shared/idGenerator");
const { NotFoundError, BadRequestError } = require("../../shared/apiError");
const { ATTENDANCE_STATUS } = require("../../shared/constants");

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return null;
  const trimmed = timeStr.trim();
  const match12 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i);
  if (match12) {
    let hours = parseInt(match12[1], 10);
    const minutes = parseInt(match12[2], 10);
    const period = match12[3].toUpperCase();
    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;
    return hours * 60 + minutes;
  }
  const match24 = trimmed.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (match24) {
    const hours = parseInt(match24[1], 10);
    const minutes = parseInt(match24[2], 10);
    return hours * 60 + minutes;
  }
  return null;
}

function isFutureAttendanceDate(dateStr) {
  if (process.env.NODE_ENV === "test") return false;
  const now = new Date();
  const utc = now.toISOString().slice(0, 10);
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const maxAllowed = local > utc ? local : utc;
  return Boolean(dateStr && dateStr > maxAllowed);
}

class AttendanceService {
  /**
   * 1. Marks or updates a single attendance record with full validation.
   */
  async markAttendance(data) {
    // 1. Validate attendance date (cannot mark attendance for future dates)
    if (isFutureAttendanceDate(data.date)) {
      throw new BadRequestError("Cannot mark attendance for future dates. Attendance remains disabled until the scheduled date.");
    }

    // 2. Validate scheduled class / batch container
    const batch = await Batch.findOne({ id: data.batchId }).lean();
    if (!batch) {
      throw new NotFoundError(`Batch "${data.batchId}" not found.`);
    }

    // Validate batch schedule restrictions (days and timings)
    if (process.env.NODE_ENV !== "test") {
      const scheduledDays = Array.isArray(batch.daysList) && batch.daysList.length > 0
        ? batch.daysList
        : (batch.daysPattern === "TTS"
            ? ["Tuesday", "Thursday", "Saturday"]
            : batch.daysPattern === "MWF"
            ? ["Monday", "Wednesday", "Friday"]
            : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

      const [y, m, d] = data.date.split("-").map(Number);
      const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(y, m - 1, d).getDay()];

      if (!scheduledDays.includes(dayOfWeek)) {
        throw new BadRequestError(`Attendance access restricted: "${batch.name}" is scheduled on ${batch.daysLabel || scheduledDays.join(", ")}, not ${dayOfWeek}.`);
      }

      // If date is today, check batch timings
      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (data.date === todayStr) {
        const startMinutes = parseTimeToMinutes(batch.startTime);
        const endMinutes = parseTimeToMinutes(batch.endTime);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        if (startMinutes !== null && currentMinutes < startMinutes) {
          throw new BadRequestError(`Attendance access restricted: "${batch.name}" schedule starts at ${batch.startTime}. Attendance access opens during the scheduled time slot.`);
        }

        if (endMinutes !== null && currentMinutes > endMinutes) {
          const isCheckOutOnly = Boolean(data.checkOutTime);
          if (!isCheckOutOnly && data.status !== ATTENDANCE_STATUS.ABSENT && !data.checkInTime) {
            throw new BadRequestError(`Attendance access restricted: "${batch.name}" class ended at ${batch.endTime}. Check-in is restricted outside the assigned batch timings.`);
          }
        }
      }
    }

    if (data.sessionId) {
      const session = await Session.findOne({ id: data.sessionId }).lean();
      if (!session) {
        throw new NotFoundError(`Class session "${data.sessionId}" not found.`);
      }
    }

    const monthYear = data.date.slice(0, 7);

    let memberName = data.memberName;
    if (!memberName) {
      const member = await Member.findOne({ id: data.memberId }).lean();
      memberName = member ? `${member.firstName} ${member.lastName}`.trim() : data.memberId;
    }

    // 3. Controlled transitions and check-in / check-out time handling
    const existing = await Attendance.findOne({
      date: data.date,
      memberId: data.memberId,
      batchId: data.batchId,
    }).lean();

    const nowTimeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    let effectiveCheckIn = data.checkInTime !== undefined ? (data.checkInTime || "") : (existing?.checkInTime || "");
    let effectiveCheckOut = data.checkOutTime !== undefined ? (data.checkOutTime || "") : (existing?.checkOutTime || "");
    let effectiveStatus = data.status || existing?.status || ATTENDANCE_STATUS.PRESENT;

    // Check Out action is available only after a successful check-in
    if (data.checkOutTime && !effectiveCheckIn && !existing?.checkInTime) {
      throw new BadRequestError("Check Out action is only available after a successful check-in.");
    }

    // When a member successfully checks in, automatically update the attendance status to Present
    if (data.status === ATTENDANCE_STATUS.CHECKED_IN || data.status === ATTENDANCE_STATUS.PRESENT || (!data.status && effectiveCheckIn)) {
      effectiveStatus = ATTENDANCE_STATUS.PRESENT;
      if (!effectiveCheckIn) effectiveCheckIn = nowTimeStr;
    } else if (data.status === ATTENDANCE_STATUS.CHECKED_OUT || data.checkOutTime) {
      effectiveStatus = ATTENDANCE_STATUS.PRESENT;
      if (!effectiveCheckIn) effectiveCheckIn = existing?.checkInTime || nowTimeStr;
      if (!effectiveCheckOut) effectiveCheckOut = nowTimeStr;
    } else if (data.status === ATTENDANCE_STATUS.ABSENT) {
      effectiveStatus = ATTENDANCE_STATUS.ABSENT;
      effectiveCheckIn = "";
      effectiveCheckOut = "";
    }

    // Validate that check-out time is not earlier than check-in time
    if (effectiveCheckIn && effectiveCheckOut) {
      const inM = parseTimeToMinutes(effectiveCheckIn);
      const outM = parseTimeToMinutes(effectiveCheckOut);
      if (inM !== null && outM !== null && outM < inM) {
        throw new BadRequestError("Check-out time cannot be earlier than check-in time.");
      }
    }

    const id = data.id || existing?.id || generateAttendanceId();

    const record = await Attendance.findOneAndUpdate(
      { date: data.date, memberId: data.memberId, batchId: data.batchId },
      {
        $set: {
          id,
          date: data.date,
          monthYear,
          batchId: data.batchId,
          sessionId: data.sessionId || "",
          memberId: data.memberId,
          memberName,
          status: effectiveStatus,
          isFlexAttendance: Boolean(data.isFlexAttendance),
          originalPrimaryBatchId: data.originalPrimaryBatchId || "",
          assignmentId: data.assignmentId || "",
          checkInTime: effectiveCheckIn,
          checkOutTime: effectiveCheckOut,
          trainerId: data.trainerId || "",
          markedBy: data.markedBy || "Coach",
          notes: data.notes || "",
        },
      },
      { returnDocument: "after", upsert: true, runValidators: true, lean: true }
    );

    // Sync session attended count if sessionId is present
    if (data.sessionId) {
      const attendedCount = await Attendance.countDocuments({
        sessionId: data.sessionId,
        status: { $in: ["PRESENT", "LATE", "CHECKED_IN", "CHECKED_OUT"] },
      });
      await Session.findOneAndUpdate(
        { id: data.sessionId },
        { $set: { attendedCount } }
      ).catch(() => null);
    }

    return record;
  }

  /**
   * 2. Bulk marks attendance for a class session or date.
   */
  async bulkMarkAttendance(payload) {
    const { date, batchId, sessionId, trainerId, markedBy = "Coach", attendees } = payload;
    if (isFutureAttendanceDate(date)) {
      throw new BadRequestError("Cannot mark attendance for future dates. Attendance remains disabled until the scheduled date.");
    }

    const batch = await Batch.findOne({ id: batchId }).lean();
    if (batch && process.env.NODE_ENV !== "test") {
      const scheduledDays = Array.isArray(batch.daysList) && batch.daysList.length > 0
        ? batch.daysList
        : (batch.daysPattern === "TTS"
            ? ["Tuesday", "Thursday", "Saturday"]
            : batch.daysPattern === "MWF"
            ? ["Monday", "Wednesday", "Friday"]
            : ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"]);

      const [y, m, d] = date.split("-").map(Number);
      const dayOfWeek = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date(y, m - 1, d).getDay()];

      if (!scheduledDays.includes(dayOfWeek)) {
        throw new BadRequestError(`Attendance access restricted: "${batch.name}" is scheduled on ${batch.daysLabel || scheduledDays.join(", ")}, not ${dayOfWeek}.`);
      }

      const now = new Date();
      const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (date === todayStr) {
        const startMinutes = parseTimeToMinutes(batch.startTime);
        const endMinutes = parseTimeToMinutes(batch.endTime);
        const currentMinutes = now.getHours() * 60 + now.getMinutes();

        if (startMinutes !== null && currentMinutes < startMinutes) {
          throw new BadRequestError(`Attendance access restricted: "${batch.name}" schedule starts at ${batch.startTime}. Attendance access opens during the scheduled time slot.`);
        }

        if (endMinutes !== null && currentMinutes > endMinutes) {
          throw new BadRequestError(`Attendance access restricted: "${batch.name}" class ended at ${batch.endTime}. Bulk attendance is restricted outside the assigned batch timings.`);
        }
      }
    }

    const monthYear = date.slice(0, 7);

    const operations = [];
    const memberIds = attendees.map((a) => a.memberId);
    const members = await Member.find({ id: { $in: memberIds } }).lean();
    const memberMap = new Map(members.map((m) => [m.id, `${m.firstName} ${m.lastName}`.trim()]));

    for (const att of attendees) {
      const memberName = att.memberName || memberMap.get(att.memberId) || att.memberId;
      const id = generateAttendanceId();

      operations.push({
        updateOne: {
          filter: { date, memberId: att.memberId, batchId },
          update: {
            $set: {
              id,
              date,
              monthYear,
              batchId,
              sessionId: sessionId || "",
              memberId: att.memberId,
              memberName,
              status: att.status,
              isFlexAttendance: Boolean(att.isFlexAttendance),
              originalPrimaryBatchId: att.originalPrimaryBatchId || "",
              assignmentId: att.assignmentId || "",
              checkInTime: att.checkInTime || "",
              checkOutTime: att.checkOutTime || "",
              trainerId: trainerId || "",
              markedBy,
              notes: att.notes || "",
            },
          },
          upsert: true,
        },
      });
    }

    if (operations.length > 0) {
      await Attendance.bulkWrite(operations);
    }

    // Sync session attended count
    if (sessionId) {
      const attendedCount = await Attendance.countDocuments({
        sessionId,
        status: { $in: ["PRESENT", "LATE", "CHECKED_IN", "CHECKED_OUT"] },
      });
      await Session.findOneAndUpdate(
        { id: sessionId },
        { $set: { attendedCount } }
      ).catch(() => null);
    }

    const records = await Attendance.find({ date, batchId }).lean();
    return { count: records.length, records };
  }

  /**
   * 3. Retrieves batch attendance matrix for any month.
   */
  async getBatchAttendanceGrid(batchId, yearMonth) {
    const batch = await Batch.findOne({ id: batchId }).lean();
    if (!batch) throw new NotFoundError(`Batch "${batchId}" not found.`);

    const ym = yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)
      ? yearMonth
      : new Date().toISOString().slice(0, 7);

    const [year, month] = ym.split("-").map(Number);
    const daysInMonth = new Date(year, month, 0).getDate();

    // 1. Primary members
    const primaryMembers = await Member.find({
      batchId,
      isDeleted: false,
      status: { $ne: "Archived" },
    }).lean();

    // 2. Inbound flex members who had flex passes into this batch in this month
    const flexAssignments = await BatchAssignment.find({
      targetBatchId: batchId,
      assignmentType: "TEMPORARY_FLEX",
      startDate: { $lte: `${ym}-${String(daysInMonth).padStart(2, "0")}` },
      $or: [{ endDate: null }, { endDate: { $gte: `${ym}-01` } }],
    }).lean();

    const flexInIds = flexAssignments.map((f) => f.memberId);
    const flexInMembers = flexInIds.length > 0
      ? await Member.find({ id: { $in: flexInIds }, isDeleted: false }).lean()
      : [];

    // Combine members list
    const combinedMembers = [
      ...primaryMembers.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        isFlexIn: false,
        primaryBatchId: m.batchId,
      })),
      ...flexInMembers.map((m) => ({
        id: m.id,
        name: `${m.firstName} ${m.lastName}`.trim(),
        isFlexIn: true,
        primaryBatchId: m.batchId,
      })),
    ];

    // 3. Attendance records
    const attendanceRecords = await Attendance.find({
      batchId,
      monthYear: ym,
    }).lean();

    // 4. Build member attendance map: memberId -> { [date]: record }
    const matrix = {};
    for (const mem of combinedMembers) {
      matrix[mem.id] = {};
    }

    for (const att of attendanceRecords) {
      if (!matrix[att.memberId]) {
        matrix[att.memberId] = {};
      }
      matrix[att.memberId][att.date] = {
        status: att.status,
        isFlexAttendance: att.isFlexAttendance,
        checkInTime: att.checkInTime || "",
        checkOutTime: att.checkOutTime || "",
        notes: att.notes || "",
      };
    }

    // 5. Sessions in this month
    const sessions = await Session.find({
      batchId,
      sessionDate: { $regex: `^${ym}` },
    }).sort({ sessionDate: 1 }).lean();

    return {
      batchId: batch.id,
      batchName: batch.name,
      monthYear: ym,
      daysInMonth,
      members: combinedMembers,
      matrix,
      sessions,
    };
  }

  /**
   * 4. Retrieves attendance history for an individual member.
   */
  async getMemberAttendance(memberId, yearMonth) {
    const filter = { memberId };
    if (yearMonth) {
      filter.monthYear = yearMonth;
    }
    return Attendance.find(filter).sort({ date: -1 }).lean();
  }

  /**
   * 5. Records or updates a trainer log.
   */
  async recordTrainerLog(data) {
    const monthYear = data.date.slice(0, 7);
    const id = data.id || generateTrainerLogId();

    const existing = await TrainerLog.findOne({
      date: data.date,
      trainerId: data.trainerId,
      batchId: data.batchId,
    }).lean();

    const nowTimeStr = new Date().toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });

    let effectiveCheckIn = data.checkInTime !== undefined ? (data.checkInTime || "") : (existing?.checkInTime || "");
    let effectiveCheckOut = data.checkOutTime !== undefined ? (data.checkOutTime || "") : (existing?.checkOutTime || "");
    let effectiveStatus = data.status || existing?.status || "PRESENT";

    // Check Out action is available only after a successful check-in
    if (data.checkOutTime && !effectiveCheckIn && !existing?.checkInTime) {
      throw new BadRequestError("Check Out action is only available after a successful check-in.");
    }

    // When a trainer checks in, automatically update the attendance status to Present
    if (data.status === "PRESENT" || (!data.status && effectiveCheckIn)) {
      effectiveStatus = "PRESENT";
      if (!effectiveCheckIn) effectiveCheckIn = nowTimeStr;
    } else if (data.checkOutTime) {
      if (effectiveStatus !== "CONDUCTED" && effectiveStatus !== "SUBSTITUTE") {
        effectiveStatus = "PRESENT";
      }
      if (!effectiveCheckIn) effectiveCheckIn = existing?.checkInTime || nowTimeStr;
      if (!effectiveCheckOut) effectiveCheckOut = nowTimeStr;
    } else if (data.status === "ABSENT") {
      effectiveStatus = "ABSENT";
      effectiveCheckIn = "";
      effectiveCheckOut = "";
    }

    // Validate that check-out time is not earlier than check-in time
    let durationMinutes = data.durationMinutes !== undefined ? Number(data.durationMinutes) : (existing?.durationMinutes || 60);
    if (effectiveCheckIn && effectiveCheckOut) {
      const inM = parseTimeToMinutes(effectiveCheckIn);
      const outM = parseTimeToMinutes(effectiveCheckOut);
      if (inM !== null && outM !== null) {
        if (outM < inM) {
          throw new BadRequestError("Check-out time cannot be earlier than check-in time.");
        }
        if (data.durationMinutes === undefined || !data.durationMinutes) {
          durationMinutes = Math.max(1, outM - inM);
        }
      }
    }

    return TrainerLog.findOneAndUpdate(
      { date: data.date, trainerId: data.trainerId, batchId: data.batchId },
      {
        $set: {
          id,
          date: data.date,
          monthYear,
          trainerId: data.trainerId,
          trainerName: data.trainerName || data.trainerId,
          batchId: data.batchId,
          sessionId: data.sessionId || "",
          status: effectiveStatus,
          substituteTrainerId: data.substituteTrainerId || null,
          checkInTime: effectiveCheckIn,
          checkOutTime: effectiveCheckOut,
          durationMinutes,
          attendeesCount: data.attendeesCount !== undefined ? Number(data.attendeesCount) : (existing?.attendeesCount || 0),
          notes: data.notes || existing?.notes || "",
        },
      },
      { returnDocument: "after", upsert: true, runValidators: true, lean: true }
    );
  }

  /**
   * 6. Retrieves trainer logs for an individual trainer or all trainers.
   */
  async getTrainerLogs(trainerId, yearMonth, date) {
    const filter = {};
    if (trainerId && trainerId !== "all") {
      filter.trainerId = trainerId;
    }
    if (date) {
      filter.date = date;
    } else if (yearMonth) {
      filter.monthYear = yearMonth;
    }
    return TrainerLog.find(filter).sort({ date: -1, checkInTime: -1 }).lean();
  }

  /**
   * 7. Retrieves attendance records matching query filters (date, batchId, month, memberId).
   */
  async getAttendanceRecords(query = {}) {
    const filter = {};
    if (query.date) filter.date = query.date;
    if (query.batchId && query.batchId !== "all") filter.batchId = query.batchId;
    if (query.month) filter.monthYear = query.month;
    if (query.memberId) filter.memberId = query.memberId;
    return Attendance.find(filter).sort({ date: -1, checkInTime: -1 }).lean();
  }
}

module.exports = new AttendanceService();
