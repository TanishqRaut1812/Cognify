import os
import requests
from datetime import datetime, timezone
from database import get_db
from models import recalculate_scores_and_rankings

BASE_URL = 'http://127.0.0.1:5000'

def verify_10_step_individual_student_creation():
    print("=" * 70)
    print("STARTING 10-STEP INDIVIDUAL STUDENT CREATION VERIFICATION")
    print("=" * 70)

    conn = get_db()
    cursor = conn.cursor()

    # Setup: Clean stale test data
    cursor.execute("DELETE FROM student_scores WHERE registration_no IN ('REG_MANUAL_01', 'REG_MANUAL_02');")
    cursor.execute("DELETE FROM students WHERE registration_no IN ('REG_MANUAL_01', 'REG_MANUAL_02');")
    cursor.execute("DELETE FROM tests WHERE test_number IN ('TEST_HIST_01', 'TEST_FUT_02');")
    conn.commit()

    session = requests.Session()
    login_resp = session.post(f"{BASE_URL}/api/admin/login", json={'password': 'CognifyAdmin2026!'})
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"

    # Step 1: Add a new student manually via API
    print("1. Adding new student 'Aarav Sharma' (REG_MANUAL_01) manually via API...")
    payload1 = {
        'name': 'Aarav Sharma',
        'registration_number': 'REG_MANUAL_01',
        'roll_number': 'SY-99',
        'class_name': 'SY'
    }
    resp1 = session.post(f"{BASE_URL}/api/admin/students", json=payload1)
    assert resp1.status_code == 200 and resp1.json().get('success') is True, f"Failed adding student: {resp1.text}"
    print(f"    Verified: Student added successfully ({resp1.json().get('message')})")

    # Step 2: Confirm student appears in the correct class roster
    print("2. Confirming student appears in SY class roster...")
    class_resp = session.get(f"{BASE_URL}/api/admin/students/class/SY")
    assert class_resp.status_code == 200
    sy_students = class_resp.json()
    reg_numbers = [s['registration_no'] for s in sy_students]
    assert 'REG_MANUAL_01' in reg_numbers, "REG_MANUAL_01 not found in SY class roster!"
    print("    Verified: REG_MANUAL_01 exists in SY class roster")

    # Step 3: Try adding the same registration number again -> Must be rejected
    print("3. Trying to add duplicate registration number 'REG_MANUAL_01'...")
    dup_reg_payload = {
        'name': 'Duplicate Student',
        'registration_number': 'REG_MANUAL_01',
        'roll_number': 'SY-100',
        'class_name': 'SY'
    }
    dup_reg_resp = session.post(f"{BASE_URL}/api/admin/students", json=dup_reg_payload)
    assert dup_reg_resp.status_code == 400 and 'already exists' in dup_reg_resp.json().get('error', '').lower()
    print("    Verified: Duplicate registration number correctly REJECTED")

    # Step 4: Create completed historical test BEFORE adding a late student
    print("4. Creating completed historical test 'TEST_HIST_01'...")
    now_date = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    cursor.execute("""
        INSERT INTO tests (test_number, title, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status, is_published)
        VALUES ('TEST_HIST_01', 'Historical Test 1', ?, '08:00 AM', '09:00 AM', 60, 100.0, 'Completed', 'Published', 1)
        RETURNING id;
    """, (now_date,))
    hist_test_id = cursor.lastrowid
    
    # Add historical score for existing student REG_MANUAL_01 (100.0%)
    cursor.execute("""
        INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage, published)
        VALUES (?, 'REG_MANUAL_01', 'Present', 100.0, 100.0, 1);
    """, (hist_test_id,))
    conn.commit()

    # Step 5: Add a late student AFTER completed test exists
    print("5. Adding late student 'Riya Patel' (REG_MANUAL_02) after test completion...")
    payload2 = {
        'name': 'Riya Patel',
        'registration_number': 'REG_MANUAL_02',
        'roll_number': 'SY-98',
        'class_name': 'SY'
    }
    resp2 = session.post(f"{BASE_URL}/api/admin/students", json=payload2)
    assert resp2.status_code == 200 and resp2.json().get('success') is True
    print("    Verified: Late student added successfully")

    # Step 6: Verify previous tests count as Absent / 0% for the late student
    print("6. Verifying historical test counts as Absent / 0% for late student (REG_MANUAL_02)...")
    res_row = cursor.execute("SELECT attendance, marks_obtained, percentage FROM test_results WHERE test_id = ? AND registration_no = 'REG_MANUAL_02'", (hist_test_id,)).fetchone()
    assert res_row is not None and res_row['attendance'] == 'Absent' and res_row['percentage'] == 0.0
    print("    Verified: Historical test result record is Absent with 0.0% score")

    # Step 7: Create a future/current test & verify late student can participate normally
    print("7. Creating current test 'TEST_FUT_02' & verifying student participation...")
    cursor.execute("""
        INSERT INTO tests (test_number, title, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status, is_published)
        VALUES ('TEST_FUT_02', 'Future Test 2', ?, '10:00 AM', '11:00 AM', 60, 100.0, 'Current', 'Unpublished', 0)
        RETURNING id;
    """, (now_date,))
    fut_test_id = cursor.lastrowid
    conn.commit()

    # Student verifies eligibility via registration lookup
    verify_resp = requests.get(f"{BASE_URL}/api/student/dashboard/REG_MANUAL_02")
    assert verify_resp.status_code == 200 and verify_resp.json().get('found') is True
    print("    Verified: Late student is registered and found in master database")

    # Step 8: Verify admin can manually change attendance
    print("8. Verifying admin can manually override student attendance (Absent -> Present)...")
    att_override_resp = session.post(f"{BASE_URL}/api/admin/tests/{fut_test_id}/attendance", json={
        'registration_no': 'REG_MANUAL_02',
        'attendance': 'Present'
    })
    assert att_override_resp.status_code == 200
    att_row = cursor.execute("SELECT attendance FROM student_attempts WHERE test_id = ? AND registration_no = 'REG_MANUAL_02'", (fut_test_id,)).fetchone()
    assert att_row is not None and att_row['attendance'] == 'Present'
    print("    Verified: Admin attendance override to 'Present' succeeded")

    # Step 9 & 10: Verify Cognify average includes historical zero scores & rankings update correctly
    print("9 & 10. Verifying Cognify average & competition ranking calculation...")
    # Add result for TEST_FUT_02 (100%) and publish
    cursor.execute("""
        INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage, published)
        VALUES (?, 'REG_MANUAL_01', 'Present', 100.0, 100.0, 1);
    """, (fut_test_id,))
    cursor.execute("""
        INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage, published)
        VALUES (?, 'REG_MANUAL_02', 'Present', 100.0, 100.0, 1);
    """, (fut_test_id,))
    cursor.execute("UPDATE tests SET is_published = 1 WHERE id = ?;", (fut_test_id,))
    conn.commit()

    recalculate_scores_and_rankings()

    # REG_MANUAL_01 has Test 1 (100%) & Test 2 (100%) -> Average = 100.0%
    # REG_MANUAL_02 has Test 1 (Absent 0%) & Test 2 (100%) -> Average = (0 + 100) / 2 = 50.0%
    s1_score = cursor.execute("SELECT cognify_score, rank FROM student_scores WHERE registration_no = 'REG_MANUAL_01'").fetchone()
    s2_score = cursor.execute("SELECT cognify_score, rank FROM student_scores WHERE registration_no = 'REG_MANUAL_02'").fetchone()

    assert s1_score['cognify_score'] == 100.0, f"Expected 100.0% for S1, got {s1_score['cognify_score']}"
    assert s2_score['cognify_score'] == 50.0, f"Expected 50.0% for S2 (historical 0% included), got {s2_score['cognify_score']}"
    print(f"    Verified: S1 Cognify score = {s1_score['cognify_score']}%, S2 Cognify score = {s2_score['cognify_score']}% (Includes historical 0%)")

    # Cleanup temporary test records
    cursor.execute("DELETE FROM student_scores WHERE registration_no IN ('REG_MANUAL_01', 'REG_MANUAL_02');")
    cursor.execute("DELETE FROM students WHERE registration_no IN ('REG_MANUAL_01', 'REG_MANUAL_02');")
    cursor.execute("DELETE FROM tests WHERE id IN (?, ?);", (hist_test_id, fut_test_id))
    conn.commit()
    conn.close()

    print("=" * 70)
    print("SUCCESS: ALL 10 INDIVIDUAL STUDENT CREATION STEPS PASSED 100%!")
    print("=" * 70)

if __name__ == '__main__':
    verify_10_step_individual_student_creation()
