"use strict";

require("dotenv").config();

const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000/api/v1";
let authToken = "";
let useSupertest = false;
let appInstance = null;
let supertestRequest = null;

function assert(condition, message) {
  if (!condition) {
    throw new Error(`[Assertion Failed] ${message}`);
  }
}

async function apiRequest(path, options = {}) {
  const method = options.method || "GET";
  const body = options.body;

  if (!useSupertest) {
    try {
      const headers = {
        "Content-Type": "application/json",
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
        ...(options.headers || {}),
      };

      const res = await fetch(`${BASE_URL}${path}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });

      let json = null;
      try {
        json = await res.json();
      } catch (_) {}

      return {
        status: res.status,
        ok: res.ok,
        data: json?.data !== undefined ? json.data : json,
        message: json?.message,
        raw: json,
      };
    } catch (fetchErr) {
      console.log(`  [Notice] Live server fetch failed (${fetchErr.message}). Switching to in-process supertest...`);
      useSupertest = true;
    }
  }

  // Fallback to in-process Supertest
  if (!appInstance) {
    appInstance = require("../src/app");
    const supertest = require("supertest");
    supertestRequest = supertest(appInstance);
  }

  let req;
  const fullPath = `/api/v1${path}`;
  if (method === "GET") req = supertestRequest.get(fullPath);
  else if (method === "POST") req = supertestRequest.post(fullPath);
  else if (method === "PUT") req = supertestRequest.put(fullPath);
  else if (method === "PATCH") req = supertestRequest.patch(fullPath);
  else if (method === "DELETE") req = supertestRequest.delete(fullPath);

  if (authToken) {
    req.set("Authorization", `Bearer ${authToken}`);
  }
  if (body !== undefined) {
    req.send(body);
  }

  const res = await req;
  const json = res.body;
  return {
    status: res.status,
    ok: res.status >= 200 && res.status < 300,
    data: json?.data !== undefined ? json.data : json,
    message: json?.message,
    raw: json,
  };
}

async function authenticate() {
  console.log("Authenticating admin user...");
  // Attempt login with default admin credentials
  const loginRes = await apiRequest("/auth/login", {
    method: "POST",
    body: { email: "admin@strengthway.com", password: "Admin@2026" },
  });

  if (loginRes.ok && (loginRes.data?.token || loginRes.raw?.token)) {
    authToken = loginRes.data?.token || loginRes.raw?.token;
    console.log("  ✓ Admin authenticated successfully");
    return;
  }

  // Fallback login
  const fallbackRes = await apiRequest("/auth/login", {
    method: "POST",
    body: { email: "admin@thestrengthway.com", password: "Admin@12345" },
  });

  if (fallbackRes.ok && (fallbackRes.data?.token || fallbackRes.raw?.token)) {
    authToken = fallbackRes.data?.token || fallbackRes.raw?.token;
    console.log("  ✓ Admin authenticated via secondary credentials");
    return;
  }

  console.warn("  ⚠ Live admin login failed; generating local signed JWT token for test execution");
  const jwt = require("jsonwebtoken");
  authToken = jwt.sign(
    { id: "ADMIN-TEST", role: "superadmin", email: "admin@strengthway.com" },
    process.env.JWT_SECRET || "strengthway-secret-2026",
    { expiresIn: "1h" }
  );
}

module.exports = {
  assert,
  apiRequest,
  authenticate,
};
