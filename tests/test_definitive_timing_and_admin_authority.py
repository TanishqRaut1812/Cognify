import pytest
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from database import init_db, get_db

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_cognify_final_spec.db")
    monkeypatch.setattr('database.DB_PATH', test_db)
    init_db()

@pytest.fixture
def client():
    app.config['TESTING'] = True
    with app.test_client() as client:
        yield client

def login_admin(client):
    with client.session_transaction() as sess:
        sess['is_admin'] = True

def seed_final_spec_data():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("INSERT INTO students VALUES ('REG901', 'SY-01', 'Alice Late', 'SY')")
    cursor.execute("INSERT INTO students VALUES ('REG902', 'SY-02', 'Bob Early', 'SY')")

    # Past test (Finish time passed)
    cursor.execute("""
        INSERT INTO tests (id, test_number, test_name, test_date, start_time, finish_time, total_marks, status, is_published, duration_minutes)
        VALUES (90, 'T90', 'Past Test', '01/01/20', '10:00 AM', '11:00 AM', 10.0, 'Completed', 0, 30)
    """)

    # Future test (Not started)
    cursor.execute("""
        INSERT INTO tests (id, test_number, test_name, test_date, start_time, finish_time, total_marks, status, is_published, duration_minutes)
        VALUES (91, 'T91', 'Future Test', '25/12/35', '10:00 AM', '11:00 AM', 10.0, 'Upcoming', 0, 30)
    """)

    # Active test (Today)
    today_str = datetime.now().strftime('%d/%m/%y')
    cursor.execute("""
        INSERT INTO tests (id, test_number, test_name, test_date, start_time, finish_time, total_marks, status, is_published, duration_minutes)
        VALUES (92, 'T92', 'Active Test', ?, '12:00 AM', '11:59 PM', 10.0, 'Current', 0, 60)
    """, (today_str,))

    # Questions for Test 90
    cursor.execute("""
        INSERT INTO test_questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
        VALUES (90, 1, 'Q1 text', 'A', 'B', 'C', 'D', 'A', 10.0, 1)
    """)

    conn.commit()
    conn.close()

def test_start_time_blocking(client):
    seed_final_spec_data()

    # Attempting to start Future Test (T91) before Start Time must be blocked
    res_val = client.post('/api/student/verify-registration', json={'registration_no': 'REG901', 'test_id': 91})
    assert res_val.status_code == 400
    assert "Test Not Started" in res_val.get_json()['error']

    res_start = client.post('/api/student/start-attempt', json={'registration_no': 'REG901', 'test_id': 91})
    assert res_start.status_code == 400
    assert "Test Not Started" in res_start.get_json()['error']

def test_late_attempt_after_finish_time(client):
    seed_final_spec_data()

    # Verify registration for Past Test (T90) -> returns valid with is_late_attempt = True
    res_val = client.post('/api/student/verify-registration', json={'registration_no': 'REG901', 'test_id': 90})
    assert res_val.status_code == 200
    val_data = res_val.get_json()
    assert val_data['valid'] is True
    assert val_data['is_late_attempt'] is True

    # Start attempt for Past Test (T90) -> allowed, flagged as late attempt, initial attendance = Absent
    res_start = client.post('/api/student/start-attempt', json={'registration_no': 'REG901', 'test_id': 90})
    assert res_start.status_code == 200
    start_data = res_start.get_json()
    assert start_data['attempt_id'] is not None
    assert start_data['test']['remaining_seconds'] > 0

    conn = get_db()
    att = conn.execute("SELECT * FROM student_attempts WHERE id = ?", (start_data['attempt_id'],)).fetchone()
    conn.close()

    assert att['is_late_attempt'] == 1
    assert att['attendance'] == 'Absent'

def test_active_attempt_save_answer_independent_of_finish_time(client):
    seed_final_spec_data()

    # Start attempt for Past Test (T90)
    res_start = client.post('/api/student/start-attempt', json={'registration_no': 'REG901', 'test_id': 90})
    attempt_id = res_start.get_json()['attempt_id']

    # Saving answer should succeed (Finish Time does NOT terminate active attempt)
    res_save = client.post('/api/student/save-answer', json={'attempt_id': attempt_id, 'question_id': 1, 'selected_option': 'A'})
    assert res_save.status_code == 200
    assert res_save.get_json()['success'] is True

def test_admin_attendance_override_and_audit_log(client):
    seed_final_spec_data()
    login_admin(client)

    # Admin overrides attendance for REG901 on Test 90 from Absent to Present
    res_att = client.post('/api/admin/tests/90/attendance', json={'registration_no': 'REG901', 'attendance': 'Present'})
    assert res_att.status_code == 200
    assert res_att.get_json()['success'] is True

    conn = get_db()
    att = conn.execute("SELECT attendance FROM student_attempts WHERE test_id = 90 AND registration_no = 'REG901'").fetchone()
    conn.close()

    assert att['attendance'] == 'Present'

    # Check Audit Logs
    res_audit = client.get('/api/admin/audit-logs')
    assert res_audit.status_code == 200
    logs = res_audit.get_json()
    assert len(logs) > 0
    assert any(l['action'] == 'ATTENDANCE_OVERRIDE' and l['registration_no'] == 'REG901' for l in logs)
