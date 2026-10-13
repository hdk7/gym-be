"use strict";

const { PAGINATION } = require("./constants");

/**
 * Pagination helpers for list endpoints.
 *
 * Usage in a controller:
 *   const { page, pageSize, skip } = parsePaginationParams(req.query);
 *   const { data, total } = await service.getAll({ skip, limit: pageSize });
 *   return paginated(res, { data, ...buildPaginationResult(total, page, pageSize) });
 */

// ─── Parse & Sanitize Query Params ───────────────────────────────────────────
/**
 * Extracts and sanitizes pagination parameters from the request query string.
 * Supports both ?page=2&pageSize=10 and ?page=2&limit=10 for flexibility.
 *
 * @param {object} query - req.query object from Express
 * @returns {{ page: number, pageSize: number, skip: number }}
 */
function parsePaginationParams(query = {}) {
  const page = Math.max(
    PAGINATION.DEFAULT_PAGE,
    parseInt(query.page, 10) || PAGINATION.DEFAULT_PAGE
  );

  const pageSize = Math.min(
    PAGINATION.MAX_PAGE_SIZE,
    Math.max(
      1,
      parseInt(query.pageSize || query.limit, 10) || PAGINATION.DEFAULT_PAGE_SIZE
    )
  );

  const skip = (page - 1) * pageSize;

  return { page, pageSize, skip };
}

// ─── Build Pagination Metadata ────────────────────────────────────────────────
/**
 * Computes pagination metadata to include in the response body.
 *
 * @param {number} total     - Total number of matching documents in DB
 * @param {number} page      - Current page (1-indexed)
 * @param {number} pageSize  - Number of items per page
 * @returns {{ total: number, page: number, pageSize: number, totalPages: number }}
 */
function buildPaginationResult(total, page, pageSize) {
  return {
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize) || 1,
  };
}

// ─── Build a Sort Object ─────────────────────────────────────────────────────
/**
 * Builds a Mongoose sort object from query params.
 *   ?sortBy=registeredAt&sortOrder=asc  →  { registeredAt: 1 }
 *   ?sortBy=firstName&sortOrder=desc    →  { firstName: -1 }
 *
 * @param {object} query         - req.query
 * @param {string} defaultField  - Field to sort by if none provided
 * @param {string} defaultOrder  - "asc" or "desc"
 * @returns {object} Mongoose sort object
 */
function parseSortParams(query = {}, defaultField = "registeredAt", defaultOrder = "desc") {
  const field = query.sortBy || defaultField;
  const order = (query.sortOrder || defaultOrder).toLowerCase() === "asc" ? 1 : -1;
  return { [field]: order };
}

module.exports = {
  parsePaginationParams,
  buildPaginationResult,
  parseSortParams,
};
