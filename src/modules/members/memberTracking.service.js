"use strict";

async function getMemberMonthTracking(member, yearMonth) {
  const ym = yearMonth && /^\d{4}-\d{2}$/.test(yearMonth)
    ? yearMonth
    : new Date().toISOString().slice(0, 7);

  const Attendance = require("../attendance/attendance.model");
  const BatchAssignment = require("../batches/batchAssignment.model");
  const Batch = require("../batches/batch.model");
  let batchInfo = null;
  if (member.batchId) {
    batchInfo = await Batch.findOne({ id: member.batchId }).lean();
  }

  const attendanceRecords = await Attendance.find({
    memberId: member.id,
    monthYear: ym,
  }).sort({ date: 1 }).lean();

  const assignments = await BatchAssignment.find({ memberId: member.id }).sort({ createdAt: -1 }).lean();

  const isAttended = (st) => ["PRESENT", "LATE", "CHECKED_IN", "CHECKED_OUT"].includes(st);
  const presentCount = attendanceRecords.filter((a) => isAttended(a.status)).length;
  const absentCount = attendanceRecords.filter((a) => a.status === "ABSENT").length;
  const excusedCount = attendanceRecords.filter((a) => a.status === "EXCUSED").length;
  const flexPresentCount = attendanceRecords.filter((a) => a.isFlexAttendance && isAttended(a.status)).length;
  const primaryPresentCount = presentCount - flexPresentCount;

  const totalLogged = attendanceRecords.length;
  const attendancePercentage = totalLogged > 0 ? Math.round((presentCount / totalLogged) * 100) : 0;

  return {
    memberId: member.id,
    name: `${member.firstName} ${member.lastName}`.trim(),
    email: member.email,
    mobile: member.mobile,
    photo: member.photo || null,
    status: member.status,
    monthYear: ym,
    primaryBatch: {
      batchId: member.batchId || "",
      batchName: member.batchName || batchInfo?.name || "Unassigned",
      batchTiming: member.batchTiming || batchInfo?.timingLabel || "",
      daysLabel: batchInfo?.daysLabel || batchInfo?.daysPattern || "",
    },
    activeFlexAssignments: member.activeFlexAssignments || [],
    batchHistory: member.batchHistory || [],
    summary: {
      totalLoggedSessions: totalLogged,
      presentCount,
      absentCount,
      excusedCount,
      primaryPresentCount,
      flexPresentCount,
      attendancePercentage,
    },
    attendanceLedger: attendanceRecords,
    assignmentsHistory: assignments,
  };
}

module.exports = {
  getMemberMonthTracking,
};
