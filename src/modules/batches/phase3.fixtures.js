"use strict";

const Batch = require("./batch.model");
const Member = require("../members/member.model");
const Trainer = require("../trainers/trainer.model");
const Session = require("../schedules/session.model");
const BatchAssignment = require("./batchAssignment.model");
const Attendance = require("../attendance/attendance.model");
const TrainerLog = require("../attendance/trainerLog.model");

async function cleanupPhase3Fixtures({ batchAId, batchBId, trainer1Id, member1Id, member2Id, sessionId }) {
  await Batch.deleteMany({ id: { $in: [batchAId, batchBId] } });
  await Trainer.deleteMany({ id: trainer1Id });
  await Member.deleteMany({ id: { $in: [member1Id, member2Id] } });
  await Session.deleteMany({ id: sessionId });
  await BatchAssignment.deleteMany({ memberId: { $in: [member1Id, member2Id] } });
  await Attendance.deleteMany({ memberId: { $in: [member1Id, member2Id] } });
  await TrainerLog.deleteMany({ trainerId: trainer1Id });
}

async function seedPhase3Fixtures({
  ts,
  testMonth,
  batchAId,
  batchBId,
  trainer1Id,
  member1Id,
  member2Id,
  sessionId,
}) {
  await cleanupPhase3Fixtures({ batchAId, batchBId, trainer1Id, member1Id, member2Id, sessionId });

  // 1. Seed Trainer
  await Trainer.create({
    id: trainer1Id,
    name: "Marcus Aurelius Coach",
    email: `marcus-${ts}@strengthway.com`,
    phone: "+91 98888 11111",
    experience: "8 years",
    bio: "Master strength coach and functional fitness expert.",
    shift: "Morning",
    status: "Active",
    batchIds: [batchAId],
  });

  // 2. Seed Batch A (Morning MWF)
  await Batch.create({
    id: batchAId,
    name: "Alpha Morning MWF",
    shortName: "Alpha",
    startTime: "06:00 AM",
    endTime: "07:00 AM",
    timingLabel: "06:00 AM - 07:00 AM",
    daysPattern: "MWF",
    daysLabel: "Monday • Wednesday • Friday",
    daysList: ["Monday", "Wednesday", "Friday"],
    maxPax: 20,
    currentPax: 1,
    trainerIds: [trainer1Id],
    memberIds: [member1Id],
    status: "Active",
  });

  // 3. Seed Batch B (Evening MWF)
  await Batch.create({
    id: batchBId,
    name: "Beta Evening MWF",
    shortName: "Beta",
    startTime: "06:00 PM",
    endTime: "07:00 PM",
    timingLabel: "06:00 PM - 07:00 PM",
    daysPattern: "MWF",
    daysLabel: "Monday • Wednesday • Friday",
    daysList: ["Monday", "Wednesday", "Friday"],
    maxPax: 20,
    currentPax: 1,
    trainerIds: [],
    memberIds: [member2Id],
    status: "Active",
  });

  // 4. Seed Member 1 (Primary in Batch A)
  await Member.create({
    id: member1Id,
    firstName: "Bruce",
    lastName: "Wayne",
    email: `bruce-${ts}@wayne.com`,
    mobile: `+91 97777${ts}`,
    gender: "Male",
    dob: "1985-02-19",
    address: "Wayne Manor, 1007 Mountain Drive",
    city: "Gotham",
    state: "New Jersey",
    country: "USA",
    pincode: "10001",
    emergencyName: "Alfred Pennyworth",
    status: "Active",
    batchId: batchAId,
    batchName: "Alpha Morning MWF",
    batchTiming: "06:00 AM - 07:00 AM",
    registeredAt: "2026-01-01",
  });

  // 5. Seed Member 2 (Primary in Batch B, with Flex into Batch A on Wednesdays)
  await Member.create({
    id: member2Id,
    firstName: "Clark",
    lastName: "Kent",
    email: `clark-${ts}@dailyplanet.com`,
    mobile: `+91 96666${ts}`,
    gender: "Male",
    dob: "1988-06-18",
    address: "344 Clinton St, Apt 3B",
    city: "Metropolis",
    state: "New York",
    country: "USA",
    pincode: "10002",
    emergencyName: "Martha Kent",
    status: "Active",
    batchId: batchBId,
    batchName: "Beta Evening MWF",
    batchTiming: "06:00 PM - 07:00 PM",
    registeredAt: "2026-01-01",
    activeFlexAssignments: [
      {
        assignmentId: `ASG-FLEX-${ts}`,
        targetBatchId: batchAId,
        targetBatchName: "Alpha Morning MWF",
        selectedDays: ["Wednesday"],
        startDate: "2026-10-01",
        endDate: "2026-10-31",
        status: "ACTIVE",
        assignedAt: new Date("2026-10-01"),
      },
    ],
  });

  // 6. Seed BatchAssignment for Member 2 flex pass
  await BatchAssignment.create({
    id: `ASG-FLEX-${ts}`,
    memberId: member2Id,
    memberName: "Clark Kent",
    assignmentType: "TEMPORARY_FLEX",
    sourceBatchId: batchBId,
    sourceBatchName: "Beta Evening MWF",
    targetBatchId: batchAId,
    targetBatchName: "Alpha Morning MWF",
    selectedDays: ["Wednesday"],
    startDate: "2026-10-01",
    endDate: "2026-10-31",
    status: "ACTIVE",
    reason: "Flexible Wednesday Morning Sessions",
  });

  // 7. Seed Scheduled Class Session in Batch A
  await Session.create({
    id: sessionId,
    masterScheduleId: `SCH-MASTER-${ts}`,
    masterScheduleName: "Standard Curriculum",
    sessionDate: "2026-10-07",
    dayOfWeek: "Wednesday",
    classNumber: 1,
    startTime: "06:00 AM",
    endTime: "07:00 AM",
    batchId: batchAId,
    batchName: "Alpha Morning MWF",
    coachId: trainer1Id,
    coachName: "Marcus Aurelius Coach",
    className: "Barbell Foundations",
    category: "Strength",
    status: "COMPLETED",
    room: "Platform 1",
    capacity: 20,
    attendedCount: 2,
  });

  // 8. Seed Attendance Records for October 7 (Wednesday)
  await Attendance.create({
    id: `ATT-1-${ts}`,
    date: "2026-10-07",
    monthYear: testMonth,
    batchId: batchAId,
    sessionId: sessionId,
    memberId: member1Id,
    memberName: "Bruce Wayne",
    status: "PRESENT",
    isFlexAttendance: false,
    originalPrimaryBatchId: batchAId,
    checkInTime: "05:58 AM",
    trainerId: trainer1Id,
    markedBy: "Marcus Aurelius Coach",
  });

  await Attendance.create({
    id: `ATT-2-${ts}`,
    date: "2026-10-07",
    monthYear: testMonth,
    batchId: batchAId,
    sessionId: sessionId,
    memberId: member2Id,
    memberName: "Clark Kent",
    status: "PRESENT",
    isFlexAttendance: true,
    originalPrimaryBatchId: batchBId,
    assignmentId: `ASG-FLEX-${ts}`,
    checkInTime: "06:02 AM",
    trainerId: trainer1Id,
    markedBy: "Marcus Aurelius Coach",
  });

  // 9. Seed Trainer Log for Trainer 1
  await TrainerLog.create({
    id: `TLOG-1-${ts}`,
    date: "2026-10-07",
    monthYear: testMonth,
    trainerId: trainer1Id,
    trainerName: "Marcus Aurelius Coach",
    batchId: batchAId,
    sessionId: sessionId,
    status: "CONDUCTED",
    durationMinutes: 60,
    attendeesCount: 2,
    notes: "Barbell Foundations session completed smoothly.",
  });
}

module.exports = {
  cleanupPhase3Fixtures,
  seedPhase3Fixtures,
};
