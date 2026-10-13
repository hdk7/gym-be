"use strict";

const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("./user.model");
const { JWT_SECRET, JWT_EXPIRES_IN } = require("../../config/env");
const {
  UnauthorizedError,
  NotFoundError,
  ConflictError,
  BadRequestError,
} = require("../../shared/apiError");

const SALT_ROUNDS = 12;

class AuthService {
  // ─── Token helpers ──────────────────────────────────────────────────────────

  /**
   * Signs a JWT token with the user's payload.
   */
  _signToken(user) {
    return jwt.sign(
      { id: user._id.toString(), email: user.email, role: user.role, name: user.name },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );
  }

  /**
   * Strips sensitive fields from a user document before returning to client.
   */
  _sanitize(user) {
    const obj = user.toObject ? user.toObject() : { ...user };
    delete obj.passwordHash;
    delete obj.__v;
    return obj;
  }

  // ─── Core Auth Operations ───────────────────────────────────────────────────

  /**
   * Register a new admin / staff user.
   * In production, this should be restricted to existing admins via RBAC.
   */
  async register(body) {
    const existing = await User.findOne({ email: body.email.toLowerCase().trim() });
    if (existing) {
      throw new ConflictError("An account with this email already exists.");
    }

    const passwordHash = await bcrypt.hash(body.password, SALT_ROUNDS);

    const user = await User.create({
      name: body.name.trim(),
      email: body.email.toLowerCase().trim(),
      passwordHash,
      role: body.role || "admin",
    });

    const token = this._signToken(user);
    return { token, user: this._sanitize(user) };
  }

  /**
   * Authenticate with email + password. Returns a JWT on success.
   */
  async login(email, password) {
    // Explicitly select passwordHash (excluded by default via schema)
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select(
      "+passwordHash"
    );

    if (!user || !user.isActive) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      throw new UnauthorizedError("Invalid email or password.");
    }

    // Update lastLoginAt
    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = this._signToken(user);
    return { token, user: this._sanitize(user) };
  }

  /**
   * Returns the currently authenticated user's profile.
   */
  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      throw new NotFoundError("User account not found or inactive.");
    }
    return this._sanitize(user);
  }

  /**
   * Changes the password for the authenticated user.
   */
  async changePassword(userId, currentPassword, newPassword) {
    const user = await User.findById(userId).select("+passwordHash");
    if (!user) throw new NotFoundError("User not found.");

    const isMatch = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!isMatch) {
      throw new BadRequestError("Current password is incorrect.");
    }

    user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.save({ validateBeforeSave: false });

    return { message: "Password changed successfully." };
  }

  /**
   * Refreshes a JWT by verifying the old token (client sends it in body).
   * Since we use stateless JWTs, this re-issues a fresh token for the same user.
   */
  async refresh(oldToken) {
    let payload;
    try {
      payload = jwt.verify(oldToken, JWT_SECRET);
    } catch {
      throw new UnauthorizedError("Token is invalid or has expired. Please log in again.");
    }

    const user = await User.findById(payload.id);
    if (!user || !user.isActive) {
      throw new UnauthorizedError("User account not found or inactive.");
    }

    const token = this._signToken(user);
    return { token, user: this._sanitize(user) };
  }
}

module.exports = new AuthService();
