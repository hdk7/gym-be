"use strict";

jest.setTimeout(30000);

const request = require("supertest");
const app = require("./app");
const { connectDB, disconnectDB } = require("./config/database");

describe("Phase 7 — App Assembly Integration Suite", () => {
  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await disconnectDB();
  });

  describe("Health & System Endpoints", () => {
    test("GET /api/health — returns 200 with health metadata", async () => {
      const res = await request(app).get("/api/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.message).toContain("running");
      expect(res.body.environment).toBeDefined();
      expect(res.body.timestamp).toBeDefined();
    });

    test("GET /api/v1 — returns API directory with all module endpoints", async () => {
      const res = await request(app).get("/api/v1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.endpoints).toBeDefined();
      expect(res.body.endpoints.auth).toBe("/api/v1/auth");
      expect(res.body.endpoints.members).toBe("/api/v1/members");
      expect(res.body.endpoints.trainers).toBe("/api/v1/trainers");
      expect(res.body.endpoints.plans).toBe("/api/v1/plans");
      expect(res.body.endpoints.batches).toBe("/api/v1/batches");
      expect(res.body.endpoints.inquiries).toBe("/api/v1/inquiries");
      expect(res.body.endpoints.uploads).toBe("/api/v1/uploads");
    });
  });

  describe("Routing & Middleware Integration", () => {
    test("GET /api/v1/unknown-route-12345 — returns 404 with standardized error envelope", async () => {
      const res = await request(app).get("/api/v1/unknown-route-12345");
      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.message).toContain("Route not found");
      expect(res.body.timestamp).toBeDefined();
    });

    test("OPTIONS /api/v1/members — handles CORS preflight cleanly", async () => {
      const res = await request(app)
        .options("/api/v1/members")
        .set("Origin", "http://localhost:5173")
        .set("Access-Control-Request-Method", "GET");
      expect([200, 204]).toContain(res.status);
      expect(res.headers["access-control-allow-origin"]).toBe("http://localhost:5173");
    });
  });

  describe("Module Routes Registration", () => {
    test("GET /api/v1/members — members route mounted and responds", async () => {
      const res = await request(app).get("/api/v1/members?pageSize=1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
      expect(res.body.pagination).toBeDefined();
    });

    test("GET /api/v1/trainers — trainers route mounted and responds", async () => {
      const res = await request(app).get("/api/v1/trainers?pageSize=1");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("GET /api/v1/plans — plans route mounted and responds", async () => {
      const res = await request(app).get("/api/v1/plans");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("GET /api/v1/batches — batches route mounted and responds", async () => {
      const res = await request(app).get("/api/v1/batches");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("GET /api/v1/inquiries — inquiries route mounted and responds", async () => {
      const res = await request(app).get("/api/v1/inquiries");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.data)).toBe(true);
    });

    test("POST /api/v1/auth/login with empty body — auth route mounted and validates", async () => {
      const res = await request(app).post("/api/v1/auth/login").send({});
      // Should reject with validation error (422) or bad request (400)
      expect([400, 422]).toContain(res.status);
      expect(res.body.success).toBe(false);
    });
  });
});
