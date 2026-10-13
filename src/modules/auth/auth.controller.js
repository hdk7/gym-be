"use strict";

const authService = require("./auth.service");
const { success, created } = require("../../shared/response");

/**
 * POST /api/v1/auth/register
 * Creates a new admin/staff account.
 * Body validated by registerSchema via validate() middleware.
 */
async function register(req, res, next) {
  try {
    const result = await authService.register(req.body);
    return created(res, result, "Account created successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/login
 * Authenticate with email + password. Returns JWT token.
 * Body validated by loginSchema via validate() middleware.
 */
async function login(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return success(res, result, "Login successful.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/logout
 * Stateless JWT — logout is handled client-side by discarding the token.
 * This endpoint simply confirms the action for client consistency.
 */
async function logout(req, res, next) {
  try {
    return success(res, null, "Logged out successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/v1/auth/me
 * Returns the current authenticated user's profile.
 * Protected — requires authenticate() middleware.
 */
async function getMe(req, res, next) {
  try {
    const user = await authService.getMe(req.user.id);
    return success(res, user, "Profile retrieved successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/v1/auth/refresh
 * Re-issues a fresh JWT for the same user.
 * Body: { token: "<existing_token>" }
 */
async function refresh(req, res, next) {
  try {
    const { token } = req.body;
    const result = await authService.refresh(token);
    return success(res, result, "Token refreshed successfully.");
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH /api/v1/auth/change-password
 * Changes the password for the currently authenticated user.
 * Protected — requires authenticate() middleware.
 * Body validated by changePasswordSchema via validate() middleware.
 */
async function changePassword(req, res, next) {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changePassword(req.user.id, currentPassword, newPassword);
    return success(res, result, result.message);
  } catch (err) {
    next(err);
  }
}

module.exports = { register, login, logout, getMe, refresh, changePassword };
