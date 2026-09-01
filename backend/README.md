# Cognify Backend Engine

Production Node.js + Express + TypeScript API gateway for Cognify, connecting the Angular frontend securely with Neon PostgreSQL and Neon Object Storage (S3-compatible).

---

## Prerequisites

- **Node.js**: v18.x or v20.x or newer
- **npm**: v9.x or newer
- **Neon PostgreSQL**: Active database instance
- **Neon Object Storage**: Provisioned S3-compatible bucket storage

---

## Environment Configuration

Create a file named `.env` in the `backend/` directory (or use `backend/.env.example` as a template).

> **IMPORTANT**: Never commit `backend/.env` to Git. Keep `backend/.env` listed in `.gitignore`.

### Required Environment Variables

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Neon PostgreSQL Database Connection (Pooled Endpoint)
NEON_DATABASE_URL=postgresql://<user>:<password>@<ep-pooler-domain>/<dbname>?sslmode=require

# Neon Object Storage (S3-Compatible) Configuration
NEON_STORAGE_ENDPOINT=https://<storage-domain>
NEON_STORAGE_REGION=us-east-2
NEON_STORAGE_ACCESS_KEY_ID=<your-access-key-id>
NEON_STORAGE_SECRET_ACCESS_KEY=<your-secret-access-key>

# Authentication & Security
ADMIN_PASSWORD_HASH=<bcrypt-password-hash>
JWT_SECRET=<super-secret-jwt-key>
JWT_EXPIRES_IN=12h
FRONTEND_URL=http://localhost:4200
```

---

## Installation & Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

---

## Running Development Server

To run the backend with automatic hot-reloading:

```bash
npm run dev
```

The API server will listen on `http://localhost:3000` (or `PORT` specified in `.env`).

---

## Building & Running in Production

1. Compile TypeScript code to JavaScript:
   ```bash
   npm run build
   ```
   Compiled output will be placed in `backend/dist/`.

2. Start production server:
   ```bash
   npm start
   ```

---

## Verification & Health Check Scripts

Run the automated backend foundation, public read API, admin API, and student exam engine verification suites:

```bash
# Phase 3A Foundation Verification
npx ts-node src/scripts/verify_backend.ts

# Phase 3B Public Read APIs Verification
npx ts-node src/scripts/verify_phase3b.ts

# Phase 3C Admin APIs Verification
npx ts-node src/scripts/verify_phase3c.ts

# Phase 3D Student Exam Engine Verification
npx ts-node src/scripts/verify_phase3d.ts
```

---

## API Endpoints Overview

### Health Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/health` | Process health check |
| `GET` | `/api/health/db` | Database connection check & pool stats |
| `GET` | `/api/health/storage` | Neon Object Storage connectivity check |

### Public Read Endpoints (Phase 3B)

| Method | Endpoint | Query Parameters | Description |
| :--- | :--- | :--- | :--- |
| `GET` | `/api/classes` | None | List active Cognify classes (`SY`, `TY`, `Final Year`) |
| `GET` | `/api/tests` | `class`, `status` | List test metadata |
| `GET` | `/api/tests/:testId` | None | Fetch metadata for a specific test |
| `GET` | `/api/tests/:testId/questions` | None | Fetch test questions (withholds correct answers during active tests; 403 on upcoming) |
| `GET` | `/api/syllabus` | `class`, `testId` | Fetch syllabus categories and topics |
| `GET` | `/api/resources` | `class`, `testId`, `type` | Fetch resource metadata |
| `GET` | `/api/leaderboard` | `class` | Compute competition-ranked leaderboard (`1, 2, 2, 4`), top 10 positions |

### Student Exam Endpoints (Phase 3D)

| Method | Endpoint | Header / Auth | Description |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/student/verify` | None | Verify student registration number and return safe profile |
| `GET` | `/api/student/tests` | `registrationNumber` query | List available tests for student's class |
| `POST` | `/api/student/tests/:testId/start` | Body: `registrationNumber` | Start test attempt, return authoritative start time, deadline, and `attemptToken` |
| `GET` | `/api/student/attempts/:attemptId` | `Authorization: Bearer <attemptToken>` | Fetch attempt status, server start time, deadline, violation count |
| `GET` | `/api/student/attempts/:attemptId/questions` | `Authorization: Bearer <attemptToken>` | Fetch exam questions (omits `correctAnswer` fields) |
| `PUT` | `/api/student/attempts/:attemptId/answers/:questionId` | `Authorization: Bearer <attemptToken>` | Save student answer (idempotent upsert into `student_answers`) |
| `GET` | `/api/student/attempts/:attemptId/answers` | `Authorization: Bearer <attemptToken>` | Fetch saved answers for review / state restoration |
| `POST` | `/api/student/attempts/:attemptId/fullscreen-violation` | `Authorization: Bearer <attemptToken>` | Report fullscreen exit; 4th violation terminates attempt and flags cheating |
| `POST` | `/api/student/attempts/:attemptId/submit` | `Authorization: Bearer <attemptToken>` | Finalize attempt, calculate score server-side, create result record |
| `GET` | `/api/student/results` | `registrationNumber` query | Fetch student results (scores masked until admin publishes) |

### Admin Endpoints (Phase 3C) — Require JWT Authentication (`Authorization: Bearer <token>` or `admin_token` cookie)

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/admin/auth/login` | Admin login with password verification against `ADMIN_PASSWORD_HASH` |
| `POST` | `/api/admin/auth/logout` | Admin logout (clears session cookie) |
| `GET` | `/api/admin/auth/me` | Check admin authentication status |
| `GET` | `/api/admin/dashboard` | Aggregated dashboard metrics |
| `GET` | `/api/admin/students` | List students with search (`search`) and class (`class`) filters |
| `POST` | `/api/admin/students/import` | Bulk import students from Excel file, saves workbook to `student-lists` S3 bucket |
| `POST` | `/api/admin/tests/:testId/complete` | Explicitly mark test state as `Completed` |
| `POST` | `/api/admin/tests/:testId/publish` | Explicitly publish test results (`resultStatus = 'Published'`) |
| `POST` | `/api/admin/tests/:testId/unpublish` | Explicitly unpublish test results (`resultStatus = 'Unpublished'`) |
| `PUT` | `/api/admin/results/:id` | Admin override student score (`marksObtained`) |

---

## Business Rules & Security Highlights

1. **Attempt Token Security**: Each test attempt generates a cryptographically signed attempt JWT token. IDOR protection prevents one student from accessing or modifying another student's attempt.
2. **Authoritative Timing**: Attempt deadline is computed on server: `started_at + duration_minutes`. `finish_time` does NOT shorten an active student attempt.
3. **Automated Server-Side Scoring**: Scores are computed server-side by comparing saved student answers against database correct answers. Client score inputs are strictly ignored.
4. **Fullscreen Cheating Termination**: Incrementing fullscreen violations beyond 3 automatically sets `attempt_status = 'Terminated'`, `cheating_flag = 1`, and blocks further answer submissions.
5. **Result Publication Gating**: Exam scores remain strictly hidden from student endpoints until admin publishes test results (`resultStatus === 'Published'`).
