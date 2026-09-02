-- CLEAN COGNIFY POSTGRESQL MIGRATION SCHEMA (Phase 2 Clean Rebuild)
-- Derived strictly from original baseline commit a5a3755 SQLite data model

-- 1. STUDENTS TABLE
CREATE TABLE IF NOT EXISTS students (
    registration_no VARCHAR(64) PRIMARY KEY,
    roll_no VARCHAR(64) NOT NULL,
    name VARCHAR(255) NOT NULL,
    class_name VARCHAR(32) NOT NULL CHECK (class_name IN ('SY', 'TY', 'Final Year'))
);

CREATE INDEX IF NOT EXISTS idx_students_class ON students(class_name);

-- 2. TESTS TABLE
CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    test_number VARCHAR(64) NOT NULL,
    test_name VARCHAR(255) NOT NULL,
    test_date VARCHAR(64) NOT NULL,
    total_marks NUMERIC(8,2) NOT NULL CHECK (total_marks > 0),
    status VARCHAR(32) NOT NULL CHECK (status IN ('Upcoming', 'Current', 'Completed')),
    is_published INT NOT NULL DEFAULT 0,
    duration_minutes INT NOT NULL DEFAULT 60,
    instructions TEXT DEFAULT '',
    start_time VARCHAR(32) NOT NULL DEFAULT '10:00 AM',
    finish_time VARCHAR(32) NOT NULL DEFAULT '11:00 AM',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_tests_published ON tests(is_published);

-- 3. SYLLABUS CATEGORIES TABLE
CREATE TABLE IF NOT EXISTS syllabus_categories (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    category_name VARCHAR(255) NOT NULL,
    topics_json TEXT NOT NULL,
    display_order INT DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_syllabus_categories_test ON syllabus_categories(test_id);

-- 4. RESOURCES TABLE
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    resource_type VARCHAR(32) NOT NULL CHECK (resource_type IN ('notes', 'practice', 'question_paper', 'answer_key')),
    title VARCHAR(255) NOT NULL,
    file_path TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_resources_test ON resources(test_id);

-- 5. TEST QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS test_questions (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_number INT NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option VARCHAR(4) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    marks NUMERIC(6,2) NOT NULL DEFAULT 1.0,
    is_active INT NOT NULL DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_questions_test ON test_questions(test_id);

-- 6. STUDENT ATTEMPTS TABLE
CREATE TABLE IF NOT EXISTS student_attempts (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    registration_no VARCHAR(64) NOT NULL REFERENCES students(registration_no) ON DELETE CASCADE,
    attempt_status VARCHAR(32) NOT NULL CHECK (attempt_status IN ('Not Started', 'In Progress', 'Submitted', 'Terminated')),
    attendance VARCHAR(32) NOT NULL DEFAULT 'Absent' CHECK (attendance IN ('Present', 'Absent')),
    is_late_attempt INT NOT NULL DEFAULT 0,
    violation_count INT NOT NULL DEFAULT 0,
    fullscreen_violation_count INT NOT NULL DEFAULT 0,
    cheating_flag INT NOT NULL DEFAULT 0,
    violation_logs_json TEXT DEFAULT '[]',
    start_time TIMESTAMPTZ,
    end_time TIMESTAMPTZ,
    started_at TIMESTAMPTZ,
    submitted_at TIMESTAMPTZ,
    calculated_score NUMERIC(8,2) DEFAULT 0.0,
    calculated_percentage NUMERIC(6,2) DEFAULT 0.0,
    score NUMERIC(8,2) DEFAULT 0.0,
    percentage NUMERIC(6,2) DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_attempts_test_reg UNIQUE (test_id, registration_no)
);

CREATE INDEX IF NOT EXISTS idx_attempts_test ON student_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_reg ON student_attempts(registration_no);

-- 7. STUDENT ANSWERS TABLE
CREATE TABLE IF NOT EXISTS student_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INT NOT NULL REFERENCES student_attempts(id) ON DELETE CASCADE,
    question_id INT NOT NULL REFERENCES test_questions(id) ON DELETE CASCADE,
    selected_option VARCHAR(4) CHECK (selected_option IN ('A', 'B', 'C', 'D', '')),
    saved_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_student_answers_attempt_q UNIQUE (attempt_id, question_id)
);

CREATE INDEX IF NOT EXISTS idx_answers_attempt ON student_answers(attempt_id);

-- 8. TEST RESULTS TABLE
CREATE TABLE IF NOT EXISTS test_results (
    id SERIAL PRIMARY KEY,
    test_id INT NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    registration_no VARCHAR(64) NOT NULL REFERENCES students(registration_no) ON DELETE CASCADE,
    attendance VARCHAR(32) NOT NULL CHECK (attendance IN ('Present', 'Absent')),
    marks_obtained NUMERIC(8,2) NOT NULL,
    percentage NUMERIC(6,2) NOT NULL,
    CONSTRAINT uq_test_results_test_reg UNIQUE (test_id, registration_no)
);

CREATE INDEX IF NOT EXISTS idx_results_test ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_results_reg ON test_results(registration_no);

-- 9. STUDENT SCORES TABLE
CREATE TABLE IF NOT EXISTS student_scores (
    registration_no VARCHAR(64) PRIMARY KEY REFERENCES students(registration_no) ON DELETE CASCADE,
    cognify_score NUMERIC(6,2) NOT NULL DEFAULT 0.0,
    completed_tests_count INT NOT NULL DEFAULT 0,
    rank INT NOT NULL DEFAULT 0,
    class_name VARCHAR(32) NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_student_scores_class ON student_scores(class_name);

-- 10. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(128) PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    action VARCHAR(255) NOT NULL,
    test_id INT,
    registration_no VARCHAR(64),
    previous_value TEXT,
    new_value TEXT
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_test ON audit_logs(test_id);
