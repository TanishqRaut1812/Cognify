# Cognify — Online Aptitude Examination Platform

Cognify is a modern, high-concurrency online aptitude test and assessment management platform built for educational institutions.

## Production Architecture

```
Angular 18+ SPA (Vercel CDN)
         ↓ HTTPS / REST API
Node.js + Express + TypeScript Gateway (Render Web Service)
         ↓
Neon Serverless PostgreSQL  +  Neon S3 Object Storage
```

---

## Technical Stack & Infrastructure

- **Frontend**: Angular v18+ Standalone Components, TypeScript, CSS Custom Properties, HTML5 Fullscreen API.
- **Backend API Gateway**: Node.js v20+, Express, TypeScript, `pg` Connection Pool, JWT Authentication, Helmet Security Headers, `express-rate-limit`.
- **Database**: Neon PostgreSQL Serverless (Pool Max 20 Connections, SSL `verify-full`).
- **Object Storage**: Neon S3-Compatible Object Storage (6 Private Buckets: `question-papers`, `answer-keys`, `student-lists`, `question-lists`, `resources`, `backups`).

---

## Project Structure

```
Cognify/
├── cognify-angular/           # Angular Frontend Application
│   ├── src/
│   ├── vercel.json            # Vercel Deployment & SPA Routing Proxy Rules
│   └── package.json
│
├── backend/                   # Node.js Express TypeScript API Gateway
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── db/
│   │   ├── middleware/
│   │   ├── routes/
│   │   ├── services/
│   │   └── scripts/
│   │       ├── load-testing/  # 150 Candidate Synthetic Load Test Tooling
│   │       └── verification/  # Regression Test Suite
│   ├── migrations/            # Canonical Database Schema (01_schema.sql)
│   ├── package.json
│   └── tsconfig.json
│
├── examples/                  # Admin Sample Excel Templates
├── legacy/                    # Archived Historical Python/Flask Implementation
├── .env.example               # Root Environment Variables Template
└── README.md
```

---

## Local Development & Setup

### 1. Prerequisites
- Node.js v20+
- npm v10+

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Configure your NEON_DATABASE_URL and NEON_STORAGE credentials in backend/.env
npm run dev
```

### 3. Frontend Setup
```bash
cd cognify-angular
npm install
npm start
```
Access application at `http://localhost:4200`.

---

## Database Initialization & Migrations

To initialize a fresh database:
```bash
psql $NEON_DATABASE_URL -f backend/migrations/01_schema.sql
```

---

## Production Deployment Instructions

1. **Frontend Deployment (Vercel)**:
   - Deploy `cognify-angular` to Vercel.
   - SPA fallback rules and `/api/(.*)` rewrite proxying are pre-configured in `cognify-angular/vercel.json`.

2. **Backend Deployment (Render Web Service)**:
   - Deploy `backend` to Render Web Service.
   - Build Command: `npm run build`
   - Start Command: `npm start`
   - Health Check Path: `/api/health`

---

## Regression & Verification Testing

To run the complete backend regression test suite:
```bash
cd backend
npm run build
npx ts-node src/scripts/verification/verify_backend.ts
npx ts-node src/scripts/verification/verify_phase3b.ts
npx ts-node src/scripts/verification/verify_phase3c.ts
npx ts-node src/scripts/verification/verify_phase3d.ts
npx ts-node src/scripts/verification/verify_phase4c_security.ts
npx ts-node src/scripts/verification/verify_phase4c1_fullscreen.ts
```

To execute the 150-candidate synthetic load test:
```bash
cd backend
npx ts-node src/scripts/load-testing/load_test_150_candidates.ts
```

---

## Historical Archive Note

The `legacy/` directory contains historical Python/Flask backend and HTML frontend code. It is kept for historical reference only and is **not** part of the production application.
