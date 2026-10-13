"use strict";

/**
 * Membership plan seed data — mirrors frontend DEFAULT_MEMBERSHIP_PLANS (membershipPlans.js).
 */

const SEED_PLANS = [
  {
    id: "plan-monthly",
    name: "Monthly Starter",
    durationMonths: 1,
    price: 7000,
    formattedPrice: "\u20b97,000",
    period: "/mo",
    billing: "Billed \u20b97,000 every month",
    description: "Full facility access with flexible month-to-month commitment.",
    badge: null,
    popular: false,
    status: "Active",
    isDeleted: false,
    deletedAt: null,
    features: [
      "Full access to every program \u2014 Strength, Calisthenics & Mobility",
      "Unlimited group training classes",
      "Certified coach floor supervision",
      "Locker & shower facilities",
    ],
  },
  {
    id: "plan-quarterly",
    name: "Quarterly Pro",
    durationMonths: 3,
    price: 18000,
    formattedPrice: "\u20b918,000",
    period: "/3mo",
    billing: "Billed \u20b918,000 every 3 months",
    description: "Billed \u20b918,000 every 3 months. Perfect balance of commitment and athletic progression.",
    badge: "MOST POPULAR",
    popular: true,
    status: "Active",
    isDeleted: false,
    deletedAt: null,
    features: [
      "All Monthly Starter tier benefits included",
      "Quarterly 1-on-1 athletic fitness assessment",
      "Customized hypertrophy & strength split",
      "Priority batch slot booking",
      "Bi-weekly body composition analysis",
    ],
  },
];

module.exports = { SEED_PLANS };
