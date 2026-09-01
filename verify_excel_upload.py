import os
import io
import requests
import openpyxl
from database import get_db

BASE_URL = 'http://127.0.0.1:5000'

def create_mock_student_excel(students):
    wb = openpyxl.Workbook()
    ws = wb.active
    ws.title = "Students"
    # Header row
    ws.append(["Registration Number", "Roll Number", "Name"])
    for s in students:
        ws.append([s['reg'], s['roll'], s['name']])
    
    stream = io.BytesIO()
    wb.save(stream)
    stream.seek(0)
    return stream

def verify_student_excel_import_workflow():
    print("=" * 70)
    print("STARTING STUDENT EXCEL IMPORT WORKFLOW VERIFICATION")
    print("=" * 70)

    session = requests.Session()
    login_resp = session.post(f"{BASE_URL}/api/admin/login", json={'password': 'CognifyAdmin2026!'})
    assert login_resp.status_code == 200, f"Admin login failed: {login_resp.text}"

    # Step 1: Prepare valid mock Excel file
    mock_students = [
        {'reg': 'REG_XL_01', 'roll': 'SY-80', 'name': 'Excel Student 1'},
        {'reg': 'REG_XL_02', 'roll': 'SY-81', 'name': 'Excel Student 2'},
        {'reg': 'REG_XL_03', 'roll': 'SY-82', 'name': 'Excel Student 3'}
    ]
    excel_stream = create_mock_student_excel(mock_students)

    # Step 2: Validate student Excel file via API POST /api/admin/students/validate
    print("1. Posting Excel file to /api/admin/students/validate...")
    files = {'file': ('mock_sy_students.xlsx', excel_stream, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    data = {'class_name': 'SY'}
    val_resp = session.post(f"{BASE_URL}/api/admin/students/validate", data=data, files=files)
    assert val_resp.status_code == 200, f"Validation endpoint failed: {val_resp.text}"
    val_json = val_resp.json()
    assert val_json.get('valid') is True, f"Validation returned invalid: {val_json}"
    assert val_json.get('valid_count') == 3, f"Expected 3 valid students, got {val_json.get('valid_count')}"
    print(f"    Verified: Validation succeeded ({val_json.get('valid_count')} students detected)")

    # Step 3: Execute import via API POST /api/admin/students/import
    print("2. Importing validated students to /api/admin/students/import...")
    import_payload = {
        'class_name': 'SY',
        'parsed_students': val_json.get('parsed_students')
    }
    imp_resp = session.post(f"{BASE_URL}/api/admin/students/import", json=import_payload)
    assert imp_resp.status_code == 200 and imp_resp.json().get('success') is True, f"Import failed: {imp_resp.text}"
    print(f"    Verified: Import succeeded ({imp_resp.json().get('message')})")

    # Step 4: Verify students in database
    print("3. Verifying imported students exist in master database...")
    conn = get_db()
    cursor = conn.cursor()
    imported_rows = cursor.execute("SELECT registration_no, registration_number, roll_no, roll_number, name FROM students WHERE registration_no LIKE 'REG_XL_%' ORDER BY roll_no ASC").fetchall()
    assert len(imported_rows) == 3, f"Expected 3 imported rows in DB, found {len(imported_rows)}"
    for r in imported_rows:
        assert r['registration_no'] == r['registration_number'], "registration_no and registration_number mismatch!"
        assert r['roll_no'] == r['roll_number'], "roll_no and roll_number mismatch!"
    print("    Verified: All 3 students present in DB with synchronized registration and roll numbers")

    # Step 5: Duplicate validation test inside uploaded Excel
    print("4. Testing duplicate registration detection inside Excel file...")
    dup_students = [
        {'reg': 'REG_DUP_01', 'roll': 'SY-90', 'name': 'Student A'},
        {'reg': 'REG_DUP_01', 'roll': 'SY-91', 'name': 'Student B'}
    ]
    dup_excel = create_mock_student_excel(dup_students)
    files_dup = {'file': ('dup_students.xlsx', dup_excel, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')}
    val_dup_resp = session.post(f"{BASE_URL}/api/admin/students/validate", data={'class_name': 'SY'}, files=files_dup)
    assert val_dup_resp.status_code == 200
    val_dup_json = val_dup_resp.json()
    assert val_dup_json.get('valid') is False, "Duplicate sheet should fail validation!"
    assert any('Duplicate Registration Number' in err for err in val_dup_json.get('errors', []))
    print("    Verified: Sheet duplicate registration numbers correctly REJECTED with error message")

    # Cleanup test records
    cursor.execute("DELETE FROM students WHERE registration_no LIKE 'REG_XL_%';")
    conn.commit()
    conn.close()

    print("=" * 70)
    print("SUCCESS: STUDENT EXCEL IMPORT WORKFLOW PASSED 100%!")
    print("=" * 70)

if __name__ == '__main__':
    verify_student_excel_import_workflow()
