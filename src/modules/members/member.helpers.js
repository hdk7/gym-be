"use strict";

const {
  generateTransactionId,
  generateReceiptNumber,
} = require("../../shared/idGenerator");
const {
  calculateBmi,
  calculateMembershipDates,
} = require("../../shared/dateUtils");

function buildPhysicalStats(body) {
  const heightStr = body.height
    ? String(body.height).replace(/\s*cm/i, "")
    : "";
  const weightStr = body.weight
    ? String(body.weight).replace(/\s*kg/i, "")
    : "";
  const bmiVal = calculateBmi(heightStr, weightStr);

  return {
    height: heightStr ? `${heightStr} cm` : "",
    weight: weightStr ? `${weightStr} kg` : "",
    bmi: bmiVal ? String(bmiVal) : "",
    bloodGroup: body.bloodGroup || "",
    heightStr,
    weightStr,
  };
}

function buildEmergencyContact(body) {
  const emergencyName = body.emergencyName || body.emergencyContact?.name || "";
  const emergencyPhone =
    body.emergencyPhone ||
    body.emergencyNumber ||
    body.emergencyContact?.phone ||
    "";
  const emergencyRelation =
    body.emergencyRelation ||
    body.emergencyRelationship ||
    body.emergencyContact?.relation ||
    "";

  return {
    name: emergencyName,
    phone: emergencyPhone,
    relation: emergencyRelation,
  };
}

async function resolveMemberPlanAndPayment(body, planService) {
  let membershipPlan = null;
  let paymentDetails = null;
  const planIdToLookup = body.paymentPlanId || body.planId;

  if (planIdToLookup) {
    try {
      const plan = await planService.getById(planIdToLookup);
      if (plan) {
        const startDate = body.paymentDate
          ? new Date(body.paymentDate)
          : new Date();
        const dates = calculateMembershipDates(plan.durationMonths, startDate);
        const amount = Number(
          body.paymentAmount !== undefined ? body.paymentAmount : plan.price,
        );
        const formattedPrice = `₹${amount.toLocaleString("en-IN")}`;

        membershipPlan = {
          id: plan.id,
          name: plan.name,
          durationMonths: plan.durationMonths,
          price: amount,
          formattedPrice,
          startDate: new Date(dates.startDate),
          endDate: new Date(dates.endDate),
          formattedStart: new Date(dates.startDate).toLocaleDateString(
            "en-GB",
            {
              day: "2-digit",
              month: "short",
              year: "numeric",
            },
          ),
          formattedEnd: new Date(dates.endDate).toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          }),
        };

        paymentDetails = {
          method: body.paymentMethod || "UPI",
          amount,
          formattedAmount: formattedPrice,
          transactionId:
            body.transactionId?.trim() ||
            generateTransactionId(body.paymentMethod || "UPI"),
          receiptNo: generateReceiptNumber(),
          status: "Completed",
          paidAt: startDate,
          notes: body.paymentNotes || "",
        };
      }
    } catch {
      // Plan lookup failure is non-fatal for custom membership
    }
  }

  return { membershipPlan, paymentDetails };
}

async function resolveMemberBatchAndSchedule(
  body,
  existingMember,
  batchService,
) {
  let schedule = existingMember ? existingMember.schedule : null;
  let batchId =
    body.batchId !== undefined ? body.batchId : existingMember?.batchId || "";
  let batchName =
    body.batchName !== undefined
      ? body.batchName
      : existingMember?.batchName || "";
  let batchTiming =
    body.batchTiming !== undefined
      ? body.batchTiming
      : existingMember?.batchTiming || "";
  let assignedBatch =
    body.assignedBatch !== undefined
      ? body.assignedBatch
      : existingMember?.assignedBatch || "General Access";

  if (batchId) {
    try {
      const batch = await batchService.getById(batchId);
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
      }
    } catch {
      // Batch lookup fallback
    }
  }

  return { schedule, batchId, batchName, batchTiming, assignedBatch };
}

module.exports = {
  buildPhysicalStats,
  buildEmergencyContact,
  resolveMemberPlanAndPayment,
  resolveMemberBatchAndSchedule,
};
