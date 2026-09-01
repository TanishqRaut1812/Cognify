# Cognify Database Migrations & Initial Setup

This directory contains the canonical SQL schema definition for Cognify PostgreSQL database deployments.

## Initial Database Setup

To initialize a fresh production or staging Neon PostgreSQL database:

1. Execute `01_schema.sql` against your target PostgreSQL database using `psql` or the Neon Console:

```bash
psql $NEON_DATABASE_URL -f 01_schema.sql
```

2. `01_schema.sql` initializes:
   - All 15 required relational tables (`classes`, `students`, `tests`, `questions`, `student_attempts`, `student_answers`, `attendance`, `test_results`, `student_scores`, `syllabus`, `resources`, `audit_logs`, etc.).
   - Default class structures (`SY`, `TY`, `Final Year`).
   - Primary keys, foreign key constraints, composite unique keys (`(test_id, registration_no)`, `(attempt_id, question_id)`), and query performance indexes.

## Production Data Integrity Rules

- **Zero Destructive Resets**: Production deployment pipelines must NEVER run `DROP TABLE` or `TRUNCATE` operations against active PostgreSQL databases.
- **Future Schema Migrations**: Incremental schema modifications must be applied via forward-only ALTER scripts (e.g. `02_add_index.sql`).
