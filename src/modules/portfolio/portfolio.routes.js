"use strict";

const router = require("express").Router();
const ctrl = require("./portfolio.controller");
const { authenticate } = require("../../middleware/auth.middleware");

// ── Public Routes (Unauthenticated) ──────────────────────────────────────────
// Public portfolio endpoint for landing page visitors
router.get("/public", ctrl.getPublicPortfolio);

// ── Admin Routes (Authenticated) ─────────────────────────────────────────────
// Get filtered & paginated portfolio items
router.get("/", authenticate, ctrl.getAdminPortfolio);

// Get single item by ID
router.get("/:id", authenticate, ctrl.getPortfolioById);

// Create a new portfolio item
router.post("/", authenticate, ctrl.createPortfolioItem);

// Seed initial static items if needed
router.post("/seed", authenticate, ctrl.seedPortfolio);

// Update an existing item
router.put("/:id", authenticate, ctrl.updatePortfolioItem);

// Bulk reorder item sequence
router.patch("/reorder", authenticate, ctrl.reorderPortfolioItems);

// Toggle active/inactive status
router.patch("/:id/status", authenticate, ctrl.togglePortfolioStatus);

// Delete an item (?permanent=true for hard delete)
router.delete("/:id", authenticate, ctrl.deletePortfolioItem);

module.exports = router;
