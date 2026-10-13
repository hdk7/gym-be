"use strict";

const { ID_PREFIXES } = require("./constants");

/**
 * Human-readable ID generators that produce IDs matching the frontend format:
 *   Members  → MEM-2001, MEM-2002, …
 *   Trainers → TRN-101, TRN-102, …
 *   Batches  → BATCH-01, BATCH-02, …
 *
 * The generators accept the current maximum numeric suffix from the database
 * so they always produce the next available ID without race conditions when
 * called within a single request (the repo's getMaxIdSuffix() is called once
 * per create operation).
 */

// ─── Member ID ────────────────────────────────────────────────────────────────
/**
 * @param {number} currentMax - The highest MEM-XXXX number currently in DB
 * @returns {string} e.g. "MEM-2126"
 */
function generateMemberId(currentMax = 2000) {
  return `${ID_PREFIXES.MEMBER}-${currentMax + 1}`;
}

// ─── Trainer ID ───────────────────────────────────────────────────────────────
/**
 * @param {number} currentMax - The highest TRN-XXX number currently in DB
 * @returns {string} e.g. "TRN-107"
 */
function generateTrainerId(currentMax = 100) {
  return `${ID_PREFIXES.TRAINER}-${currentMax + 1}`;
}

// ─── Batch ID ─────────────────────────────────────────────────────────────────
/**
 * Produces zero-padded IDs: BATCH-01, BATCH-02, … BATCH-12
 * @param {number} currentMax - The highest BATCH-XX number currently in DB
 * @returns {string} e.g. "BATCH-07"
 */
function generateBatchId(currentMax = 0) {
  const num = String(currentMax + 1).padStart(2, "0");
  return `${ID_PREFIXES.BATCH}-${num}`;
}

// ─── Plan ID ──────────────────────────────────────────────────────────────────
/**
 * Plans use a descriptive slug format (e.g. plan-monthly, plan-quarterly).
 * For dynamically created plans, fall back to a timestamp-based slug.
 * @param {string} name - Human-readable plan name (e.g. "Semi-Annual Flex")
 * @returns {string} e.g. "plan-semi-annual-flex"
 */
function generatePlanId(name = "") {
  if (name) {
    return "plan-" + name.toLowerCase().trim().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  }
  return `plan-${Date.now().toString().slice(-6)}`;
}

// ─── Payment Transaction ID ───────────────────────────────────────────────────
/**
 * Mirrors frontend's generateTransactionId() from membershipPlans.js.
 * Format: TXN-UPI-123456-4567
 * @param {string} method - Payment method (UPI, Card, NetBanking, Cash)
 * @returns {string}
 */
function generateTransactionId(method = "UPI") {
  const prefix = (method || "UPI").toUpperCase().slice(0, 3);
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `TXN-${prefix}-${ts}-${rand}`;
}

// ─── Receipt Number ───────────────────────────────────────────────────────────
/**
 * Mirrors frontend's generateReceiptNumber() from membershipPlans.js.
 * Format: TSW-REC-2026-12345
 * @returns {string}
 */
function generateReceiptNumber() {
  const year = new Date().getFullYear();
  const seq = Math.floor(10_000 + Math.random() * 90_000);
  return `${ID_PREFIXES.RECEIPT}-${year}-${seq}`;
}

// ─── Batch Assignment ID ──────────────────────────────────────────────────────
/**
 * Produces format: ASG-172767-1234
 * @returns {string}
 */
function generateAssignmentId() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${ID_PREFIXES.ASSIGNMENT}-${ts}-${rand}`;
}

// ─── Attendance Record ID ─────────────────────────────────────────────────────
/**
 * Produces format: ATT-172767-1234
 * @returns {string}
 */
function generateAttendanceId() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${ID_PREFIXES.ATTENDANCE}-${ts}-${rand}`;
}

// ─── Trainer Log ID ───────────────────────────────────────────────────────────
/**
 * Produces format: TLOG-172767-1234
 * @returns {string}
 */
function generateTrainerLogId() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${ID_PREFIXES.TRAINER_LOG}-${ts}-${rand}`;
}

// ─── Trainer Leave Request ID ─────────────────────────────────────────────────
/**
 * Produces format: TLREQ-172767-1234
 * @returns {string}
 */
function generateTrainerLeaveId() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${ID_PREFIXES.TRAINER_LEAVE || "TLREQ"}-${ts}-${rand}`;
}

// ─── Inquiry ID ───────────────────────────────────────────────────────────────
/**
 * Produces professional sequential Inquiry IDs: INQ-2026-001, INQ-2026-002, …
 * @param {number} currentMax - The highest numeric suffix in DB for this year
 * @param {number} year - The 4-digit calendar year (e.g. 2026)
 * @returns {string} e.g. "INQ-2026-001"
 */
function generateInquiryId(currentMax = 0, year = new Date().getFullYear()) {
  const nextNum = currentMax + 1;
  const num = nextNum < 1000 ? String(nextNum).padStart(3, "0") : String(nextNum);
  return `${ID_PREFIXES.INQUIRY}-${year}-${num}`;
}

// ─── Class Program ID ─────────────────────────────────────────────────────────
/**
 * Produces format: CLS-001, CLS-002, … CLS-015
 * @param {number} currentMax - The highest numeric suffix in DB
 * @returns {string} e.g. "CLS-001"
 */
function generateClassId(currentMax = 0) {
  const num = String(currentMax + 1).padStart(3, "0");
  return `${ID_PREFIXES.CLASS || "CLS"}-${num}`;
}

// ─── Schedule History ID ──────────────────────────────────────────────────────
/**
 * Produces format: SCH-HIST-172767-1234
 * @returns {string}
 */
function generateScheduleHistoryId() {
  const ts = Date.now().toString().slice(-6);
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `${ID_PREFIXES.SCHEDULE_HISTORY || "SCH-HIST"}-${ts}-${rand}`;
}

// ─── Portfolio Item ID ────────────────────────────────────────────────────────
/**
 * Produces format: PTF-1001, PTF-1002, …
 * @param {number} currentMax - The highest PTF-XXXX number currently in DB
 * @returns {string} e.g. "PTF-1001"
 */
function generatePortfolioId(currentMax = 1000) {
  return `${ID_PREFIXES.PORTFOLIO || "PTF"}-${currentMax + 1}`;
}

module.exports = {
  generateMemberId,
  generateTrainerId,
  generateBatchId,
  generatePlanId,
  generateInquiryId,
  generateTransactionId,
  generateReceiptNumber,
  generateAssignmentId,
  generateAttendanceId,
  generateTrainerLogId,
  generateTrainerLeaveId,
  generateClassId,
  generateScheduleHistoryId,
  generatePortfolioId,
};


