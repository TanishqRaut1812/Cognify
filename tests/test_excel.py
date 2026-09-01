import pytest
import io
import openpyxl
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import init_db, get_db
from excel_processor import validate_excel_results, publish_test_results

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_cognify.db")
    monkeypatch.setattr('database.DB_PATH', test_db)
    init_db()

def create_mock_excel(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

def test_excel_validation_and_publishing():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO students VALUES ('REG101', 'SY-01', 'Alice', 'SY')")
    cursor.execute("INSERT INTO students VALUES ('REG102', 'SY-02', 'Bob', 'SY')")
    cursor.execute("INSERT INTO tests (id, test_number, test_name, test_date, total_marks, status) VALUES (1, 'T1', 'Test 1', '2026-01-01', 50, 'Current')")
    conn.commit()
    conn.close()

    # Valid Excel file
    valid_rows = [
        ["Registration Number", "Roll Number", "Name", "Attendance", "Score"],
        ["REG101", "SY-01", "Alice", "Present", 45],
        ["REG102", "SY-02", "Bob", "Absent", 0]
    ]
    excel_stream = create_mock_excel(valid_rows)

    res = validate_excel_results(excel_stream, 1)
    assert res['valid'] is True
    assert res['present_count'] == 1
    assert res['absent_count'] == 1
    assert len(res['parsed_records']) == 2

    # Publish results
    pub_res = publish_test_results(1, res['parsed_records'])
    assert pub_res['success'] is True

    # Verify DB insertion
    conn = get_db()
    results = conn.execute("SELECT * FROM test_results WHERE test_id = 1").fetchall()
    conn.close()
    assert len(results) == 2

def test_excel_validation_errors():
    conn = get_db()
    cursor = conn.cursor()
    cursor.execute("INSERT INTO students VALUES ('REG101', 'SY-01', 'Alice', 'SY')")
    cursor.execute("INSERT INTO tests (id, test_number, test_name, test_date, total_marks, status) VALUES (1, 'T1', 'Test 1', '2026-01-01', 50, 'Current')")
    conn.commit()
    conn.close()

    # Invalid score > total_marks (55 > 50) and duplicate student
    invalid_rows = [
        ["Registration Number", "Attendance", "Score"],
        ["REG101", "Present", 55],
        ["REG101", "Present", 40]
    ]
    excel_stream = create_mock_excel(invalid_rows)
    res = validate_excel_results(excel_stream, 1)

    assert res['valid'] is False
    assert len(res['errors']) >= 2
