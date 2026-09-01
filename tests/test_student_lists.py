import pytest
import io
import openpyxl
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import init_db, get_db
from excel_processor import validate_student_list_excel, save_master_student_list

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_cognify.db")
    monkeypatch.setattr('database.DB_PATH', test_db)
    init_db()

def create_mock_student_excel(rows):
    wb = openpyxl.Workbook()
    ws = wb.active
    for r in rows:
        ws.append(r)
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

def test_student_list_validation_and_import():
    valid_rows = [
        ["Registration Number", "Roll Number", "Name"],
        ["REG2026SY001", "SY-01", "Aarav Sharma"],
        ["REG2026SY002", "SY-02", "Ananya Verma"]
    ]
    excel_stream = create_mock_student_excel(valid_rows)

    # Validate
    res = validate_student_list_excel(excel_stream, 'SY')
    assert res['valid'] is True
    assert res['valid_count'] == 2
    assert len(res['parsed_students']) == 2

    # Save
    save_res = save_master_student_list('SY', res['parsed_students'])
    assert save_res['success'] is True

    # Verify DB
    conn = get_db()
    students = conn.execute("SELECT * FROM students WHERE class_name = 'SY' ORDER BY registration_no").fetchall()
    conn.close()
    assert len(students) == 2
    assert students[0]['name'] == 'Aarav Sharma'

def test_student_list_duplicate_validation():
    invalid_rows = [
        ["Registration Number", "Roll Number", "Name"],
        ["REG2026SY001", "SY-01", "Aarav Sharma"],
        ["REG2026SY001", "SY-02", "Duplicate Reg Student"], # Duplicate Reg
        ["REG2026SY003", "SY-01", "Duplicate Roll Student"]  # Duplicate Roll
    ]
    excel_stream = create_mock_student_excel(invalid_rows)

    res = validate_student_list_excel(excel_stream, 'SY')
    assert res['valid'] is False
    assert res['duplicate_reg_count'] == 1
    assert res['duplicate_roll_count'] == 1
