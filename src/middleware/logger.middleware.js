"use strict";

const morgan = require("morgan");
const { NODE_ENV } = require("../config/env");

/**
 * HTTP request logger middleware using Morgan.
 *
 * Development : Colorized `dev` format — method, URL, status, response time
 * Production  : `combined` format — includes IP, user-agent for audit logs
 */
const format = NODE_ENV === "production" ? "combined" : "dev";

module.exports = morgan(format);
