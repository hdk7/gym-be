"use strict";

const scheduleRepository = require("./schedule.repository");
const { NotFoundError, BadRequestError } = require("../../shared/apiError");

function getLocalDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseTimeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const match = timeStr.trim().match(/^(\d{1,2}):(\d{2})(?:\s*([AaPp][Mm]))?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridian = match[3] ? match[3].toUpperCase() : null;

  if (meridian === "PM" && hours < 12) hours += 12;
  if (meridian === "AM" && hours === 12) hours = 0;

  return hours * 60 + minutes;
}

function hasClassStarted(session, now = new Date()) {
  if (!session) return false;
  const rawDate = session.sessionDate;
  if (!rawDate) return false;

  const sessionDate = typeof rawDate === "string" ? rawDate.slice(0, 10) : "";
  const todayLocal = getLocalDateString(now);

  if (sessionDate < todayLocal) {
    return true;
  }
  if (sessionDate > todayLocal) {
    return false;
  }

  const rawTime =
    session.startTime ||
    (session.timing ? session.timing.split("-")[0].trim() : "");
  if (!rawTime) {
    return true;
  }

  const classMinutes = parseTimeToMinutes(rawTime);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();

  return nowMinutes >= classMinutes;
}

class SessionService {
  async getAllSessions({ scheduleId, batchId, status, date } = {}) {
    const filter = {};
    if (scheduleId) filter.masterScheduleId = scheduleId;
    if (batchId) {
      const candidates = [batchId, batchId.toUpperCase(), batchId.toLowerCase()];
      const numMatch = batchId.match(/\d+/);
      if (numMatch) {
        const n = parseInt(numMatch[0], 10);
        candidates.push(`BATCH-${String(n).padStart(2, "0")}`);
        candidates.push(`BATCH-${n}`);
      }
      filter.batchId = { $in: candidates };
    }
    if (status) filter.status = status;
    if (date) filter.sessionDate = date;

    return scheduleRepository.findAllSessions({ filter });
  }

  async getSessionById(id) {
    const session = await scheduleRepository.findSessionById(id);
    if (!session) {
      throw new NotFoundError(`Session "${id}" not found.`);
    }
    return session;
  }

  async updateSessionStatus(id, newStatus) {
    const session = await scheduleRepository.findSessionById(id);
    if (!session) {
      throw new NotFoundError(`Session "${id}" not found.`);
    }

    if (newStatus === "COMPLETED" && !hasClassStarted(session)) {
      throw new BadRequestError(
        "Cannot mark a future class as Completed before its scheduled date and time."
      );
    }

    return scheduleRepository.updateSessionById(id, { status: newStatus });
  }

  async updateSession(id, updates) {
    const session = await scheduleRepository.findSessionById(id);
    if (!session) {
      throw new NotFoundError(`Session "${id}" not found.`);
    }

    if (updates.status === "COMPLETED" && !hasClassStarted(session)) {
      throw new BadRequestError(
        "Cannot mark a future class as Completed before its scheduled date and time."
      );
    }

    delete updates.id;
    return scheduleRepository.updateSessionById(id, updates);
  }
}

const sessionService = new SessionService();
sessionService.hasClassStarted = hasClassStarted;
sessionService.parseTimeToMinutes = parseTimeToMinutes;
sessionService.getLocalDateString = getLocalDateString;

module.exports = sessionService;
