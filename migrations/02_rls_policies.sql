-- Cognify RLS Policies & Views Migration (02_rls_policies.sql)

-- 1. SECURE STUDENT QUESTIONS VIEW (Excludes correct_answer)
CREATE OR REPLACE VIEW student_questions AS
SELECT id, test_id, question_number, question_text, option_a, option_b, option_c, option_d, marks
FROM questions
WHERE is_active = 1;

-- 2. ENABLE RLS ON ALL TABLES
ALTER TABLE classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE question_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE test_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE student_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE syllabus ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backups ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_settings ENABLE ROW LEVEL SECURITY;

-- 3. DROP EXISTING POLICIES IF PRESENT
DROP POLICY IF EXISTS "Public select classes" ON classes;
DROP POLICY IF EXISTS "Public select tests" ON tests;
DROP POLICY IF EXISTS "Public select rankings" ON student_scores;
DROP POLICY IF EXISTS "Public select syllabus" ON syllabus;
DROP POLICY IF EXISTS "Public select resources" ON resources;
DROP POLICY IF EXISTS "Student select published results" ON test_results;
DROP POLICY IF EXISTS "Student select attempts" ON student_attempts;
DROP POLICY IF EXISTS "Student select answers" ON student_answers;
DROP POLICY IF EXISTS "Admin full access classes" ON classes;
DROP POLICY IF EXISTS "Admin full access students" ON students;
DROP POLICY IF EXISTS "Admin full access tests" ON tests;
DROP POLICY IF EXISTS "Admin full access questions" ON questions;
DROP POLICY IF EXISTS "Admin full access attempts" ON student_attempts;
DROP POLICY IF EXISTS "Admin full access answers" ON student_answers;
DROP POLICY IF EXISTS "Admin full access attendance" ON attendance;
DROP POLICY IF EXISTS "Admin full access results" ON test_results;
DROP POLICY IF EXISTS "Admin full access scores" ON student_scores;
DROP POLICY IF EXISTS "Admin full access resources" ON resources;
DROP POLICY IF EXISTS "Admin full access syllabus" ON syllabus;
DROP POLICY IF EXISTS "Admin full access audit" ON audit_logs;
DROP POLICY IF EXISTS "Admin full access backups" ON backups;
DROP POLICY IF EXISTS "Admin full access settings" ON system_settings;

-- 4. PUBLIC POLICIES
CREATE POLICY "Public select classes" ON classes FOR SELECT USING (true);
CREATE POLICY "Public select tests" ON tests FOR SELECT USING (true);
CREATE POLICY "Public select rankings" ON student_scores FOR SELECT USING (true);
CREATE POLICY "Public select syllabus" ON syllabus FOR SELECT USING (true);
CREATE POLICY "Public select resources" ON resources FOR SELECT USING (visibility = 'public');

-- 5. STUDENT RESTRICTED POLICIES
CREATE POLICY "Student select published results" ON test_results FOR SELECT
USING (published = 1);

CREATE POLICY "Student select attempts" ON student_attempts FOR SELECT
USING (true);

CREATE POLICY "Student insert attempts" ON student_attempts FOR INSERT
WITH CHECK (true);

CREATE POLICY "Student update attempts" ON student_attempts FOR UPDATE
USING (attempt_status = 'In Progress');

CREATE POLICY "Student select answers" ON student_answers FOR SELECT
USING (true);

CREATE POLICY "Student insert answers" ON student_answers FOR INSERT
WITH CHECK (true);

CREATE POLICY "Student update answers" ON student_answers FOR UPDATE
USING (true);

-- 6. ADMIN / SERVICE ROLE POLICIES
CREATE POLICY "Admin full access classes" ON classes FOR ALL USING (true);
CREATE POLICY "Admin full access students" ON students FOR ALL USING (true);
CREATE POLICY "Admin full access tests" ON tests FOR ALL USING (true);
CREATE POLICY "Admin full access questions" ON questions FOR ALL USING (true);
CREATE POLICY "Admin full access question_versions" ON question_versions FOR ALL USING (true);
CREATE POLICY "Admin full access attempts" ON student_attempts FOR ALL USING (true);
CREATE POLICY "Admin full access answers" ON student_answers FOR ALL USING (true);
CREATE POLICY "Admin full access attendance" ON attendance FOR ALL USING (true);
CREATE POLICY "Admin full access results" ON test_results FOR ALL USING (true);
CREATE POLICY "Admin full access scores" ON student_scores FOR ALL USING (true);
CREATE POLICY "Admin full access resources" ON resources FOR ALL USING (true);
CREATE POLICY "Admin full access syllabus" ON syllabus FOR ALL USING (true);
CREATE POLICY "Admin full access audit" ON audit_logs FOR ALL USING (true);
CREATE POLICY "Admin full access backups" ON backups FOR ALL USING (true);
CREATE POLICY "Admin full access settings" ON system_settings FOR ALL USING (true);
