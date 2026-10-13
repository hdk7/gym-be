"use strict";

async function getBatchMonthTracking(batchService, batchId, yearMonth) {
  const batch = await batchService.getById(batchId);
  const ym = yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)
    ? yearMonth
    : new Date().toISOString().slice(0, 7);

  const [year, month] = ym.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const startDate = `${ym}-01`;
  const endDate = `${ym}-${String(daysInMonth).padStart(2, "0")}`;

  // Category 1: Assigned Trainers (Primary + Substitute Trainers who conducted sessions in Month M)
  const Trainer = require("../trainers/trainer.model");
  const TrainerLog = require("../attendance/trainerLog.model");
  const trainerIds = Array.isArray(batch.trainerIds) ? batch.trainerIds : [];

  const trainerLogs = await TrainerLog.find({
    batchId,
    monthYear: ym,
  }).lean();

  const loggedTrainerIds = trainerLogs
    .flatMap((l) => [l.trainerId, l.substituteTrainerId])
    .filter(Boolean);

  const allTrainerIds = Array.from(new Set([...trainerIds, ...loggedTrainerIds]));
  const trainersList = allTrainerIds.length > 0
    ? await Trainer.find({ id: { $in: allTrainerIds } }).lean()
    : [];

  const trainersTracking = trainersList.map((trn) => {
    const logs = trainerLogs.filter((l) => l.trainerId === trn.id || l.substituteTrainerId === trn.id);
    const classesConducted = logs.filter((l) => l.status === "CONDUCTED").length;
    const totalHours = logs.reduce((sum, l) => sum + (l.durationMinutes || 60), 0) / 60;
    const isPrimary = trainerIds.includes(trn.id);
    return {
      trainerId: trn.id,
      name: trn.name,
      email: trn.email,
      phone: trn.phone,
      photo: trn.photo,
      shift: trn.shift,
      classesConducted,
      coachingHours: Math.round(totalHours * 10) / 10,
      status: trn.status,
      isPrimaryTrainer: isPrimary,
      isSubstitute: !isPrimary,
    };
  });

  // Category 2: Enrolled Members (Primary + Active Flex Attendees)
  const Member = require("../members/member.model");
  const BatchAssignment = require("./batchAssignment.model");
  const Attendance = require("../attendance/attendance.model");

  // Primary enrolled members
  const primaryMembers = await Member.find({
    batchId,
    isDeleted: false,
    status: { $ne: "Archived" },
  }).lean();

  // Flex-in members active in this month
  const flexAssignments = await BatchAssignment.find({
    targetBatchId: batchId,
    status: "ACTIVE",
    assignmentType: "TEMPORARY_FLEX",
    startDate: { $lte: endDate },
    $or: [{ endDate: null }, { endDate: { $gte: startDate } }],
  }).lean();

  const flexInMemberIds = flexAssignments.map((f) => f.memberId);
  const flexInMembers = flexInMemberIds.length > 0
    ? await Member.find({ id: { $in: flexInMemberIds }, isDeleted: false }).lean()
    : [];

  // Monthly attendance records for this batch in this month
  const monthAttendance = await Attendance.find({
    batchId,
    monthYear: ym,
  }).lean();

  const isAttended = (st) => ["PRESENT", "LATE", "CHECKED_IN", "CHECKED_OUT"].includes(st);

  const primaryMembersTracking = primaryMembers.map((m) => {
    const records = monthAttendance.filter((a) => a.memberId === m.id);
    const presentCount = records.filter((a) => isAttended(a.status)).length;
    const rate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;
    const flexOut = (m.activeFlexAssignments || []).filter((fp) => {
      return (
        fp.status === "ACTIVE" &&
        (!fp.startDate || fp.startDate <= endDate) &&
        (!fp.endDate || fp.endDate >= startDate) &&
        fp.targetBatchId !== batchId
      );
    });

    return {
      memberId: m.id,
      name: `${m.firstName} ${m.lastName}`.trim(),
      email: m.email,
      mobile: m.mobile,
      photo: m.photo || null,
      joinedAt: m.registeredAt,
      status: m.status,
      isPrimary: true,
      attendanceRate: rate,
      presentSessions: presentCount,
      totalLoggedSessions: records.length,
      isFlexOutActive: flexOut.length > 0,
      flexOutDetails: flexOut.map((f) => ({
        targetBatchId: f.targetBatchId,
        targetBatchName: f.targetBatchName,
        selectedDays: f.selectedDays,
      })),
    };
  });

  const flexMembersTracking = flexInMembers.map((m) => {
    const pass = flexAssignments.find((f) => f.memberId === m.id);
    const records = monthAttendance.filter((a) => a.memberId === m.id && a.isFlexAttendance);
    const presentCount = records.filter((a) => isAttended(a.status)).length;
    const rate = records.length > 0 ? Math.round((presentCount / records.length) * 100) : 0;

    return {
      memberId: m.id,
      name: `${m.firstName} ${m.lastName}`.trim(),
      email: m.email,
      mobile: m.mobile,
      photo: m.photo || null,
      joinedAt: m.registeredAt,
      status: m.status,
      isPrimary: false,
      isFlexIn: true,
      primaryBatchId: m.batchId,
      primaryBatchName: m.batchName,
      selectedDays: pass ? pass.selectedDays : [],
      startDate: pass ? pass.startDate : "",
      endDate: pass ? pass.endDate : null,
      attendanceRate: rate,
      presentSessions: presentCount,
      totalLoggedSessions: records.length,
    };
  });

  // Category 3: Scheduled Classes & Sessions in this Month (strictly 1 class per day)
  const Session = require("../schedules/session.model");
  const batchCandidates = [batchId, batchId.toUpperCase(), batchId.toLowerCase()];
  const batchNumMatch = batchId.match(/\d+/);
  if (batchNumMatch) {
    const bn = parseInt(batchNumMatch[0], 10);
    batchCandidates.push(`BATCH-${String(bn).padStart(2, "0")}`);
    batchCandidates.push(`BATCH-${bn}`);
  }
  const rawSessions = await Session.find({
    batchId: { $in: batchCandidates },
    sessionDate: { $regex: `^${ym}` },
  }).sort({ sessionDate: 1, startTime: 1, createdAt: -1 }).lean();

  const sessionByDate = new Map();
  for (const s of rawSessions) {
    const d = s.sessionDate;
    if (!d) continue;
    if (!sessionByDate.has(d)) {
      sessionByDate.set(d, s);
    } else {
      const existing = sessionByDate.get(d);
      if (s.classId && !existing.classId) {
        sessionByDate.set(d, s);
      }
    }
  }
  const sessions = Array.from(sessionByDate.values())
    .sort((a, b) => (a.sessionDate || "").localeCompare(b.sessionDate || ""));

  const completedSessions = sessions.filter((s) => s.status === "COMPLETED").length;
  const scheduledSessions = sessions.filter((s) => s.status === "SCHEDULED").length;
  const todaySessions = sessions.filter((s) => s.status === "TODAY").length;
  const cancelledSessions = sessions.filter((s) => s.status === "CANCELLED").length;

  // Monthly Summary Metrics
  const primaryPax = primaryMembers.length;
  const flexInPax = flexInMembers.length;
  const maxPax = batch.maxPax || 25;
  const occupancyPercent = maxPax > 0 ? Math.min(100, Math.round(((primaryPax + flexInPax) / maxPax) * 100)) : 0;
  const totalPresentRecords = monthAttendance.filter((a) => isAttended(a.status)).length;
  const overallAttendanceRate = monthAttendance.length > 0
    ? Math.round((totalPresentRecords / monthAttendance.length) * 100)
    : 0;

  return {
    batchId: batch.id,
    name: batch.name,
    shortName: batch.shortName,
    timingLabel: batch.timingLabel,
    daysLabel: batch.daysLabel,
    daysList: batch.daysList || [],
    monthYear: ym,
    summary: {
      primaryPax,
      totalPrimaryMembers: primaryPax,
      flexInPax,
      totalFlexInMembers: flexInPax,
      effectiveCapacityPax: primaryPax + flexInPax,
      maxPax,
      occupancyPercent,
      capacityUtilizationRate: occupancyPercent,
      totalTrainers: trainersTracking.length,
      totalSessions: sessions.length,
      classesScheduledInMonth: sessions.length,
      completedSessions,
      classesConductedInMonth: completedSessions,
      scheduledSessions,
      todaySessions,
      cancelledSessions,
      overallAttendanceRate,
    },
    category1_Trainers: trainersTracking,
    category2_Members: {
      primaryMembers: primaryMembersTracking,
      flexInMembers: flexMembersTracking,
      totalEnrolled: primaryPax,
      totalFlex: flexInPax,
    },
    category3_ScheduledClasses: {
      sessions,
      totalCount: sessions.length,
      completedCount: completedSessions,
      scheduledCount: scheduledSessions,
      todayCount: todaySessions,
      cancelledCount: cancelledSessions,
    },
  };
}

module.exports = {
  getBatchMonthTracking,
};
