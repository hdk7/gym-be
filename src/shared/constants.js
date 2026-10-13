"use strict";

/**
 * Application-wide enums and constants.
 *
 * All values are Object.freeze()'d to prevent accidental mutation.
 * These mirror the frontend's own implicit enums discovered in:
 *   - membersService.js  (status values, blood groups)
 *   - trainersService.js (status, gender)
 *   - batchesService.js  (days patterns)
 *   - membershipPlans.js (payment methods, plan status)
 */

// ─── Member Statuses ──────────────────────────────────────────────────────────
const MEMBER_STATUS = Object.freeze({
  ACTIVE:    "Active",
  INACTIVE:  "Inactive",
  LEAD:      "Lead",
  INQUIRY:   "Inquiry",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  ARCHIVED:  "Archived",
});

// ─── Trainer Statuses ─────────────────────────────────────────────────────────
const TRAINER_STATUS = Object.freeze({
  ACTIVE:   "Active",
  INACTIVE: "Inactive",
});

// ─── Plan Statuses ────────────────────────────────────────────────────────────
const PLAN_STATUS = Object.freeze({
  ACTIVE:   "Active",
  INACTIVE: "Inactive",
});

// ─── Batch Statuses ───────────────────────────────────────────────────────────
const BATCH_STATUS = Object.freeze({
  ACTIVE:   "Active",
  INACTIVE: "Inactive",
});

// ─── Inquiry Statuses ─────────────────────────────────────────────────────────
const INQUIRY_STATUS = Object.freeze({
  INQUIRY:   "Inquiry",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  ARCHIVED:  "Archived",
});

// ─── Demographic / Physical ───────────────────────────────────────────────────
const GENDER = Object.freeze(["Male", "Female", "Other"]);

const CONTACT_METHODS = Object.freeze([
  "Phone Call",
  "WhatsApp",
  "In-Person",
  "Email",
  "SMS",
]);

const BLOOD_GROUPS = Object.freeze([
  "A+", "A-",
  "B+", "B-",
  "AB+", "AB-",
  "O+", "O-",
]);

// ─── Batch Schedule Patterns ──────────────────────────────────────────────────
// MWF = Monday / Wednesday / Friday
// TTS = Tuesday / Thursday / Saturday
const DAYS_PATTERN = Object.freeze([
  "MWF",
  "TTS",
  "CUSTOM",
  "Mon - Fri",
  "Mon - Sat",
  "Daily",
  "Weekend",
]);

// ─── Payment ──────────────────────────────────────────────────────────────────
const PAYMENT_METHODS = Object.freeze(["UPI", "Card", "NetBanking", "Cash"]);

const PAYMENT_STATUS = Object.freeze({
  COMPLETED: "Completed",
  PENDING:   "Pending",
  FAILED:    "Failed",
  REFUNDED:  "Refunded",
});

// ─── ID Prefixes (matches frontend MEM-xxxx / TRN-xxx format) ─────────────────
const ID_PREFIXES = Object.freeze({
  MEMBER:      "MEM",
  TRAINER:     "TRN",
  BATCH:       "BATCH",
  PLAN:        "PLAN",
  INQUIRY:     "INQ",
  TXN:         "TXN",
  RECEIPT:          "TSW-REC",
  ASSIGNMENT:       "ASG",
  ATTENDANCE:       "ATT",
  TRAINER_LOG:      "TLOG",
  TRAINER_LEAVE:    "TLREQ",
  CLASS:            "CLS",
  SCHEDULE_HISTORY: "SCH-HIST",
  PORTFOLIO:        "PTF",
});

// ─── Pagination Defaults ──────────────────────────────────────────────────────
const PAGINATION = Object.freeze({
  DEFAULT_PAGE:      1,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE:     5000,
});

// ─── User Roles (for auth) ────────────────────────────────────────────────────
const USER_ROLES = Object.freeze({
  ADMIN: "admin",
  STAFF: "staff",
});

// ─── Emergency Relationship options (mirrors frontend dropdown) ───────────────
const EMERGENCY_RELATIONS = Object.freeze([
  "Spouse",
  "Father",
  "Mother",
  "Brother",
  "Sister",
  "Friend",
  "Other",
]);

// ─── Schedule Statuses ────────────────────────────────────────────────────────
const SCHEDULE_STATUS = Object.freeze({
  ACTIVE:   "Active",
  INACTIVE: "Inactive",
  ARCHIVED: "Archived",
});

// ─── Class Program Statuses ───────────────────────────────────────────────────
const CLASS_STATUS = Object.freeze({
  ACTIVE:   "ACTIVE",
  INACTIVE: "INACTIVE",
  ARCHIVED: "ARCHIVED",
});

// ─── Schedule History Actions ────────────────────────────────────────────────
const SCHEDULE_CHANGE_ACTION = Object.freeze({
  ASSIGN_CLASSES: "ASSIGN_CLASSES",
  SWAP_DATES:     "SWAP_DATES",
  REORDER:        "REORDER",
  EDIT_WORKOUT:   "EDIT_WORKOUT",
  REMOVE_CLASS:   "REMOVE_CLASS",
  UPDATE_CLASS:   "UPDATE_CLASS",
  RESTORE_CLASS:  "RESTORE_CLASS",
});

// ─── Session Statuses ─────────────────────────────────────────────────────────
const SESSION_STATUS = Object.freeze({
  SCHEDULED: "SCHEDULED",
  COMPLETED: "COMPLETED",
  TODAY:     "TODAY",
  CANCELLED: "CANCELLED",
});

// ─── Holiday Types ────────────────────────────────────────────────────────────
const HOLIDAY_TYPE = Object.freeze([
  "Public Holiday",
  "National Holiday",
  "Festival Holiday",
  "Facility Maintenance",
  "Special Event",
  "Other",
]);

// ─── Batch Assignment Types & Statuses ────────────────────────────────────────
const ASSIGNMENT_TYPE = Object.freeze({
  PRIMARY:            "PRIMARY",
  TEMPORARY_FLEX:     "TEMPORARY_FLEX",
  PERMANENT_TRANSFER: "PERMANENT_TRANSFER",
});

const ASSIGNMENT_STATUS = Object.freeze({
  ACTIVE:    "ACTIVE",
  COMPLETED: "COMPLETED",
  REVOKED:   "REVOKED",
  EXPIRED:   "EXPIRED",
});

// ─── Attendance Statuses ──────────────────────────────────────────────────────
const ATTENDANCE_STATUS = Object.freeze({
  PRESENT:     "PRESENT",
  ABSENT:      "ABSENT",
  LATE:        "LATE",
  EXCUSED:     "EXCUSED",
  CHECKED_IN:  "CHECKED_IN",
  CHECKED_OUT: "CHECKED_OUT",
});

// ─── Trainer Log Statuses ─────────────────────────────────────────────────────
const TRAINER_LOG_STATUS = Object.freeze({
  CONDUCTED:  "CONDUCTED",
  PRESENT:    "PRESENT",
  SUBSTITUTE: "SUBSTITUTE",
  ABSENT:     "ABSENT",
  LEAVE:      "LEAVE",
});

// ─── Trainer Leave Request Statuses ───────────────────────────────────────────
const TRAINER_LEAVE_STATUS = Object.freeze({
  PENDING:   "PENDING",
  APPROVED:  "APPROVED",
  REJECTED:  "REJECTED",
  CANCELLED: "CANCELLED",
});

// ─── Portfolio Sections & Statuses ───────────────────────────────────────────
const PORTFOLIO_SECTION = Object.freeze({
  TRAINING_SESSION: "TRAINING_SESSION",
  SESSION_CLIP:     "SESSION_CLIP",
  FEEDBACK_QUOTE:   "FEEDBACK_QUOTE",
  FEEDBACK_VIDEO:   "FEEDBACK_VIDEO",
  PHOTO:            "PHOTO",
  VIDEO:            "VIDEO",
});

const PORTFOLIO_STATUS = Object.freeze({
  ACTIVE:   "Active",
  INACTIVE: "Inactive",
});

module.exports = {
  MEMBER_STATUS,
  TRAINER_STATUS,
  PLAN_STATUS,
  BATCH_STATUS,
  INQUIRY_STATUS,
  SCHEDULE_STATUS,
  CLASS_STATUS,
  SCHEDULE_CHANGE_ACTION,
  SESSION_STATUS,
  HOLIDAY_TYPE,
  ASSIGNMENT_TYPE,
  ASSIGNMENT_STATUS,
  ATTENDANCE_STATUS,
  TRAINER_LOG_STATUS,
  TRAINER_LEAVE_STATUS,
  PORTFOLIO_SECTION,
  PORTFOLIO_STATUS,
  GENDER,
  CONTACT_METHODS,
  BLOOD_GROUPS,
  DAYS_PATTERN,
  PAYMENT_METHODS,
  PAYMENT_STATUS,
  ID_PREFIXES,
  PAGINATION,
  USER_ROLES,
  EMERGENCY_RELATIONS,
};



