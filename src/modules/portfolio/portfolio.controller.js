"use strict";

const portfolioService = require("./portfolio.service");
const { success, created, paginated } = require("../../shared/response");
const { parsePaginationParams, buildPaginationResult } = require("../../shared/pagination");

/**
 * GET /api/v1/portfolio/public
 * Returns active portfolio items grouped by section.
 */
async function getPublicPortfolio(req, res, next) {
  try {
    const grouped = await portfolioService.getPublicGrouped();
    return success(res, grouped, "Public portfolio data retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/portfolio
 * Returns paginated & filtered items for admin masters panel.
 */
async function getAdminPortfolio(req, res, next) {
  try {
    const { page, pageSize, skip } = parsePaginationParams(req.query);
    const { section, status, search } = req.query;

    const { data, total } = await portfolioService.getAll({
      section,
      status,
      search,
      skip,
      limit: pageSize,
    });

    const paginationMeta = buildPaginationResult(total, page, pageSize);
    return paginated(res, { data, ...paginationMeta }, "Portfolio items retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/portfolio/:id
 * Returns a single portfolio item.
 */
async function getPortfolioById(req, res, next) {
  try {
    const item = await portfolioService.getById(req.params.id);
    return success(res, item, "Portfolio item retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/portfolio
 * Creates a new portfolio item.
 */
async function createPortfolioItem(req, res, next) {
  try {
    const item = await portfolioService.create(req.body);
    return created(res, item, "Portfolio item created successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * PUT /api/v1/portfolio/:id
 * Updates an existing portfolio item.
 */
async function updatePortfolioItem(req, res, next) {
  try {
    const item = await portfolioService.update(req.params.id, req.body);
    return success(res, item, "Portfolio item updated successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/portfolio/:id/status
 * Toggles active/inactive status.
 */
async function togglePortfolioStatus(req, res, next) {
  try {
    const item = await portfolioService.toggleStatus(req.params.id);
    return success(res, item, `Portfolio item status updated to ${item.status}.`);
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/portfolio/reorder
 * Bulk updates order indexes.
 */
async function reorderPortfolioItems(req, res, next) {
  try {
    const result = await portfolioService.reorder(req.body.items);
    return success(res, result, "Portfolio items reordered successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/v1/portfolio/:id
 * Deletes an item (soft-delete by default, ?permanent=true for hard delete).
 */
async function deletePortfolioItem(req, res, next) {
  try {
    const permanent = req.query.permanent === "true";
    const result = await portfolioService.delete(req.params.id, { permanent });
    return success(res, result, "Portfolio item deleted successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/portfolio/seed
 * Admin utility to trigger default seed.
 */
async function seedPortfolio(req, res, next) {
  try {
    const result = await portfolioService.seedInitialData();
    return success(res, result, result.message);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getPublicPortfolio,
  getAdminPortfolio,
  getPortfolioById,
  createPortfolioItem,
  updatePortfolioItem,
  togglePortfolioStatus,
  reorderPortfolioItems,
  deletePortfolioItem,
  seedPortfolio,
};
