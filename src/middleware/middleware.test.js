"use strict";

const express = require("express");
const request = require("supertest");
const jwt = require("jsonwebtoken");
const yup = require("yup");

const { JWT_SECRET } = require("../config/env");
const { authenticate, optionalAuth } = require("./auth.middleware");
const { requireRole, requireAdmin } = require("./role.middleware");
const { validate } = require("./validate.middleware");
const notFoundMiddleware = require("./notFound.middleware");
const errorMiddleware = require("./error.middleware");
const { BadRequestError, NotFoundError } = require("../shared/apiError");

describe("Phase 2 Middleware Suite", () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
  });

  describe("Step 2.3 — Validate Middleware", () => {
    const testSchema = yup.object().shape({
      name: yup.string().required("Name is required.").min(3),
      age: yup.number().required().min(18),
    });

    test("passes valid data and strips unknown properties", async () => {
      app.post("/test-validate", validate(testSchema), (req, res) => {
        res.status(200).json({ success: true, data: req.body });
      });
      app.use(errorMiddleware);

      const res = await request(app)
        .post("/test-validate")
        .send({ name: "Alex", age: 25, maliciousField: "hacked" });

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe("Alex");
      expect(res.body.data.age).toBe(25);
      expect(res.body.data.maliciousField).toBeUndefined();
    });

    test("returns 422 with field-level error messages on invalid input", async () => {
      app.post("/test-validate", validate(testSchema), (req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorMiddleware);

      const res = await request(app)
        .post("/test-validate")
        .send({ name: "A", age: 16 });

      expect(res.status).toBe(422);
      expect(res.body.success).toBe(false);
      expect(res.body.errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ field: "name" }),
          expect.objectContaining({ field: "age" }),
        ])
      );
    });
  });

  describe("Step 2.4 — Auth Middleware", () => {
    test("rejects request with 401 when no token is provided", async () => {
      app.get("/protected", authenticate, (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      });
      app.use(errorMiddleware);

      const res = await request(app).get("/protected");
      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Authentication required/i);
    });

    test("rejects request with 401 when invalid token is provided", async () => {
      app.get("/protected", authenticate, (req, res) => {
        res.status(200).json({ success: true });
      });
      app.use(errorMiddleware);

      const res = await request(app)
        .get("/protected")
        .set("Authorization", "Bearer invalid-token-xyz");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });

    test("authenticates successfully with a valid token and populates req.user", async () => {
      const token = jwt.sign(
        { id: "usr_1", email: "admin@strengthway.com", role: "admin" },
        JWT_SECRET,
        { expiresIn: "1h" }
      );

      app.get("/protected", authenticate, (req, res) => {
        res.status(200).json({ success: true, user: req.user });
      });
      app.use(errorMiddleware);

      const res = await request(app)
        .get("/protected")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe("admin@strengthway.com");
      expect(res.body.user.role).toBe("admin");
    });

    test("optionalAuth allows unauthenticated requests but sets req.user to null", async () => {
      app.get("/optional", optionalAuth, (req, res) => {
        res.status(200).json({ user: req.user });
      });

      const res = await request(app).get("/optional");
      expect(res.status).toBe(200);
      expect(res.body.user).toBeNull();
    });
  });

  describe("Step 2.5 — Role Middleware", () => {
    test("blocks user without required role with 403 Forbidden", async () => {
      const staffToken = jwt.sign(
        { id: "usr_2", email: "staff@strengthway.com", role: "staff" },
        JWT_SECRET
      );

      app.delete("/admin-only", authenticate, requireAdmin, (req, res) => {
        res.status(200).json({ deleted: true });
      });
      app.use(errorMiddleware);

      const res = await request(app)
        .delete("/admin-only")
        .set("Authorization", `Bearer ${staffToken}`);

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Access denied/i);
    });

    test("allows user with required role to proceed", async () => {
      const adminToken = jwt.sign(
        { id: "usr_1", email: "admin@strengthway.com", role: "admin" },
        JWT_SECRET
      );

      app.delete("/admin-only", authenticate, requireAdmin, (req, res) => {
        res.status(200).json({ deleted: true });
      });
      app.use(errorMiddleware);

      const res = await request(app)
        .delete("/admin-only")
        .set("Authorization", `Bearer ${adminToken}`);

      expect(res.status).toBe(200);
      expect(res.body.deleted).toBe(true);
    });
  });

  describe("Step 2.6 & 2.7 — Error & Not Found Middleware", () => {
    test("handles 404 for unknown route", async () => {
      app.use(notFoundMiddleware);
      app.use(errorMiddleware);

      const res = await request(app).get("/unknown-route-12345");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/Route not found/i);
    });

    test("converts custom ApiError subclasses into correct HTTP status", async () => {
      app.get("/error-test", (req, res, next) => {
        next(new BadRequestError("Custom bad request message"));
      });
      app.use(errorMiddleware);

      const res = await request(app).get("/error-test");
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toBe("Custom bad request message");
    });

    test("handles Mongoose duplicate key errors (code 11000)", async () => {
      app.get("/mongo-dup", (req, res, next) => {
        const err = new Error("E11000 duplicate key error");
        err.code = 11000;
        err.keyValue = { email: "duplicate@example.com" };
        next(err);
      });
      app.use(errorMiddleware);

      const res = await request(app).get("/mongo-dup");
      expect(res.status).toBe(409);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toMatch(/A record with this email already exists/i);
    });
  });
});
