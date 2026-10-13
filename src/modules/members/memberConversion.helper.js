"use strict";

const { calculateMembershipDates } = require("../../shared/dateUtils");
const { generateTransactionId, generateReceiptNumber } = require("../../shared/idGenerator");
const { MEMBER_STATUS } = require("../../shared/constants");

async function buildMemberConversionPayload({ existing, plan, body, batchService }) {
  const startDate = body.paymentDate ? new Date(body.paymentDate) : new Date();
  const dates = calculateMembershipDates(plan.durationMonths, startDate);
  const amount = Number(body.paymentAmount || plan.price);
  const formattedPrice = `₹${amount.toLocaleString("en-IN")}`;

  const membershipPlan = {
    id: plan.id,
    name: plan.name,
    durationMonths: plan.durationMonths,
    price: amount,
    formattedPrice,
    startDate: new Date(dates.startDate),
    endDate: new Date(dates.endDate),
    formattedStart: new Date(dates.startDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    formattedEnd: new Date(dates.endDate).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
  };

  const paymentDetails = {
    method: body.paymentMethod || "UPI",
    amount,
    formattedAmount: formattedPrice,
    transactionId: body.transactionId?.trim() || generateTransactionId(body.paymentMethod || "UPI"),
    receiptNo: generateReceiptNumber(),
    status: "Completed",
    paidAt: startDate,
    notes: body.paymentNotes || "",
  };

  let schedule = existing.schedule;
  let batchId = body.batchId || existing.batchId;
  let batchName = existing.batchName;
  let batchTiming = existing.batchTiming;
  let assignedBatch = existing.assignedBatch;

  if (body.batchId && body.batchId !== existing.batchId) {
    try {
      const batch = await batchService.getById(body.batchId);
      if (batch) {
        batchName = batch.name;
        batchTiming = batch.timingLabel;
        assignedBatch = batch.name;
        schedule = {
          batchId: batch.id,
          batchName: batch.name,
          batchTiming: batch.timingLabel,
          daysLabel: batch.daysLabel,
          daysPattern: batch.daysPattern,
        };
        await batchService.enrollMember(body.batchId, existing.id).catch(() => null);
      }
    } catch {
      // Fallback
    }
  }

  const currentHistory = Array.isArray(existing.statusHistory) ? existing.statusHistory : [];
  const historyEntry = {
    status: MEMBER_STATUS.ACTIVE,
    changedAt: new Date(),
    changedBy: body.convertedBy || "Admin",
    notes: `Member registration completed and converted to Active with plan ${plan.name}`,
  };

  const payload = {
    status: MEMBER_STATUS.ACTIVE,
    convertedAt: new Date(),
    membershipPlan,
    paymentDetails,
    batchId,
    batchName,
    batchTiming,
    assignedBatch,
    schedule,
    statusHistory: [...currentHistory, historyEntry],
  };

  if (body.photo !== undefined) payload.photo = body.photo;
  if (body.photoName !== undefined) payload.photoName = body.photoName;

  return payload;
}

module.exports = {
  buildMemberConversionPayload,
};
