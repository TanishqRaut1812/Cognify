import pytest
import os
import sys
import io
import openpyxl
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from database import init_db, get_db

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_cognify_e2e.db")
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

def generate_student_list_excel():
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.append(['Registration Number', 'Roll Number', 'Name'])
    ws.append(['REG101', 'SY-01', 'Alice Smith'])
    ws.append(['REG102', 'SY-02', 'Bob Jones'])
    ws.append(['REG103', 'SY-03', 'Charlie Brown'])
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

def seed_e2e_test_data():
    conn = get_db()
    cursor = conn.cursor()

    cursor.execute("INSERT INTO students VALUES ('REG101', 'SY-01', 'Alice Smith', 'SY')")
    cursor.execute("INSERT INTO students VALUES ('REG102', 'SY-02', 'Bob Jones', 'SY')")
    cursor.execute("INSERT INTO students VALUES ('REG103', 'SY-03', 'Charlie Brown', 'SY')")

    today_str = datetime.now().strftime('%d/%m/%y')
    cursor.execute("""
        INSERT INTO tests (id, test_number, test_name, test_date, start_time, finish_time, total_marks, status, is_published, duration_minutes)
        VALUES (100, 'Test 01', 'Logic & Aptitude', ?, '12:00 AM', '11:59 PM', 10.0, 'Current', 0, 60)
    """, (today_str,))

    cursor.execute("""
        INSERT INTO test_questions (id, test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
        VALUES (1001, 100, 1, 'What is 5 + 5?', '8', '10', '12', '15', 'B', 5.0, 1)
    """)
    cursor.execute("""
        INSERT INTO test_questions (id, test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
        VALUES (1002, 100, 2, 'What is 10 * 2?', '15', '20', '25', '30', 'B', 5.0, 1)
    """)

    conn.commit()
    conn.close()

def test_student_list_excel_import_and_viewing(client):
    login_admin(client)
    excel_stream = generate_student_list_excel()

    # 1. Validate Excel
    res_val = client.post('/api/admin/students/validate', data={
        'class_name': 'SY',
        'file': (excel_stream, 'sy_students.xlsx')
    }, content_type='multipart/form-data')

    assert res_val.status_code == 200
    val_data = res_val.get_json()
    assert val_data['valid'] is True
    assert val_data['valid_count'] == 3

    # 2. Import Excel List
    res_imp = client.post('/api/admin/students/import', json={
        'class_name': 'SY',
        'parsed_students': val_data['parsed_students']
    })
    assert res_imp.status_code == 200
    assert res_imp.get_json()['success'] is True

    # 3. View Class Student List
    res_list = client.get('/api/admin/students/class/SY')
    assert res_list.status_code == 200
    students = res_list.get_json()
    assert len(students) == 3
    assert students[0]['registration_no'] == 'REG101'
    assert students[0]['roll_no'] == 'SY-01'

def test_admin_dashboard_stats_endpoint(client):
    seed_e2e_test_data()
    login_admin(client)

    res = client.get('/api/admin/dashboard-stats')
    assert res.status_code == 200
    data = res.get_json()
    assert data['total_students'] == 3
    assert data['class_counts']['SY'] == 3
    assert data['tests_summary']['current'] == 1

def test_end_to_end_student_exam_submit_and_published_dashboard(client):
    seed_e2e_test_data()

    # 1. Verify Registration
    res_v = client.post('/api/student/verify-registration', json={'registration_no': 'REG101', 'test_id': 100})
    assert res_v.status_code == 200
    assert res_v.get_json()['valid'] is True

    # 2. Start Attempt
    res_s = client.post('/api/student/start-attempt', json={'registration_no': 'REG101', 'test_id': 100})
    assert res_s.status_code == 200
    start_data = res_s.get_json()
    attempt_id = start_data['attempt_id']

    # 3. Save Answers
    res_a1 = client.post('/api/student/save-answer', json={'attempt_id': attempt_id, 'question_id': 1001, 'selected_option': 'B'})
    assert res_a1.status_code == 200

    res_a2 = client.post('/api/student/save-answer', json={'attempt_id': attempt_id, 'question_id': 1002, 'selected_option': 'B'})
    assert res_a2.status_code == 200

    # 4. Submit Attempt
    res_sub = client.post('/api/student/submit-attempt', json={'attempt_id': attempt_id})
    assert res_sub.status_code == 200
    sub_data = res_sub.get_json()
    assert sub_data['success'] is True
    # Verify score is NOT exposed in student submission response
    assert 'score' not in sub_data
    assert 'percentage' not in sub_data

    # 5. Check student dashboard BEFORE result publication -> empty list
    res_dash_pre = client.get('/api/student/dashboard/REG101')
    assert res_dash_pre.status_code == 200
    assert len(res_dash_pre.get_json()['results']) == 0

    # 6. Admin Publishes Results
    login_admin(client)
    res_pub = client.post('/api/admin/results/publish', json={
        'test_id': 100,
        'parsed_records': [
            {'registration_no': 'REG101', 'attendance': 'Present', 'marks_obtained': 10.0, 'percentage': 100.0}
        ],
        'missing_regs': ['REG102', 'REG103']
    })
    assert res_pub.status_code == 200

    # 7. Check student dashboard AFTER publication for Present Student (REG101)
    res_dash_post = client.get('/api/student/dashboard/REG101')
    assert res_dash_post.status_code == 200
    dash_data = res_dash_post.get_json()
    assert dash_data['found'] is True
    assert dash_data['cognify_score'] == 100.0
    assert len(dash_data['results']) == 1
    assert dash_data['results'][0]['percentage'] == 100.0
    assert dash_data['results'][0]['attendance'] == 'Present'

    # 8. Check student dashboard for Absent Student (REG102) -> score is 0%, Cognify score is 0%
    res_dash_absent = client.get('/api/student/dashboard/REG102')
    assert res_dash_absent.status_code == 200
    absent_data = res_dash_absent.get_json()
    assert absent_data['cognify_score'] == 0.0
    assert absent_data['results'][0]['attendance'] == 'Absent'
    assert absent_data['results'][0]['percentage'] == 0.0
