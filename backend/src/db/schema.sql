-- Cognify Production Neon PostgreSQL Schema Migration (schema.sql)

-- 1. CLASSES
CREATE TABLE IF NOT EXISTS classes (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT UNIQUE NOT NULL,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO classes (name, code) VALUES ('Second Year', 'SY') ON CONFLICT (code) DO NOTHING;
INSERT INTO classes (name, code) VALUES ('Third Year', 'TY') ON CONFLICT (code) DO NOTHING;
INSERT INTO classes (name, code) VALUES ('Final Year', 'Final Year') ON CONFLICT (code) DO NOTHING;

-- 2. STUDENTS
CREATE TABLE IF NOT EXISTS students (
    id SERIAL PRIMARY KEY,
    registration_number TEXT NOT NULL DEFAULT '',
    registration_no TEXT NOT NULL DEFAULT '',
    roll_number TEXT NOT NULL DEFAULT '',
    roll_no TEXT NOT NULL DEFAULT '',
    name TEXT NOT NULL,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    class_name TEXT NOT NULL CHECK(class_name IN ('SY', 'TY', 'Final Year')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_registration UNIQUE (registration_no)
);

CREATE OR REPLACE FUNCTION sync_student_registration()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.registration_no IS NULL OR NEW.registration_no = '' THEN
        NEW.registration_no := NEW.registration_number;
    END IF;
    IF NEW.registration_number IS NULL OR NEW.registration_number = '' THEN
        NEW.registration_number := NEW.registration_no;
    END IF;
    IF NEW.roll_no IS NULL OR NEW.roll_no = '' THEN
        NEW.roll_no := NEW.roll_number;
    END IF;
    IF NEW.roll_number IS NULL OR NEW.roll_number = '' THEN
        NEW.roll_number := NEW.roll_no;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_student_registration ON students;
CREATE TRIGGER trg_sync_student_registration
BEFORE INSERT OR UPDATE ON students
FOR EACH ROW EXECUTE FUNCTION sync_student_registration();

-- 3. TESTS
CREATE TABLE IF NOT EXISTS tests (
    id SERIAL PRIMARY KEY,
    test_number TEXT UNIQUE NOT NULL,
    title TEXT NOT NULL DEFAULT '',
    test_name TEXT NOT NULL DEFAULT '',
    class_id INTEGER REFERENCES classes(id) ON DELETE SET NULL,
    test_date TEXT NOT NULL,
    start_time TEXT NOT NULL DEFAULT '10:00 AM',
    finish_time TEXT NOT NULL DEFAULT '11:00 AM',
    duration_minutes INTEGER NOT NULL DEFAULT 60,
    total_marks REAL NOT NULL CHECK(total_marks > 0),
    status TEXT NOT NULL CHECK(status IN ('Upcoming', 'Current', 'Completed')),
    result_status TEXT NOT NULL DEFAULT 'Unpublished' CHECK(result_status IN ('Unpublished', 'Published')),
    is_published INTEGER NOT NULL DEFAULT 0,
    instructions TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION sync_test_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.title IS NULL OR NEW.title = '' THEN
        NEW.title := NEW.test_name;
    END IF;
    IF NEW.test_name IS NULL OR NEW.test_name = '' THEN
        NEW.test_name := NEW.title;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_test_fields ON tests;
CREATE TRIGGER trg_sync_test_fields
BEFORE INSERT OR UPDATE ON tests
FOR EACH ROW EXECUTE FUNCTION sync_test_fields();

-- 4. QUESTIONS
CREATE TABLE IF NOT EXISTS questions (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL DEFAULT 'A' CHECK(correct_answer IN ('A', 'B', 'C', 'D')),
    correct_option TEXT NOT NULL DEFAULT 'A' CHECK(correct_option IN ('A', 'B', 'C', 'D')),
    marks REAL NOT NULL DEFAULT 1.0,
    is_active INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE OR REPLACE FUNCTION sync_question_fields()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.correct_answer IS NULL OR NEW.correct_answer = '' OR NEW.correct_answer = 'A' THEN
        IF NEW.correct_option IS NOT NULL AND NEW.correct_option != '' THEN
            NEW.correct_answer := NEW.correct_option;
        END IF;
    END IF;
    IF NEW.correct_option IS NULL OR NEW.correct_option = '' OR NEW.correct_option = 'A' THEN
        IF NEW.correct_answer IS NOT NULL AND NEW.correct_answer != '' THEN
            NEW.correct_option := NEW.correct_answer;
        END IF;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_sync_question_fields ON questions;
CREATE TRIGGER trg_sync_question_fields
BEFORE INSERT OR UPDATE ON questions
FOR EACH ROW EXECUTE FUNCTION sync_question_fields();

-- 5. QUESTION VERSIONS
CREATE TABLE IF NOT EXISTS question_versions (
    id SERIAL PRIMARY KEY,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL DEFAULT 1,
    question_text TEXT NOT NULL,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_answer TEXT NOT NULL CHECK(correct_answer IN ('A', 'B', 'C', 'D')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 6. ATTEMPTS
CREATE TABLE IF NOT EXISTS student_attempts (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    registration_no TEXT NOT NULL,
    started_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    submitted_at TIMESTAMPTZ,
    attempt_status TEXT NOT NULL DEFAULT 'In Progress' CHECK(attempt_status IN ('Not Started', 'In Progress', 'Submitted', 'Terminated')),
    attendance TEXT NOT NULL DEFAULT 'Absent' CHECK(attendance IN ('Present', 'Absent')),
    is_late_attempt INTEGER NOT NULL DEFAULT 0,
    fullscreen_violation_count INTEGER NOT NULL DEFAULT 0,
    violation_count INTEGER NOT NULL DEFAULT 0,
    cheating_flag INTEGER NOT NULL DEFAULT 0,
    violation_logs_json TEXT DEFAULT '[]',
    start_time TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    end_time TIMESTAMPTZ,
    score REAL DEFAULT 0.0,
    calculated_score REAL DEFAULT 0.0,
    percentage REAL DEFAULT 0.0,
    calculated_percentage REAL DEFAULT 0.0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_student_test_attempt UNIQUE (test_id, registration_no)
);

-- 7. ANSWERS
CREATE TABLE IF NOT EXISTS student_answers (
    id SERIAL PRIMARY KEY,
    attempt_id INTEGER NOT NULL REFERENCES student_attempts(id) ON DELETE CASCADE,
    question_id INTEGER NOT NULL REFERENCES questions(id) ON DELETE CASCADE,
    question_version_id INTEGER REFERENCES question_versions(id) ON DELETE SET NULL,
    selected_answer TEXT DEFAULT '' CHECK(selected_answer IN ('A', 'B', 'C', 'D', '')),
    selected_option TEXT DEFAULT '' CHECK(selected_option IN ('A', 'B', 'C', 'D', '')),
    answered_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    saved_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_attempt_question UNIQUE (attempt_id, question_id)
);

-- 8. ATTENDANCE
CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    registration_no TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Absent' CHECK(status IN ('Present', 'Absent')),
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT DEFAULT 'Admin',
    CONSTRAINT unique_student_test_attendance UNIQUE (test_id, registration_no)
);

-- 9. RESULTS
CREATE TABLE IF NOT EXISTS test_results (
    id SERIAL PRIMARY KEY,
    test_id INTEGER NOT NULL REFERENCES tests(id) ON DELETE CASCADE,
    student_id INTEGER REFERENCES students(id) ON DELETE CASCADE,
    registration_no TEXT NOT NULL,
    attendance TEXT NOT NULL CHECK(attendance IN ('Present', 'Absent')),
    marks_obtained REAL NOT NULL DEFAULT 0.0,
    percentage REAL NOT NULL DEFAULT 0.0,
    published INTEGER NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT DEFAULT 'Admin',
    CONSTRAINT unique_student_test_result UNIQUE (test_id, registration_no)
);

-- 10. STUDENT SCORES (LEADERBOARD)
CREATE TABLE IF NOT EXISTS student_scores (
    registration_no TEXT PRIMARY KEY,
    cognify_score REAL NOT NULL DEFAULT 0.0,
    completed_tests_count INTEGER NOT NULL DEFAULT 0,
    rank INTEGER NOT NULL DEFAULT 0,
    class_name TEXT NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 11. RESOURCES
CREATE TABLE IF NOT EXISTS resources (
    id SERIAL PRIMARY KEY,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    resource_type TEXT NOT NULL CHECK(resource_type IN ('notes', 'practice', 'question_paper', 'answer_key')),
    title TEXT NOT NULL,
    storage_path TEXT NOT NULL DEFAULT '',
    file_path TEXT NOT NULL DEFAULT '',
    visibility TEXT NOT NULL DEFAULT 'public' CHECK(visibility IN ('public', 'completed_only', 'admin_only')),
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 12. SYLLABUS & CATEGORIES
CREATE TABLE IF NOT EXISTS syllabus (
    id SERIAL PRIMARY KEY,
    class_id INTEGER REFERENCES classes(id) ON DELETE CASCADE,
    test_id INTEGER REFERENCES tests(id) ON DELETE CASCADE,
    category_name TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT DEFAULT '',
    topics_json TEXT DEFAULT '[]',
    display_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 13. AUDIT LOGS
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    details TEXT,
    admin_identifier TEXT DEFAULT 'Admin',
    test_id INTEGER,
    registration_no TEXT,
    previous_value TEXT,
    new_value TEXT,
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 14. BACKUPS
CREATE TABLE IF NOT EXISTS backups (
    id SERIAL PRIMARY KEY,
    storage_path TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Completed',
    metadata TEXT DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- 15. SYSTEM SETTINGS
CREATE TABLE IF NOT EXISTS system_settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- INDEXES FOR HIGH-PERFORMANCE QUERYING
CREATE INDEX IF NOT EXISTS idx_students_registration ON students(registration_number);
CREATE INDEX IF NOT EXISTS idx_students_class_id ON students(class_id);
CREATE INDEX IF NOT EXISTS idx_tests_class_id ON tests(class_id);
CREATE INDEX IF NOT EXISTS idx_tests_status ON tests(status);
CREATE INDEX IF NOT EXISTS idx_attempts_test_id ON student_attempts(test_id);
CREATE INDEX IF NOT EXISTS idx_attempts_student_id ON student_attempts(student_id);
CREATE INDEX IF NOT EXISTS idx_attempts_reg ON student_attempts(registration_no);
CREATE INDEX IF NOT EXISTS idx_results_test_id ON test_results(test_id);
CREATE INDEX IF NOT EXISTS idx_results_student_id ON test_results(student_id);
CREATE INDEX IF NOT EXISTS idx_results_reg ON test_results(registration_no);
CREATE INDEX IF NOT EXISTS idx_attendance_test_id ON attendance(test_id);
CREATE INDEX IF NOT EXISTS idx_attendance_student_id ON attendance(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_reg ON attendance(registration_no);
