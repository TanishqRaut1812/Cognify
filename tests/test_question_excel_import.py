import pytest
import os
import sys
import io
import openpyxl
from datetime import datetime

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app import app
from database import init_db, get_db
from excel_parser import parse_question_excel

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_cognify_excel_questions.db")
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

def create_mock_excel(rows_data):
    wb = openpyxl.Workbook()
    ws = wb.active
    for r in rows_data:
        ws.append(r)
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

def seed_test_data():
    conn = get_db()
    cursor = conn.cursor()

    today_str = datetime.now().strftime('%d/%m/%y')
    cursor.execute("INSERT INTO students VALUES ('REG100', 'SY-10', 'Charlie', 'SY')")
    cursor.execute("""
        INSERT INTO tests (id, test_number, test_name, test_date, start_time, finish_time, total_marks, status, is_published, duration_minutes)
        VALUES (10, 'T10', 'Logic Test', ?, '12:00 AM', '11:59 PM', 2.0, 'Current', 0, 60)
    """, (today_str,))

    conn.commit()
    conn.close()

def test_excel_parser_valid_workbook():
    rows = [
        ['Question No.', 'Question Prompt', 'Opt A', 'Opt B', 'Opt C', 'Opt D', 'Correct Answer', 'Marks'],
        [1, 'What is 10 + 10?', '15', '20', '25', '30', 'B', 1.0],
        [2, 'Which is a primary color?', 'Green', 'Orange', 'Red', 'Purple', 'Option C', 1.0]
    ]
    stream = create_mock_excel(rows)
    res = parse_question_excel(stream, total_test_marks=2.0)

    assert res['valid'] is True
    assert res['total_detected'] == 2
    assert res['valid_count'] == 2
    assert res['invalid_count'] == 0
    assert len(res['errors']) == 0
    assert res['questions'][0]['correct_option'] == 'B'
    assert res['questions'][1]['correct_option'] == 'C'

def test_excel_parser_validation_errors():
    rows = [
        ['Q No', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer'],
        [1, 'Valid Question', 'A1', 'B1', 'C1', 'D1', 'E'], # Invalid answer E
        [2, '', 'A2', 'B2', 'C2', 'D2', 'A'],             # Missing prompt
        [3, 'Missing Opt C', 'A3', 'B3', '', 'D3', 'B'],     # Missing Opt C
        [1, 'Duplicate Q No', 'A4', 'B4', 'C4', 'D4', 'D']   # Duplicate Q No 1
    ]
    stream = create_mock_excel(rows)
    res = parse_question_excel(stream, total_test_marks=4.0)

    assert res['valid'] is False
    assert res['invalid_count'] == 4
    assert any("must be A, B, C, or D" in err for err in res['errors'])
    assert any("Question text is missing" in err for err in res['errors'])
    assert any("Option C is missing" in err for err in res['errors'])
    assert any("Duplicate question number 1" in err for err in res['errors'])

def test_admin_validate_and_import_excel_endpoints(client):
    seed_test_data()
    login_admin(client)

    rows = [
        ['Question Number', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option'],
        [1, 'Capital of France?', 'London', 'Berlin', 'Paris', 'Rome', 'C'],
        [2, 'Square root of 16?', '2', '4', '8', '16', 'B']
    ]
    stream = create_mock_excel(rows)

    # 1. Validate endpoint
    res_val = client.post('/api/admin/tests/10/questions/validate-excel', data={
        'file': (stream, 'questions.xlsx')
    }, content_type='multipart/form-data')

    assert res_val.status_code == 200
    val_data = res_val.get_json()
    assert val_data['valid'] is True
    assert len(val_data['questions']) == 2
    assert val_data['existing_questions_count'] == 0

    # 2. Import endpoint
    res_imp = client.post('/api/admin/tests/10/questions/import-excel', json={
        'questions': val_data['questions']
    })

    assert res_imp.status_code == 200
    imp_data = res_imp.get_json()
    assert imp_data['success'] is True
    assert imp_data['count'] == 2

    # Check DB
    conn = get_db()
    questions = conn.execute("SELECT * FROM test_questions WHERE test_id = 10 AND is_active = 1 ORDER BY question_number ASC").fetchall()
    conn.close()

    assert len(questions) == 2
    assert questions[0]['correct_option'] == 'C'
    assert questions[1]['correct_option'] == 'B'

def test_question_version_integrity_and_security(client):
    seed_test_data()

    # Admin imports V1 questions
    login_admin(client)
    v1_rows = [
        ['Q', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Key'],
        [1, 'V1 Q1', 'A1', 'B1', 'C1', 'D1', 'A']
    ]
    stream_v1 = create_mock_excel(v1_rows)
    res_v1 = client.post('/api/admin/tests/10/questions/validate-excel', data={'file': (stream_v1, 'v1.xlsx')}, content_type='multipart/form-data')
    client.post('/api/admin/tests/10/questions/import-excel', json={'questions': res_v1.get_json()['questions']})

    # Student starts attempt
    with client.session_transaction() as sess:
        sess.clear()

    res_start = client.post('/api/student/start-attempt', json={'registration_no': 'REG100', 'test_id': 10})
    assert res_start.status_code == 200
    start_data = res_start.get_json()
    attempt_id = start_data['attempt_id']
    q_payload = start_data['questions']

    # Security check: correct_option MUST NOT BE IN STUDENT PAYLOAD!
    assert 'correct_option' not in q_payload[0]
    assert q_payload[0]['question_text'] == 'V1 Q1'

    # Student saves answer A (Correct for V1)
    q_id_v1 = q_payload[0]['id']
    client.post('/api/student/save-answer', json={'attempt_id': attempt_id, 'question_id': q_id_v1, 'selected_option': 'A'})

    # Admin now replaces question set with V2 questions (Different correct answer B)
    login_admin(client)
    v2_rows = [
        ['Q', 'Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Key'],
        [1, 'V2 Q1', 'A2', 'B2', 'C2', 'D2', 'B']
    ]
    stream_v2 = create_mock_excel(v2_rows)
    res_v2 = client.post('/api/admin/tests/10/questions/validate-excel', data={'file': (stream_v2, 'v2.xlsx')}, content_type='multipart/form-data')
    client.post('/api/admin/tests/10/questions/import-excel', json={'questions': res_v2.get_json()['questions']})

    # Verify student attempt calculated score remains 1.0 (linked to original V1 question ID)
    conn = get_db()
    attempt = conn.execute("SELECT calculated_score FROM student_attempts WHERE id = ?", (attempt_id,)).fetchone()
    active_questions = conn.execute("SELECT * FROM test_questions WHERE test_id = 10 AND is_active = 1").fetchall()
    conn.close()

    assert attempt['calculated_score'] == 1.0
    assert len(active_questions) == 1
    assert active_questions[0]['question_text'] == 'V2 Q1'
