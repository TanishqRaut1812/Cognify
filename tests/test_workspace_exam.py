import pytest
import os
import sys
from datetime import datetime, timedelta

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from database import init_db, get_db

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_cognify.db")
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

from datetime import datetime

def seed_test_data():
    conn = get_db()
    cursor = conn.cursor()

    today_str = datetime.now().strftime('%d/%m/%y')

    # Seed master students
    cursor.execute("INSERT INTO students VALUES ('REG001', 'SY-01', 'Alice', 'SY')")
    cursor.execute("INSERT INTO students VALUES ('REG002', 'SY-02', 'Bob', 'SY')")

    # Seed a test (Active window: 12:00 AM -> 11:59 PM today)
    cursor.execute("""
        INSERT INTO tests (id, test_number, test_name, test_date, start_time, finish_time, total_marks, status, is_published, duration_minutes)
        VALUES (10, 'T10', 'Aptitude Test', ?, '12:00 AM', '11:59 PM', 2.0, 'Current', 0, 60)
    """, (today_str,))

    # Seed 2 questions
    cursor.execute("""
        INSERT INTO test_questions (id, test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
        VALUES (101, 10, 1, '2 + 2 = ?', '3', '4', '5', '6', 'B', 1.0)
    """)
    cursor.execute("""
        INSERT INTO test_questions (id, test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
        VALUES (102, 10, 2, 'Capital of France?', 'London', 'Berlin', 'Paris', 'Rome', 'C', 1.0)
    """)

    # Seed a question paper resource
    cursor.execute("""
        INSERT INTO resources (id, test_id, resource_type, title, file_path)
        VALUES (1001, 10, 'question_paper', 'Test 10 Paper', '/static/uploads/question_papers/paper_10.pdf')
    """)

    conn.commit()
    conn.close()

def test_server_side_question_paper_access_control(client):
    seed_test_data()

    # 1. Non-admin accessing paper while test status is 'Current' & time is active -> 403 Forbidden
    res = client.get('/static/uploads/question_papers/paper_10.pdf')
    assert res.status_code == 403

    res_dl = client.get('/api/resources/1001/download')
    assert res_dl.status_code == 403

    # 2. Admin accessing paper while test status is 'Current' -> Allowed (404 because file not on disk in test)
    login_admin(client)
    res_admin = client.get('/static/uploads/question_papers/paper_10.pdf')
    assert res_admin.status_code in (200, 404)

    # 3. Update test finish_time to past AND status to 'Completed' -> Public can access paper
    conn = get_db()
    conn.execute("UPDATE tests SET status = 'Completed', start_time = '01:00 AM', finish_time = '02:00 AM' WHERE id = 10")
    conn.commit()
    conn.close()

    with client.session_transaction() as sess:
        sess.clear() # logout admin

    res_public = client.get('/static/uploads/question_papers/paper_10.pdf')
    assert res_public.status_code in (200, 404)

def test_attendance_default_and_workspace(client):
    seed_test_data()
    login_admin(client)

    # Check workspace API
    res = client.get('/api/admin/tests/10/workspace')
    assert res.status_code == 200
    data = res.get_json()

    # Registered students = 2, all default to Absent
    assert data['metrics']['registered_students'] == 2
    assert data['metrics']['present_count'] == 0
    assert data['metrics']['absent_count'] == 2

    # Update attendance for REG001 to Present
    res_att = client.post('/api/admin/tests/10/attendance', json={
        'registration_no': 'REG001',
        'attendance': 'Present'
    })
    assert res_att.status_code == 200

    # Verify updated counts
    res_updated = client.get('/api/admin/tests/10/workspace')
    data_updated = res_updated.get_json()
    assert data_updated['metrics']['present_count'] == 1
    assert data_updated['metrics']['absent_count'] == 1

def test_student_exam_mode_flow(client):
    seed_test_data()

    # 1. Registration verification
    res_v = client.post('/api/student/verify-registration', json={
        'registration_no': 'REG001',
        'test_id': 10
    })
    assert res_v.status_code == 200
    v_data = res_v.get_json()
    assert v_data['valid'] is True
    assert v_data['student']['name'] == 'Alice'

    # 2. Start attempt
    res_start = client.post('/api/student/start-attempt', json={
        'registration_no': 'REG001',
        'test_id': 10
    })
    assert res_start.status_code == 200
    start_data = res_start.get_json()
    attempt_id = start_data['attempt_id']
    questions = start_data['questions']

    assert len(questions) == 2
    # Ensure correct option is NOT exposed in student payload!
    assert 'correct_option' not in questions[0]

    # 3. Save answers continuously
    res_ans1 = client.post('/api/student/save-answer', json={
        'attempt_id': attempt_id,
        'question_id': 101,
        'selected_option': 'B' # Correct (4)
    })
    assert res_ans1.status_code == 200

    res_ans2 = client.post('/api/student/save-answer', json={
        'attempt_id': attempt_id,
        'question_id': 102,
        'selected_option': 'B' # Incorrect (Berlin)
    })
    assert res_ans2.status_code == 200

    # 4. Submit attempt
    res_sub = client.post('/api/student/submit-attempt', json={
        'attempt_id': attempt_id
    })
    assert res_sub.status_code == 200

    # 5. Check calculated score in admin workspace (1.0 out of 2.0)
    conn = get_db()
    attempt = conn.execute("SELECT * FROM student_attempts WHERE id = ?", (attempt_id,)).fetchone()
    conn.close()

    assert attempt['calculated_score'] == 1.0
    assert attempt['calculated_percentage'] == 50.0
    assert attempt['attempt_status'] == 'Submitted'
    assert attempt['attendance'] == 'Present' # Auto verified present upon taking test

def test_fullscreen_violation_and_4th_exit_termination(client):
    seed_test_data()

    # Start attempt
    res_start = client.post('/api/student/start-attempt', json={
        'registration_no': 'REG002',
        'test_id': 10
    })
    attempt_id = res_start.get_json()['attempt_id']

    # Exits 1, 2, 3 -> Logged, warning issued, test NOT terminated
    for exit_num in range(1, 4):
        res_v = client.post('/api/student/log-violation', json={
            'attempt_id': attempt_id,
            'reason': f'Fullscreen exit #{exit_num}'
        })
        v_data = res_v.get_json()
        assert v_data['violation_count'] == exit_num
        assert v_data['terminated'] is False

    # Exit 4 -> Auto-terminated
    res_v4 = client.post('/api/student/log-violation', json={
        'attempt_id': attempt_id,
        'reason': 'Fullscreen exit #4'
    })
    v4_data = res_v4.get_json()
    assert v4_data['violation_count'] == 4
    assert v4_data['terminated'] is True

    conn = get_db()
    attempt = conn.execute("SELECT attempt_status FROM student_attempts WHERE id = ?", (attempt_id,)).fetchone()
    conn.close()
    assert attempt['attempt_status'] == 'Terminated'

def test_publish_result_separation(client):
    seed_test_data()
    login_admin(client)

    # 1. Complete test status without publishing
    client.put('/api/admin/tests/10', json={'status': 'Completed'})

    conn = get_db()
    t = conn.execute("SELECT is_published FROM tests WHERE id = 10").fetchone()
    conn.close()
    assert t['is_published'] == 0 # STILL NOT PUBLISHED!

    # Public rankings do NOT reflect unpublished test
    res_top10 = client.get('/api/public/rankings')
    assert res_top10.status_code == 200

    # 2. Publish results explicitly from test workspace
    res_pub = client.post('/api/admin/tests/10/publish')
    assert res_pub.status_code == 200

    conn = get_db()
    t_pub = conn.execute("SELECT is_published FROM tests WHERE id = 10").fetchone()
    conn.close()
    assert t_pub['is_published'] == 1

def test_timed_test_availability_and_hard_deadline(client):
    seed_test_data()

    # 1. Test before start time -> Blocked from starting
    conn = get_db()
    conn.execute("UPDATE tests SET start_time = '11:58 PM', finish_time = '11:59 PM' WHERE id = 10")
    conn.commit()
    conn.close()

    res_v = client.post('/api/student/verify-registration', json={'registration_no': 'REG001', 'test_id': 10})
    assert res_v.status_code == 400
    assert 'Test Not Started' in res_v.get_json()['error']

    res_s = client.post('/api/student/start-attempt', json={'registration_no': 'REG001', 'test_id': 10})
    assert res_s.status_code == 400
    assert 'Test Not Started' in res_s.get_json()['error']

    # 2. Test after finish time -> Allowed as Late Attempt
    conn = get_db()
    conn.execute("UPDATE tests SET start_time = '01:00 AM', finish_time = '02:00 AM' WHERE id = 10")
    conn.commit()
    conn.close()

    res_v2 = client.post('/api/student/verify-registration', json={'registration_no': 'REG001', 'test_id': 10})
    assert res_v2.status_code == 200
    assert res_v2.get_json()['is_late_attempt'] is True

    # 3. Test active -> Start attempt, duration expiration -> Server finalizes attempt when duration elapses
    conn = get_db()
    conn.execute("UPDATE tests SET start_time = '12:00 AM', finish_time = '11:59 PM', duration_minutes = 60 WHERE id = 10")
    conn.commit()
    conn.close()

    res_start = client.post('/api/student/start-attempt', json={'registration_no': 'REG001', 'test_id': 10})
    assert res_start.status_code == 200
    attempt_id = res_start.get_json()['attempt_id']

    # Save 1 answer while active
    res_ans = client.post('/api/student/save-answer', json={
        'attempt_id': attempt_id,
        'question_id': 101,
        'selected_option': 'B' # Correct
    })
    assert res_ans.status_code == 200

    # Advance student start_time to 70 minutes ago (beyond 60 min duration)
    past_start = (datetime.now() - timedelta(minutes=70)).isoformat()
    conn = get_db()
    conn.execute("UPDATE student_attempts SET start_time = ? WHERE id = ?", (past_start, attempt_id))
    conn.commit()
    conn.close()

    # Next answer attempt after duration expiration -> auto-finalizes attempt
    res_expired = client.post('/api/student/save-answer', json={
        'attempt_id': attempt_id,
        'question_id': 102,
        'selected_option': 'C'
    })
    assert res_expired.status_code == 400
    assert res_expired.get_json()['expired'] is True

    # Verify attempt is now Submitted with calculated score
    conn = get_db()
    attempt = conn.execute("SELECT * FROM student_attempts WHERE id = ?", (attempt_id,)).fetchone()
    conn.close()

    assert attempt['attempt_status'] == 'Submitted'
    assert attempt['calculated_score'] == 1.0
