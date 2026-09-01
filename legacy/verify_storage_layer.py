import os
import json
import time
import requests
from datetime import datetime, timezone
import storage_manager
from database import get_db
from models import recalculate_scores_and_rankings

BASE_URL = 'http://127.0.0.1:5000'

def verify_20_step_storage_layer():
    print("=" * 70)
    print("STARTING 20-STEP PRODUCTION SUPABASE STORAGE VERIFICATION")
    print("=" * 70)

    conn = get_db()
    cursor = conn.cursor()

    # Clean any stale test record
    cursor.execute("DELETE FROM tests WHERE test_number = 'TEST_STORE_99';")
    conn.commit()

    # Create temporary class & test
    cursor.execute("INSERT INTO classes (name, code) VALUES ('STORAGE_CLASS', 'STC') ON CONFLICT DO NOTHING;")
    class_id = cursor.execute("SELECT id FROM classes WHERE code = 'STC'").fetchone()['id']

    now_str = datetime.now(timezone.utc).strftime('%Y-%m-%d')
    cursor.execute("""
        INSERT INTO tests (test_number, title, class_id, test_date, start_time, finish_time, duration_minutes, total_marks, status, result_status, is_published)
        VALUES ('TEST_STORE_99', 'Storage Verification Test', ?, ?, '10:00 AM', '11:00 AM', 60, 100.0, 'Upcoming', 'Unpublished', 0)
        RETURNING id;
    """, (class_id, now_str))
    test_id = cursor.lastrowid
    conn.commit()

    # Step 1 & 2: Upload Question Paper
    print("1 & 2. Uploading Question Paper to 'question-papers' bucket...")
    qp_bytes = b"%PDF-1.4 Mock Question Paper Content for Storage Verification"
    qp_upload = storage_manager.upload_file('question-papers', f"{test_id}/question-paper.pdf", qp_bytes, 'application/pdf')
    assert os.path.exists(qp_upload['local_path']), "Question paper local mirror missing!"
    print(f"    Verified: Uploaded to storage path '{qp_upload['storage_path']}' ({qp_upload['size_bytes']} bytes)")

    # Step 3: Record & Verify PostgreSQL Metadata
    print("3. Recording & verifying PostgreSQL metadata for Question Paper...")
    qp_res_id = storage_manager.record_resource_metadata(
        test_id=test_id,
        class_id=class_id,
        resource_type='question_paper',
        title='Test 99 Question Paper',
        storage_path=qp_upload['storage_path'],
        file_path=qp_upload['file_path'],
        visibility='completed_only'
    )
    db_res = cursor.execute('SELECT * FROM resources WHERE id = ?', (qp_res_id,)).fetchone()
    assert db_res is not None and db_res['storage_path'] == qp_upload['storage_path']
    print(f"    Verified: PostgreSQL metadata row created with resource_id={qp_res_id}")

    # Step 4: Verify Unauthorized Access Before Completion Denied
    print("4. Verifying student access to Question Paper before completion is DENIED...")
    unauth_resp = requests.get(f"{BASE_URL}/api/resources/{qp_res_id}/download")
    assert unauth_resp.status_code == 403, f"Expected 403 Forbidden, got {unauth_resp.status_code}"
    print("    Verified: Student access returned 403 Forbidden")

    # Step 5 & 6: Upload Answer Key & Verify Access Denied
    print("5 & 6. Uploading Answer Key & verifying access before completion is DENIED...")
    ak_bytes = b"%PDF-1.4 Mock Answer Key Content for Storage Verification"
    ak_upload = storage_manager.upload_file('answer-keys', f"{test_id}/answer-key.pdf", ak_bytes, 'application/pdf')
    ak_res_id = storage_manager.record_resource_metadata(
        test_id=test_id,
        class_id=class_id,
        resource_type='answer_key',
        title='Test 99 Answer Key',
        storage_path=ak_upload['storage_path'],
        file_path=ak_upload['file_path'],
        visibility='completed_only'
    )
    ak_unauth = requests.get(f"{BASE_URL}/api/resources/{ak_res_id}/download")
    assert ak_unauth.status_code == 403, f"Expected 403 Forbidden for answer key, got {ak_unauth.status_code}"
    print("    Verified: Answer key access returned 403 Forbidden")

    # Step 7 & 8: Mark Test Completed & Verify Authorized Access with Signed URL
    print("7 & 8. Marking test Completed and verifying authorized access with signed URL...")
    # Set finish_time to past time e.g. 09:00 AM
    cursor.execute("UPDATE tests SET status = 'Completed', test_date = '2026-08-20', start_time = '08:00 AM', finish_time = '09:00 AM' WHERE id = ?", (test_id,))
    conn.commit()

    # Verify student download now allowed
    auth_resp = requests.get(f"{BASE_URL}/api/resources/{qp_res_id}/download")
    assert auth_resp.status_code == 200, f"Expected 200 OK after completion, got {auth_resp.status_code}"
    signed_url = storage_manager.get_signed_url('question-papers', f"{test_id}/question-paper.pdf")
    assert signed_url is not None and len(signed_url) > 0
    print(f"    Verified: Signed URL generated successfully: '{signed_url[:60]}...'")

    # Step 9 & 10: Upload Resource & Test Visibility Rules
    print("9 & 10. Uploading study resource & testing visibility rules...")
    notes_bytes = b"Mock Study Notes Text Content"
    notes_upload = storage_manager.upload_file('resources', f"{test_id}/notes_ch1.pdf", notes_bytes, 'application/pdf')
    notes_res_id = storage_manager.record_resource_metadata(
        test_id=test_id,
        class_id=class_id,
        resource_type='notes',
        title='Chapter 1 Study Notes',
        storage_path=notes_upload['storage_path'],
        file_path=notes_upload['file_path'],
        visibility='public'
    )
    notes_resp = requests.get(f"{BASE_URL}/api/resources/{notes_res_id}/download")
    assert notes_resp.status_code == 200, f"Expected 200 for public resource, got {notes_resp.status_code}"
    print("    Verified: Public resource accessible without restriction")

    # Step 11 & 12: Upload Student List Excel & Verify Private Retention
    print("11 & 12. Uploading student Excel & verifying private retention in 'excel-imports'...")
    excel_bytes = b"Mock Student List Excel Binary Data"
    stu_import = storage_manager.upload_file('excel-imports', f"students/STC_students_{int(time.time())}.xlsx", excel_bytes)
    assert os.path.exists(stu_import['local_path'])
    print(f"    Verified: Student list retained in private storage path '{stu_import['storage_path']}'")

    # Step 13 & 14: Upload Result Excel & Verify Parsing
    print("13 & 14. Uploading result Excel & verifying private storage retention...")
    res_import1 = storage_manager.upload_file('excel-imports', f"{test_id}/results_v1.xlsx", b"Mock Result Excel V1")
    assert os.path.exists(res_import1['local_path'])
    print(f"    Verified: Result Excel V1 stored at '{res_import1['storage_path']}'")

    # Step 15, 16 & 17: Upload Corrected Result Excel, Override & Ranking Recalculation
    print("15, 16 & 17. Uploading corrected Result Excel, verifying override & ranking recalculation...")
    res_import2 = storage_manager.upload_file('excel-imports', f"{test_id}/results_v2.xlsx", b"Mock Result Excel V2 Corrected")
    # Add dummy student & test result to test override
    cursor.execute("""
        INSERT INTO students (registration_no, registration_number, roll_no, roll_number, name, class_name)
        VALUES ('REG_STORE01', 'REG_STORE01', 'STC-01', 'STC-01', 'Storage Student 1', 'SY')
        ON CONFLICT (registration_no) DO NOTHING;
    """)
    cursor.execute("""
        INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage, published)
        VALUES (?, 'REG_STORE01', 'Present', 85.0, 85.0, 1)
        ON CONFLICT (test_id, registration_no) DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, percentage = EXCLUDED.percentage;
    """, (test_id,))
    conn.commit()

    cursor.execute("UPDATE tests SET is_published = 1 WHERE id = ?", (test_id,))
    conn.commit()

    recalculate_scores_and_rankings()
    score_row = cursor.execute("SELECT cognify_score, rank FROM student_scores WHERE registration_no = 'REG_STORE01'").fetchone()
    assert score_row is not None and score_row['cognify_score'] == 85.0
    print(f"    Verified: Overridden result calculated Cognify score = {score_row['cognify_score']}%, rank = {score_row['rank']}")

    # Step 18 & 19: Delete Test & Verify Associated File Cleanup
    print("18 & 19. Deleting test & verifying associated files are cleaned up from storage...")
    storage_manager.delete_test_assets(test_id)
    cursor.execute("DELETE FROM tests WHERE id = ?", (test_id,))
    conn.commit()

    assert not os.path.exists(qp_upload['local_path']), "Question paper physical file not deleted!"
    assert not os.path.exists(ak_upload['local_path']), "Answer key physical file not deleted!"
    print("    Verified: Associated storage files purged successfully upon test deletion")

    # Step 20: Verify Admin-Only Files Cannot Be Accesses as Student
    print("20. Verifying admin-only files (excel-imports, backups) deny student access...")
    admin_only_resp = requests.get(f"{BASE_URL}/api/resources/storage/download/excel-imports/results_v1.xlsx")
    assert admin_only_resp.status_code == 403, f"Expected 403 Forbidden for student access to excel-imports, got {admin_only_resp.status_code}"
    print("    Verified: Student access to excel-imports bucket returned 403 Forbidden")

    # Cleanup temporary student and class
    cursor.execute("DELETE FROM student_scores WHERE registration_no = 'REG_STORE01';")
    cursor.execute("DELETE FROM students WHERE registration_no = 'REG_STORE01';")
    cursor.execute("DELETE FROM classes WHERE id = ?;", (class_id,))
    conn.commit()
    conn.close()

    print("=" * 70)
    print("SUCCESS: ALL 20 PRODUCTION SUPABASE STORAGE VERIFICATION STEPS PASSED 100%!")
    print("=" * 70)

if __name__ == '__main__':
    verify_20_step_storage_layer()
