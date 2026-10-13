# 🏋️ Strengthway Backend API

> Production-ready REST API for **The Strength Way** gym management system — built with Node.js, Express 5, MongoDB Atlas, Mongoose 9, and Yup validation.

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Prerequisites](#3-prerequisites)
4. [Environment Setup](#4-environment-setup)
5. [Installation & Running](#5-installation--running)
6. [Seeding the Database](#6-seeding-the-database)
7. [API Reference](#7-api-reference)
   - [System Endpoints](#system-endpoints)
   - [Auth Module (`/api/v1/auth`)](#auth-module-apiv1auth)
   - [Members Module (`/api/v1/members`)](#members-module-apiv1members)
   - [Trainers Module (`/api/v1/trainers`)](#trainers-module-apiv1trainers)
   - [Membership Plans (`/api/v1/plans`)](#membership-plans-apiv1plans)
   - [Batches Module (`/api/v1/batches`)](#batches-module-apiv1batches)
   - [Uploads Module (`/api/v1/uploads`)](#uploads-module-apiv1uploads)
8. [Request & Response Envelope](#8-request--response-envelope)
9. [Error Codes & Handling](#9-error-codes--handling)
10. [Testing Suite](#10-testing-suite)
11. [Annotated Project Structure](#11-annotated-project-structure)
12. [Frontend Integration Guide](#12-frontend-integration-guide)
13. [Key Architectural Decisions](#13-key-architectural-decisions)

---

## 1. Project Overview

Strengthway Backend is a RESTful API designed to power **The Strength Way** gym and athletic facility management platform. It manages:

- 👥 **Members Lifecycle**: Registration workflow, automatic BMI & physical stats computation, batch assignment, soft-delete archival, restore, and Lead-to-Active member conversion.
- 🏋️ **Trainer Management**: Comprehensive trainer profiles, experience, certifications, and atomic batch schedule synchronization.
- 📅 **Batch Scheduling**: Real-time capacity checks (`maxPax` vs `currentPax`), trainer linking, member enrollment/unenrollment, and recurrence patterns (MWF/TTS).
- 💳 **Membership Plans**: Tiered plans (`plan-monthly`, `plan-quarterly`), pricing, features, duration, and status toggles.
- 🔐 **Authentication & RBAC**: Secure JWT-based access control with password hashing via bcryptjs, supporting Admin and Staff roles.
- ☁️ **Media Uploads**: Cloudinary integration for streaming uploads of profile pictures and medical clearances directly from memory.

---

## 2. Tech Stack

| Layer | Technology | Version | Purpose |
|---|---|---|---|
| **Runtime** | Node.js | `>= 18.0.0` | Server runtime |
| **Framework** | Express | `5.x` | Modern HTTP routing and middleware pipeline |
| **Database** | MongoDB Atlas | Cluster M0+ | Cloud NoSQL document store |
| **ODM** | Mongoose | `9.x` | Schema modeling, validation, and lifecycle hooks |
| **Validation** | Yup | `1.x` | Runtime request body schema validation matching frontend |
| **Security** | bcryptjs & jsonwebtoken | Latest | Password hashing (12 rounds) & JWT tokens |
| **Media** | Cloudinary & Multer | Latest | Direct memory stream image and document upload |
| **Logging** | Morgan | Latest | HTTP request access logging |
| **Rate Limit** | express-rate-limit | Latest | IP-based request throttling (200 req / 15 min) |
| **Testing** | Jest & Supertest | Latest | Automated unit and integration test suites |
| **Dev Tools** | Nodemon | Latest | Hot-reloading development server |

---

## 3. Prerequisites

Before running the server, ensure you have:

- **Node.js** version `18.0.0` or higher (`node -v`)
- **npm** version `9.0.0` or higher (`npm -v`)
- A **MongoDB Atlas** cluster URI with read/write credentials
- *(Optional)* A **Cloudinary** account credentials if testing photo/document uploads

---

## 4. Environment Setup

Copy `.env.example` to create your local `.env` configuration file:

```bash
cp .env.example .env
```

### Configuration Keys

| Variable | Required | Default | Description |
|---|:---:|---|---|
| `NODE_ENV` | No | `development` | Environment mode (`development`, `production`, `test`) |
| `PORT` | No | `5000` | Port for the Express server to listen on |
| `MONGODB_URI` | **Yes** | — | MongoDB Atlas SRV connection string |
| `JWT_SECRET` | **Yes** | — | Cryptographic secret for signing JWT tokens (min 32 chars) |
| `JWT_EXPIRES_IN` | No | `7d` | Token expiration period |
| `CLIENT_ORIGIN` | No | `http://localhost:5173` | Allowed Origin header for CORS |
| `RATE_LIMIT_WINDOW_MS`| No | `900000` | Window size for rate limiting (15 minutes in ms) |
| `RATE_LIMIT_MAX` | No | `200` | Maximum requests per IP within the window |
| `CLOUDINARY_CLOUD_NAME`| Optional| — | Cloudinary cloud account name |
| `CLOUDINARY_API_KEY` | Optional| — | Cloudinary API Key |
| `CLOUDINARY_API_SECRET`| Optional| — | Cloudinary API Secret |

> ⚠️ **Security Warning**: Never commit `.env` to Git. It is already included in `.gitignore`.

---

## 5. Installation & Running

```bash
# 1. Install dependencies
npm install

# 2. Run development server (auto-reloads on file change)
npm run dev

# 3. Run production server
npm start
```

When running, the API announces its status:
```text
─────────────────────────────────────────────
  Strengthway API
  ENV  : development
  PORT : 5000
  URL  : http://localhost:5000/api/health
─────────────────────────────────────────────
```

---

## 6. Seeding the Database

The database can be seeded with the complete dataset from the frontend (plans, trainers, batches, and 124 initial members):

### 6.1 Full Seed
```bash
npm run seed
```
* **Idempotent**: Uses `$set` upserting on custom string IDs (`MEM-XXXX`, `TRN-XXX`, `BATCH-XX`). Safe to run multiple times without duplicating data.

### 6.2 Seed Options & Selective Seeding
```bash
# Drop existing collections and reload from scratch
npm run seed -- --drop

# Seed only a single collection
node src/seeds/plans.seed.js
node src/seeds/trainers.seed.js
node src/seeds/batches.seed.js
node src/seeds/members.seed.js
```

### 6.3 Admin User Seeder
```bash
npm run seed:admin
```
Creates the default administrator account:
- **Email**: `admin@strengthway.com`
- **Password**: `Admin@2026`
- **Role**: `admin`

---

## 7. API Reference

**Base URL**: `http://localhost:5000`

### System Endpoints

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/health` | Public | Real-time health status and timestamp |
| `GET` | `/api/v1` | Public | API root directory listing all modules |

---

### Auth Module (`/api/v1/auth`)

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `POST` | `/api/v1/auth/register` | Public | Register a new staff/admin user |
| `POST` | `/api/v1/auth/login` | Public | Authenticate with email/password and obtain JWT |
| `POST` | `/api/v1/auth/logout` | Public | Invalidate/logout client session |
| `POST` | `/api/v1/auth/refresh` | Public | Exchange valid token for a refreshed JWT |
| `GET` | `/api/v1/auth/me` | 🔐 JWT | Retrieve current authenticated profile |
| `PATCH`| `/api/v1/auth/change-password` | 🔐 JWT | Change account password |

#### Sample Login Request:
```bash
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@strengthway.com","password":"Admin@2026"}'
```

---

### Members Module (`/api/v1/members`)

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/members` | Public | Paginated list of members (filterable) |
| `POST` | `/api/v1/members` | Public | Create new member (computes BMI & dates) |
| `GET` | `/api/v1/members/:id` | Public | Get single member by ID (e.g. `MEM-2001`) |
| `PUT` | `/api/v1/members/:id` | Public | Full update of member profile |
| `DELETE`| `/api/v1/members/:id` | Public | Permanently delete member |
| `PATCH`| `/api/v1/members/:id/soft-delete` | Public | Soft-delete / Archive member |
| `PATCH`| `/api/v1/members/:id/restore` | Public | Restore archived member to Active |
| `PATCH`| `/api/v1/members/:id/toggle-status` | Public | Toggle status between Active and Inactive |
| `PATCH`| `/api/v1/members/:id/convert` | Public | Convert Lead to Active with plan + payment |

#### Query Parameters for `GET /api/v1/members`:
- `page` *(number)*: 1-indexed page (default: `1`)
- `pageSize` *(number)*: Records per page (default: `10`, max: `100`)
- `status` *(string)*: `Active`, `Inactive`, `Lead`, `Archived`, or `All`
- `search` *(string)*: Case-insensitive regex search on name, email, phone, ID
- `includeDeleted` *(boolean)*: Pass `true` to include soft-deleted records

---

### Trainers Module (`/api/v1/trainers`)

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/trainers` | Public | Paginated list of trainers |
| `POST` | `/api/v1/trainers` | Public | Add new trainer |
| `GET` | `/api/v1/trainers/:id` | Public | Get trainer by ID (e.g. `TRN-101`) |
| `PUT` | `/api/v1/trainers/:id` | Public | Update trainer profile & certifications |
| `DELETE`| `/api/v1/trainers/:id` | Public | Permanently remove trainer |
| `PATCH`| `/api/v1/trainers/:id/toggle-status` | Public | Toggle trainer Active ↔ Inactive |
| `PATCH`| `/api/v1/trainers/:id/sync-batches` | Public | Replace assigned batch list |

---

### Membership Plans (`/api/v1/plans`)

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/plans` | Public | List all active plans |
| `POST` | `/api/v1/plans` | Public | Create new membership plan |
| `GET` | `/api/v1/plans/:id` | Public | Get plan by slug ID (`plan-monthly`) |
| `PUT` | `/api/v1/plans/:id` | Public | Update plan pricing, duration, features |
| `DELETE`| `/api/v1/plans/:id` | Public | Permanently delete plan |
| `PATCH`| `/api/v1/plans/:id/soft-delete` | Public | Soft-delete plan |
| `PATCH`| `/api/v1/plans/:id/restore` | Public | Restore soft-deleted plan |
| `PATCH`| `/api/v1/plans/:id/toggle-status` | Public | Toggle plan Active ↔ Inactive |

---

### Batches Module (`/api/v1/batches`)

| Method | Endpoint | Auth | Description |
|---|---|:---:|---|
| `GET` | `/api/v1/batches` | Public | List all workout batches with occupancy |
| `POST` | `/api/v1/batches` | Public | Create new batch slot |
| `GET` | `/api/v1/batches/:id` | Public | Get batch details by ID (`BATCH-01`) |
| `PUT` | `/api/v1/batches/:id` | Public | Update batch capacity, timings, days |
| `DELETE`| `/api/v1/batches/:id` | Public | Delete batch |
| `PATCH`| `/api/v1/batches/:id/enroll` | Public | Enroll member into batch |
| `PATCH`| `/api/v1/batches/:id/unenroll` | Public | Remove member from batch |
| `PATCH`| `/api/v1/batches/:id/sync-trainers` | Public | Replace assigned trainers |
| `PATCH`| `/api/v1/batches/:id/toggle-status` | Public | Toggle batch status |

---

### Uploads Module (`/api/v1/uploads`)

*Requires `Authorization: Bearer <token>`*

| Method | Endpoint | Type | Description |
|---|---|---|---|
| `POST` | `/api/v1/uploads/photo` | `multipart/form-data` | Upload photo (resized to 800x800 WebP) |
| `POST` | `/api/v1/uploads/document` | `multipart/form-data` | Upload medical document / PDF |
| `DELETE`| `/api/v1/uploads/*publicId` | JSON | Remove asset from Cloudinary |

---

## 8. Request & Response Envelope

Every endpoint returns a consistent JSON envelope:

### Success (Single Resource)
```json
{
  "success": true,
  "message": "Member retrieved successfully.",
  "data": {
    "id": "MEM-2001",
    "firstName": "Arun",
    "lastName": "Varma",
    "email": "arun.varma@example.com",
    "status": "Active"
  },
  "timestamp": "2026-09-28T14:40:00.000Z"
}
```

### Success (Paginated Collection)
```json
{
  "success": true,
  "message": "Members retrieved successfully.",
  "data": [ ... ],
  "pagination": {
    "total": 124,
    "page": 1,
    "pageSize": 10,
    "totalPages": 13
  },
  "timestamp": "2026-09-28T14:40:00.000Z"
}
```

### Error Response
```json
{
  "success": false,
  "message": "Validation failed. Please check the submitted fields.",
  "errors": [
    { "field": "email", "message": "Please enter a valid email address." },
    { "field": "dob", "message": "Only persons aged 18 and above are eligible." }
  ],
  "timestamp": "2026-09-28T14:40:00.000Z"
}
```

---

## 9. Error Codes & Handling

| HTTP Status | Category | Explanation |
|:---:|---|---|
| `200` | OK | Successful operation |
| `201` | Created | Resource successfully created |
| `400` | Bad Request | Malformed parameter or unparseable request |
| `401` | Unauthorized | Missing or expired Bearer token |
| `403` | Forbidden | Insufficient role permissions |
| `404` | Not Found | Route or requested document does not exist |
| `409` | Conflict | Duplicate unique key (e.g. email) or batch capacity reached |
| `422` | Validation Error | Yup schema validation error with field-level details |
| `429` | Too Many Requests | Rate limit threshold exceeded |
| `500` | Internal Error | Unhandled server exception |

---

## 10. Testing Suite

The repository includes a comprehensive Jest integration test suite testing all modules with live database operations.

```bash
# Run all tests
npm test

# Run a specific suite
npx jest src/app.test.js --forceExit
npx jest src/modules/members/member.test.js --forceExit
npx jest src/modules/trainers/trainer.test.js --forceExit
npx jest src/middleware/middleware.test.js --forceExit
```

### Test Suite Structure
```text
PASS src/modules/members/member.test.js   (11 tests: CRUD, BMI computation, toggle, convert, soft-delete)
PASS src/modules/trainers/trainer.test.js (11 tests: CRUD, batch sync, status toggle, soft-delete)
PASS src/app.test.js                     (9 tests: Health, API directory, CORS, 404, route mounting)
PASS src/middleware/middleware.test.js   (11 tests: Auth JWT verification, roles, Yup validator)

Test Suites: 4 passed, 4 total
Tests:       42 passed, 42 total
Snapshots:   0 total
```

---

## 11. Annotated Project Structure

```text
StrengthwayBackend/
├── src/
│   ├── app.js                          # Express 5 application setup & middleware stack
│   ├── server.js                       # Entry point, DB connection, & graceful shutdown
│   ├── app.test.js                     # Phase 7 integration suite
│   │
│   ├── config/
│   │   ├── env.js                      # Env validation, defaults & freezing
│   │   ├── database.js                 # MongoDB connection manager with retry backoff
│   │   └── cloudinary.js               # Cloudinary SDK configuration
│   │
│   ├── shared/
│   │   ├── apiError.js                 # Standardized ApiError class hierarchy
│   │   ├── response.js                 # Success, paginated & error JSON helpers
│   │   ├── constants.js                # System enums & ID prefixes
│   │   ├── idGenerator.js              # Custom sequential ID generator
│   │   ├── dateUtils.js                # Age, BMI, and membership calculation logic
│   │   └── pagination.js               # Pagination parsing and result formatting
│   │
│   ├── middleware/
│   │   ├── auth.middleware.js          # JWT authentication & optional authentication
│   │   ├── error.middleware.js         # Centralized error handler & Mongoose formatter
│   │   ├── logger.middleware.js        # Morgan HTTP request logger
│   │   ├── notFound.middleware.js      # 404 catch-all router
│   │   ├── rateLimit.middleware.js     # Rate limiter (auto-skipped during tests)
│   │   ├── role.middleware.js          # Role-based access control (RBAC)
│   │   ├── validate.middleware.js      # Yup schema validation middleware
│   │   └── middleware.test.js          # Middleware test suite
│   │
│   ├── modules/
│   │   ├── auth/                       # Auth module: register, login, refresh, me
│   │   ├── members/                    # Members module: CRUD, lead conversion, soft delete
│   │   ├── trainers/                   # Trainers module: CRUD, batch synchronization
│   │   ├── membership-plans/           # Membership plans module
│   │   ├── batches/                    # Batch scheduling & enrollment module
│   │   └── uploads/                    # Cloudinary media upload module
│   │
│   └── seeds/
│       ├── seed.js                     # Master seeder orchestrator (npm run seed)
│       ├── seed.admin.js               # Default admin user seeder (npm run seed:admin)
│       ├── plans.seed.js               # Membership plans seed runner
│       ├── trainers.seed.js            # Trainers seed runner
│       ├── batches.seed.js             # Batches seed runner
│       ├── members.seed.js             # Members seed runner
│       └── data/                       # Seed dataset files
│
├── .env.example                        # Template for environment configuration
├── .gitignore                          # Git exclusions
├── package.json                        # Dependencies, scripts, and Jest config
└── README.md                           # Documentation
```

---

## 12. Frontend Integration Guide

The frontend React application running on `http://localhost:5173` communicates seamlessly with this API:

1. **CORS is Pre-Configured**: `CLIENT_ORIGIN` is configured to `http://localhost:5173` with credentials enabled.
2. **Identical Data Shapes**: All field names, types, and validation error messages match frontend schemas (`Yup` schemas on both ends).
3. **Transparent IDs**: URLs using `MEM-2001` or `TRN-101` match the MongoDB custom string `id` field.
4. **JWT Header**: Attach the token returned by `/api/v1/auth/login` as an HTTP header:
   ```http
   Authorization: Bearer <token>
   ```

---

## 13. Key Architectural Decisions

- **Custom String IDs (`MEM-2001`, `TRN-101`)**: Matches URLs and localStorage keys from the client without exposing internal database ObjectIDs.
- **Repository Pattern**: All database access is encapsulated inside repositories (`*.repository.js`), making services decoupled, maintainable, and testable.
- **Denormalized Snapshots on Member**: Active `membershipPlan` details, batch timings, and computed `physicalStats` are stored on the member document for ultra-fast single-query profile loads without join queries.
- **Soft-Delete Architecture**: Archiving members sets `isDeleted: true` and `deletedAt: Date`, enabling full recovery while keeping them out of default active member queries.
