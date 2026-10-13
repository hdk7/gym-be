"use strict";

/**
 * Date and physical calculation utilities.
 *
 * These mirror the calculations performed in the frontend's:
 *   - MemberProfilePage.jsx  (calculateAge, calculateBmi, formatHeight, formatWeight)
 *   - membershipPlans.js     (calculateMembershipDates)
 *
 * Results are computed server-side so the stored data is always consistent.
 */

// ─── Age Calculation ──────────────────────────────────────────────────────────
/**
 * Computes the current age from a date-of-birth string.
 * @param {string|Date} dobString - ISO date string or Date object
 * @returns {number|null} Age in years, or null if input is invalid
 */
function calculateAge(dobString) {
  if (!dobString) return null;

  const birth = new Date(dobString);
  if (isNaN(birth.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }

  return age >= 0 ? age : null;
}

// ─── BMI Calculation ──────────────────────────────────────────────────────────
/**
 * Calculates BMI from height (cm) and weight (kg).
 * Formula: weight(kg) / (height(m))²
 *
 * @param {number|string} heightCm - Height in centimetres
 * @param {number|string} weightKg - Weight in kilograms
 * @returns {number|null} BMI rounded to 1 decimal, or null if inputs are invalid
 */
function calculateBmi(heightCm, weightKg) {
  const h = parseFloat(heightCm);
  const w = parseFloat(weightKg);

  if (!h || !w || isNaN(h) || isNaN(w) || h <= 0 || w <= 0) return null;

  const heightM = h / 100;
  return parseFloat((w / (heightM * heightM)).toFixed(1));
}

// ─── BMI Category ─────────────────────────────────────────────────────────────
/**
 * Returns the WHO BMI category string for a given BMI value.
 * Mirrors the classification used in MemberProfilePage.jsx.
 *
 * @param {number} bmi
 * @returns {"Underweight"|"Normal"|"Overweight"|"Obese"|null}
 */
function getBmiCategory(bmi) {
  if (bmi === null || bmi === undefined || isNaN(bmi)) return null;
  if (bmi < 18.5) return "Underweight";
  if (bmi < 25)   return "Normal";
  if (bmi < 30)   return "Overweight";
  return "Obese";
}

// ─── Membership Date Range ────────────────────────────────────────────────────
/**
 * Calculates membership start and expiry dates.
 * Mirrors membershipPlans.js → calculateMembershipDates().
 *
 * @param {number}      durationMonths - Plan duration (e.g. 1, 3)
 * @param {Date|string} startDate      - Plan start date (defaults to now)
 * @returns {{ startDate: string, endDate: string }}
 */
function calculateMembershipDates(durationMonths, startDate = new Date()) {
  const start = new Date(startDate);
  const end = new Date(start);
  end.setMonth(end.getMonth() + durationMonths);

  return {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
  };
}

// ─── Height Formatting ────────────────────────────────────────────────────────
/**
 * Converts cm to feet-inches string (e.g. 178cm → "5' 10\"").
 * @param {number|string} cm
 * @returns {string|null}
 */
function formatHeightImperial(cm) {
  const c = parseFloat(cm);
  if (!c || isNaN(c)) return null;
  const totalInches = c / 2.54;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches % 12);
  return `${feet}' ${inches}"`;
}

// ─── Weight Formatting ────────────────────────────────────────────────────────
/**
 * Converts kg to pounds (e.g. 76kg → "167.6 lbs").
 * @param {number|string} kg
 * @returns {string|null}
 */
function formatWeightImperial(kg) {
  const k = parseFloat(kg);
  if (!k || isNaN(k)) return null;
  return `${(k * 2.20462).toFixed(1)} lbs`;
}

// ─── Date Formatting ──────────────────────────────────────────────────────────
/**
 * Returns a short readable date string for display (e.g. "29 May 2026").
 * @param {Date|string} date
 * @returns {string}
 */
function formatDisplayDate(date) {
  if (!date) return "";
  return new Date(date).toLocaleDateString("en-IN", {
    year:  "numeric",
    month: "short",
    day:   "numeric",
  });
}

module.exports = {
  calculateAge,
  calculateBmi,
  getBmiCategory,
  calculateMembershipDates,
  formatHeightImperial,
  formatWeightImperial,
  formatDisplayDate,
};
