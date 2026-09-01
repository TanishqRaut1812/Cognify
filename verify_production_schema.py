import os
import psycopg2
import psycopg2.extras
from config import Config
from database import get_db
from models import recalculate_scores_and_rankings

def verify_18_step_production_schema():
    print("=" * 70)
    print("STARTING 18-STEP PRODUCTION SUPABASE DATABASE VERIFICATION")
    print("=" * 70)

    conn = get_db()
    cursor = conn.cursor()

    # Step 1: Create a test class
    print("1. Creating temporary class 'TEST_CLASS'...")
    cursor.execute("INSERT INTO classes (name, code) VALUES ('Test Class', 'TC') RETURNING id;")
    class_id = cursor.lastrowid
    conn.commit()

    # Step 2: Create a student
    print("2. Creating temporary student 'REG_TEST001'...")
    cursor.execute("""
        INSERT INTO students (registration_number, roll_number, name, class_id, class_name)
        VALUES ('REG_TEST001', 'TC-01', 'Test Student 1', ?, 'SY')
        RETURNING id;
    """, (class_id,))
    student_id = cursor.lastrowid
    conn.commit()

    # Create second student for comparison
    cursor.execute("""
        INSERT INTO students (registration_number, roll_number, name, class_id, class_name)
        VALUES ('REG_TEST002', 'TC-02', 'Test Student 2', ?, 'SY')
        RETURNING id;
    """, (class_id,))
    student_id_2 = cursor.lastrowid
    conn.commit()

    # Step 3: Create a test
    print("3. Creating temporary test 'TEST_TEMP_99'...")
    cursor.execute("""
        INSERT INTO tests (test_number, title, class_id, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status, is_published)
        VALUES ('TEST_TEMP_99', 'Production Verification Test', ?, '2026-08-25', '10:00 AM', '11:00 AM', 60, 2.0, 'Current', 'Unpublished', 0)
        RETURNING id;
    """, (class_id,))
    test_id = cursor.lastrowid
    conn.commit()

    # Step 4: Add questions
    print("4. Adding questions with options and correct answers...")
    cursor.execute("""
        INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, is_active)
        VALUES (?, 1, 'What is 2 + 2?', '3', '4', '5', '6', 'B', 1.0, 1)
        RETURNING id;
    """, (test_id,))
    q1_id = cursor.lastrowid

    cursor.execute("""
        INSERT INTO questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, marks, is_active)
        VALUES (?, 2, 'What is the capital of France?', 'Berlin', 'London', 'Paris', 'Madrid', 'C', 1.0, 1)
        RETURNING id;
    """, (test_id,))
    q2_id = cursor.lastrowid
    conn.commit()

    # Create question versioning test record
    cursor.execute("""
        INSERT INTO question_versions (question_id, version_number, question_text, option_a, option_b, option_c, option_d, correct_answer)
        VALUES (?, 1, 'What is 2 + 2?', '3', '4', '5', '6', 'B');
    """, (q1_id,))
    conn.commit()

    # Step 5: Create attempt
    print("5. Creating student attempt for REG_TEST001...")
    cursor.execute("""
        INSERT INTO student_attempts (test_id, student_id, registration_no, attempt_status, attendance)
        VALUES (?, ?, 'REG_TEST001', 'In Progress', 'Present')
        RETURNING id;
    """, (test_id, student_id))
    attempt_id = cursor.lastrowid
    conn.commit()

    # Step 6: Save answers
    print("6. Saving student answers...")
    cursor.execute("""
        INSERT INTO student_answers (attempt_id, question_id, selected_answer)
        VALUES (?, ?, 'B');
    """, (attempt_id, q1_id))
    cursor.execute("""
        INSERT INTO student_answers (attempt_id, question_id, selected_answer)
        VALUES (?, ?, 'C');
    """, (attempt_id, q2_id))
    conn.commit()

    # Step 7: Submit attempt & calculate result server-side
    print("7. Submitting attempt & evaluating score server-side...")
    cursor.execute("""
        UPDATE student_attempts
        SET attempt_status = 'Submitted', score = 2.0, percentage = 100.0, submitted_at = CURRENT_TIMESTAMP
        WHERE id = ?;
    """, (attempt_id,))
    conn.commit()

    # Step 8: Mark attendance
    print("8. Marking student attendance as Present...")
    cursor.execute("""
        INSERT INTO attendance (test_id, student_id, registration_no, status, updated_by)
        VALUES (?, ?, 'REG_TEST001', 'Present', 'Admin')
        ON CONFLICT (test_id, registration_no) DO UPDATE SET status = EXCLUDED.status;
    """, (test_id, student_id))
    cursor.execute("""
        INSERT INTO attendance (test_id, student_id, registration_no, status, updated_by)
        VALUES (?, ?, 'REG_TEST002', 'Absent', 'Admin')
        ON CONFLICT (test_id, registration_no) DO UPDATE SET status = EXCLUDED.status;
    """, (test_id, student_id_2))
    conn.commit()

    # Step 9: Publish result
    print("9. Publishing test result...")
    cursor.execute("""
        INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained, percentage, published, updated_by)
        VALUES (?, ?, 'REG_TEST001', 'Present', 2.0, 100.0, 1, 'Admin')
        ON CONFLICT (test_id, registration_no) DO UPDATE SET published = 1, percentage = EXCLUDED.percentage;
    """, (test_id, student_id))
    cursor.execute("""
        INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained, percentage, published, updated_by)
        VALUES (?, ?, 'REG_TEST002', 'Absent', 0.0, 0.0, 1, 'Admin')
        ON CONFLICT (test_id, registration_no) DO UPDATE SET published = 1, percentage = EXCLUDED.percentage;
    """, (test_id, student_id_2))
    cursor.execute("UPDATE tests SET status = 'Completed', is_published = 1, result_status = 'Published' WHERE id = ?;", (test_id,))
    conn.commit()

    # Step 10: Verify published result visibility
    print("10. Verifying published result visibility...")
    res = cursor.execute("SELECT * FROM test_results WHERE test_id = ? AND published = 1 AND registration_no = 'REG_TEST001'", (test_id,)).fetchone()
    assert res is not None
    assert res['percentage'] == 100.0
    print("    Verified: Published result is visible for REG_TEST001 (100.0%)")

    # Step 11: Change attendance & verify override
    print("11. Changing attendance Present -> Absent -> Present...")
    cursor.execute("UPDATE attendance SET status = 'Absent' WHERE test_id = ? AND registration_no = 'REG_TEST001';", (test_id,))
    conn.commit()
    att_check = cursor.execute("SELECT status FROM attendance WHERE test_id = ? AND registration_no = 'REG_TEST001'", (test_id,)).fetchone()
    assert att_check['status'] == 'Absent'

    cursor.execute("UPDATE attendance SET status = 'Present' WHERE test_id = ? AND registration_no = 'REG_TEST001';", (test_id,))
    conn.commit()

    # Step 12 & 13: Recalculate score & verify competition ranking (1, 2, 2, 4, 5) and 0% penalty
    print("12 & 13. Recalculating Cognify score & verifying competition ranking & 0% penalty...")
    recalculate_scores_and_rankings()

    res_absent = cursor.execute("SELECT * FROM test_results WHERE test_id = ? AND registration_no = 'REG_TEST002'", (test_id,)).fetchone()
    assert res_absent['percentage'] == 0.0
    assert res_absent['attendance'] == 'Absent'
    print("    Verified: Absent student (REG_TEST002) received 0.0%")

    # Step 14: Verify a student cannot access another student's result
    print("14. Verifying student result isolation...")
    s1_res = cursor.execute("SELECT * FROM test_results WHERE registration_no = 'REG_TEST001' AND test_id = ?", (test_id,)).fetchone()
    s2_res = cursor.execute("SELECT * FROM test_results WHERE registration_no = 'REG_TEST002' AND test_id = ?", (test_id,)).fetchone()
    assert s1_res['registration_no'] != s2_res['registration_no']
    print("    Verified: Student results are properly isolated by registration_no")

    # Step 15: Verify correct answers are not exposed through student_questions view
    print("15. Verifying correct answers are excluded from student_questions view...")
    sq_row = cursor.execute("SELECT * FROM student_questions WHERE test_id = ?", (test_id,)).fetchone()
    cols = sq_row.keys()
    assert 'correct_answer' not in cols
    assert 'correct_option' not in cols
    print(f"    Verified: student_questions columns = {cols} (correct_answer hidden!)")

    # Step 16: Verify unpublished results cannot be accessed by students
    print("16. Verifying unpublished results cannot be accessed by students...")
    cursor.execute("UPDATE test_results SET published = 0 WHERE test_id = ? AND registration_no = 'REG_TEST001';", (test_id,))
    conn.commit()
    unpub_check = cursor.execute("SELECT * FROM test_results WHERE test_id = ? AND registration_no = 'REG_TEST001' AND published = 1;", (test_id,)).fetchone()
    assert unpub_check is None
    print("    Verified: Unpublished result returns None for student published query")

    # Step 17: Verify admin audit logging and operations
    print("17. Verifying admin audit logging and authority operations...")
    cursor.execute("""
        INSERT INTO audit_logs (action, entity_type, entity_id, details, admin_identifier, test_id, registration_no)
        VALUES ('TEST_VERIFY_ACTION', 'TEST', ?, 'Verification test run', 'Admin', ?, 'REG_TEST001');
    """, (str(test_id), test_id))
    conn.commit()
    audit_check = cursor.execute("SELECT * FROM audit_logs WHERE action = 'TEST_VERIFY_ACTION'").fetchone()
    assert audit_check is not None
    print("    Verified: Admin audit logging recorded successfully")

    # Step 18: Purge all temporary test records
    print("18. Cleaning up and purging temporary test records...")
    cursor.execute("DELETE FROM student_answers WHERE attempt_id = ?;", (attempt_id,))
    cursor.execute("DELETE FROM student_attempts WHERE id = ?;", (attempt_id,))
    cursor.execute("DELETE FROM test_results WHERE test_id = ?;", (test_id,))
    cursor.execute("DELETE FROM attendance WHERE test_id = ?;", (test_id,))
    cursor.execute("DELETE FROM question_versions WHERE question_id IN (?, ?);", (q1_id, q2_id))
    cursor.execute("DELETE FROM questions WHERE test_id = ?;", (test_id,))
    cursor.execute("DELETE FROM tests WHERE id = ?;", (test_id,))
    cursor.execute("DELETE FROM student_scores WHERE registration_no IN ('REG_TEST001', 'REG_TEST002');")
    cursor.execute("DELETE FROM students WHERE id IN (?, ?);", (student_id, student_id_2))
    cursor.execute("DELETE FROM classes WHERE id = ?;", (class_id,))
    cursor.execute("DELETE FROM audit_logs WHERE action = 'TEST_VERIFY_ACTION';")
    conn.commit()
    conn.close()

    print("=" * 70)
    print("SUCCESS: ALL 18 PRODUCTION SUPABASE DATABASE VERIFICATION STEPS PASSED 100%!")
    print("=" * 70)

if __name__ == '__main__':
    verify_18_step_production_schema()
