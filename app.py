import os
import json
import zipfile
from datetime import datetime, timezone, timedelta
from flask import Flask, render_template, request, jsonify, send_from_directory, send_file
from werkzeug.utils import secure_filename

from config import Config
from database import init_db, get_db, set_last_updated, get_last_updated, log_audit_event
import auth
from models import (
    recalculate_scores_and_rankings,
    get_top10_rankings,
    get_all_rankings,
    get_test_timeline,
    get_current_test_details,
    get_semester_plan,
    evaluate_test_availability,
    format_date_ddmmyy,
    get_test_datetimes
)
from excel_processor import validate_excel_results, publish_test_results
from excel_parser import parse_question_excel
import storage_manager

app = Flask(__name__, template_folder='templates', static_folder='static')
app.config.from_object(Config)
Config.init_app(app)

# Ensure DB and Storage initialized on startup
with app.app_context():
    init_db()
    storage_manager.init_storage()

# --- AUTH ROUTES ---
@app.route('/api/admin/login', methods=['POST'])
def api_admin_login():
    return auth.handle_login()

@app.route('/api/admin/logout', methods=['POST'])
def api_admin_logout():
    return auth.handle_logout()

@app.route('/api/admin/status', methods=['GET'])
def api_admin_status():
    return auth.handle_status()

# --- PUBLIC ROUTES ---
@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/public/rankings', methods=['GET'])
def api_public_top10():
    data = get_top10_rankings()
    return jsonify(data)

@app.route('/api/public/rankings/<class_name>', methods=['GET'])
def api_public_class_rankings(class_name):
    if class_name not in ('SY', 'TY', 'Final Year'):
        return jsonify({'error': 'Invalid class name'}), 400
    rankings = get_all_rankings(class_name)
    return jsonify({'class_name': class_name, 'rankings': rankings})

@app.route('/api/public/timeline', methods=['GET'])
def api_public_timeline():
    timeline = get_test_timeline()
    return jsonify(timeline)

@app.route('/api/public/current-test', methods=['GET'])
def api_public_current_test():
    current_test = get_current_test_details()
    return jsonify(current_test or {})

@app.route('/api/public/plan', methods=['GET'])
def api_public_plan():
    plan = get_semester_plan()
    return jsonify(plan)

# --- SERVER-SIDE DOWNLOAD ACCESS ENFORCEMENT ---
@app.route('/static/uploads/<folder>/<filename>')
def serve_upload_file(folder, filename):
    # Enforce strict server-side protection for question papers and answer keys
    # Requires BOTH: Current Time >= Finish Time AND status == 'Completed'
    if folder in ('question_papers', 'answer_keys'):
        is_admin = auth.is_admin()
        if not is_admin:
            file_path = f"/static/uploads/{folder}/{filename}"
            conn = get_db()
            test_row = conn.execute('''
                SELECT t.* FROM resources r
                JOIN tests t ON r.test_id = t.id
                WHERE r.file_path = ?
            ''', (file_path,)).fetchone()
            conn.close()
            if test_row:
                eval_info = evaluate_test_availability(dict(test_row))
                if not eval_info['resources_accessible']:
                    return jsonify({'error': 'Question Paper and Answer Key are inaccessible until the test has passed its Finish Time AND is marked Completed.'}), 403

    return send_from_directory(os.path.join(Config.UPLOAD_FOLDER, folder), filename)

@app.route('/api/resources/<int:resource_id>/download', methods=['GET'])
def api_download_resource(resource_id):
    conn = get_db()
    res = conn.execute('''
        SELECT r.*, t.test_number, t.test_name, t.test_date, t.status as test_status, t.start_time, t.finish_time
        FROM resources r
        LEFT JOIN tests t ON r.test_id = t.id
        WHERE r.id = ?
    ''', (resource_id,)).fetchone()
    conn.close()

    if not res:
        return jsonify({'error': 'Resource not found'}), 404

    # Enforce Question Paper & Answer Key access restrictions
    if res['resource_type'] in ('question_paper', 'answer_key'):
        is_admin = auth.is_admin()
        if not is_admin:
            if 'test_status' not in res.keys() or not res['test_status']:
                return jsonify({'error': 'Question Paper and Answer Key are inaccessible until the test has passed its Finish Time AND is marked Completed.'}), 403
            eval_info = evaluate_test_availability(dict(res))
            if not eval_info['resources_accessible']:
                return jsonify({'error': 'Question Paper and Answer Key are inaccessible until the test has passed its Finish Time AND is marked Completed.'}), 403

    spath = res['storage_path'] or res['file_path']
    if spath and '/' in spath:
        parts = spath.lstrip('/').replace('static/uploads/', '').split('/', 1)
        if len(parts) == 2:
            bucket_name, relative_path = parts[0], parts[1]
            signed_url = storage_manager.get_signed_url(bucket_name, relative_path)
            
            # If JSON request
            if request.headers.get('Accept') == 'application/json':
                return jsonify({'success': True, 'signed_url': signed_url, 'title': res['title']})

            local_path = os.path.join(storage_manager.LOCAL_STORAGE_DIR, bucket_name, relative_path)
            if os.path.exists(local_path):
                return send_file(local_path, as_attachment=True, download_name=res['title'])

    rel_path = res['file_path'].lstrip('/')
    full_path = os.path.join(Config.BASE_DIR, rel_path)
    if not os.path.exists(full_path):
        return jsonify({'error': 'File not found on server'}), 404

    return send_file(full_path, as_attachment=True, download_name=res['title'])

@app.route('/api/resources/storage/download/<bucket>/<path:filename>', methods=['GET'])
def serve_storage_file(bucket, filename):
    if bucket in ('question-papers', 'answer-keys'):
        is_admin = auth.is_admin()
        if not is_admin:
            test_id_str = filename.split('/')[0] if '/' in filename else filename
            if test_id_str.isdigit():
                conn = get_db()
                test_row = conn.execute('SELECT * FROM tests WHERE id = ?', (int(test_id_str),)).fetchone()
                conn.close()
                if test_row:
                    eval_info = evaluate_test_availability(dict(test_row))
                    if not eval_info['resources_accessible']:
                        return jsonify({'error': 'Question Paper and Answer Key are inaccessible until the test has passed its Finish Time AND is marked Completed.'}), 403
                else:
                    return jsonify({'error': 'Test not found for resource.'}), 403
            else:
                return jsonify({'error': 'Unauthorized access to restricted storage bucket.'}), 403

    elif bucket in ('excel-imports', 'backups'):
        if not auth.is_admin():
            return jsonify({'error': 'Admin authorization required to access private storage bucket.'}), 403

    local_path = os.path.join(storage_manager.LOCAL_STORAGE_DIR, bucket, filename)
    if not os.path.exists(local_path):
        return jsonify({'error': 'Storage object not found'}), 404

    return send_file(local_path, as_attachment=True)

# --- ADMIN PROTECTED ROUTES ---
@app.route('/api/admin/tests', methods=['GET'])
@auth.admin_required
def api_admin_get_tests():
    conn = get_db()
    tests = conn.execute('SELECT * FROM tests ORDER BY test_date ASC, id ASC').fetchall()
    conn.close()
    result = []
    for t in tests:
        td = dict(t)
        eval_info = evaluate_test_availability(td)
        td['formatted_date'] = eval_info['formatted_date']
        td['availability_state'] = eval_info['availability_state']
        result.append(td)
    return jsonify(result)

@app.route('/api/admin/tests', methods=['POST'])
@auth.admin_required
def api_admin_create_test():
    data = request.get_json() or {}
    test_number = data.get('test_number', '').strip()
    test_name = data.get('test_name', '').strip()
    test_date = data.get('test_date', '').strip()
    total_marks = data.get('total_marks')
    status = data.get('status', 'Upcoming').strip()
    duration_minutes = data.get('duration_minutes', 60)
    instructions = data.get('instructions', '').strip()
    start_time = data.get('start_time', '10:00 AM').strip() or '10:00 AM'
    finish_time = data.get('finish_time', '11:00 AM').strip() or '11:00 AM'

    if not all([test_number, test_name, test_date, total_marks]):
        return jsonify({'error': 'All required fields (test_number, test_name, test_date, total_marks) must be provided.'}), 400

    try:
        total_marks = float(total_marks)
        if total_marks <= 0:
            raise ValueError()
    except ValueError:
        return jsonify({'error': 'Total marks must be a positive number.'}), 400

    if status not in ('Upcoming', 'Current', 'Completed'):
        return jsonify({'error': 'Invalid status.'}), 400

    try:
        duration_minutes = int(duration_minutes)
    except ValueError:
        duration_minutes = 60

    conn = get_db()
    cursor = conn.cursor()

    # If setting to Current, un-mark existing Current tests
    if status == 'Current':
        cursor.execute("UPDATE tests SET status = 'Upcoming' WHERE status = 'Current'")

    cursor.execute('''
        INSERT INTO tests (test_number, test_name, test_date, total_marks, status, duration_minutes, instructions, start_time, finish_time)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (test_number, test_name, test_date, total_marks, status, duration_minutes, instructions, start_time, finish_time))
    conn.commit()
    test_id = cursor.lastrowid
    conn.close()

    recalculate_scores_and_rankings()
    return jsonify({'success': True, 'test_id': test_id, 'message': 'Test created successfully.'})

@app.route('/api/admin/tests/<int:test_id>', methods=['PUT'])
@auth.admin_required
def api_admin_update_test(test_id):
    data = request.get_json() or {}
    test_number = data.get('test_number', '').strip()
    test_name = data.get('test_name', '').strip()
    test_date = data.get('test_date', '').strip()
    total_marks = data.get('total_marks')
    status = data.get('status').strip()
    duration_minutes = data.get('duration_minutes', 60)
    instructions = data.get('instructions', '').strip()
    start_time = data.get('start_time', '10:00 AM').strip() or '10:00 AM'
    finish_time = data.get('finish_time', '11:00 AM').strip() or '11:00 AM'

    if not all([test_number, test_name, test_date, total_marks, status]):
        return jsonify({'error': 'All fields are required.'}), 400

    try:
        total_marks = float(total_marks)
        if total_marks <= 0:
            raise ValueError()
    except ValueError:
        return jsonify({'error': 'Total marks must be a positive number.'}), 400

    if status not in ('Upcoming', 'Current', 'Completed'):
        return jsonify({'error': 'Invalid status.'}), 400

    try:
        duration_minutes = int(duration_minutes)
    except ValueError:
        duration_minutes = 60

    conn = get_db()
    cursor = conn.cursor()

    # If setting to Current, un-mark existing Current test
    if status == 'Current':
        cursor.execute("UPDATE tests SET status = 'Upcoming' WHERE status = 'Current' AND id != ?", (test_id,))

    cursor.execute('''
        UPDATE tests
        SET test_number = ?, test_name = ?, test_date = ?, total_marks = ?, status = ?, duration_minutes = ?, instructions = ?, start_time = ?, finish_time = ?
        WHERE id = ?
    ''', (test_number, test_name, test_date, total_marks, status, duration_minutes, instructions, start_time, finish_time, test_id))
    conn.commit()
    conn.close()

    recalculate_scores_and_rankings()
    return jsonify({'success': True, 'message': 'Test updated successfully.'})

@app.route('/api/admin/tests/<int:test_id>', methods=['DELETE'])
@auth.admin_required
def api_admin_delete_test(test_id):
    conn = get_db()
    cursor = conn.cursor()

    # Delete associated physical resource files
    resources = cursor.execute('SELECT file_path FROM resources WHERE test_id = ?', (test_id,)).fetchall()
    for r in resources:
        rel_path = r['file_path'].lstrip('/')
        full_path = os.path.join(Config.BASE_DIR, rel_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass

    cursor.execute('DELETE FROM tests WHERE id = ?', (test_id,))
    conn.commit()
    conn.close()

    recalculate_scores_and_rankings()
    return jsonify({'success': True, 'message': 'Test and all associated data deleted successfully.'})

# --- PER-TEST ADMIN WORKSPACE ROUTES ---
@app.route('/api/admin/tests/<int:test_id>/workspace', methods=['GET'])
@auth.admin_required
def api_admin_test_workspace(test_id):
    conn = get_db()
    cursor = conn.cursor()

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    if not test:
        conn.close()
        return jsonify({'error': 'Test not found'}), 404

    test_dict = dict(test)
    test_dict['is_published'] = bool(test['is_published'])

    eval_info = evaluate_test_availability(test_dict)
    now_dt = datetime.now()
    now_formatted = format_date_ddmmyy(now_dt.strftime('%d/%m/%y')) + ', ' + now_dt.strftime('%I:%M %p')

    schedule_info = {
        'test_date': eval_info['formatted_date'],
        'raw_test_date': test_dict['test_date'],
        'start_time': test_dict.get('start_time', '10:00 AM'),
        'finish_time': test_dict.get('finish_time', '11:00 AM'),
        'current_server_time': now_formatted,
        'current_server_iso': now_dt.isoformat(),
        'availability_state': eval_info['availability_state'],
        'start_iso': eval_info['start_iso'],
        'finish_iso': eval_info['finish_iso']
    }

    # Fetch master student database
    students = cursor.execute('SELECT registration_no, roll_no, name, class_name FROM students ORDER BY roll_no ASC, name ASC').fetchall()
    
    # Fetch student_attempts for this test
    attempts = cursor.execute('SELECT * FROM student_attempts WHERE test_id = ?', (test_id,)).fetchall()
    attempts_map = {a['registration_no']: dict(a) for a in attempts}

    # Fetch test_results for this test (published results if any)
    results = cursor.execute('SELECT * FROM test_results WHERE test_id = ?', (test_id,)).fetchall()
    results_map = {r['registration_no']: dict(r) for r in results}

    student_list = []
    present_count = 0
    absent_count = 0
    late_attempts_count = 0
    submission_count = 0
    terminated_count = 0
    violation_flag_count = 0

    for s in students:
        reg = s['registration_no']
        att = attempts_map.get(reg)
        res = results_map.get(reg)

        attempt_status = att['attempt_status'] if att else 'Not Started'
        attendance = att['attendance'] if att else ('Present' if (res and res['attendance'] == 'Present') else 'Absent')
        violation_count = att['violation_count'] if att else 0
        
        if att and att['attempt_status'] in ('Submitted', 'Terminated'):
            score = att['calculated_score']
            pct = att['calculated_percentage']
        elif res:
            score = res['marks_obtained']
            pct = res['percentage']
        else:
            score = 0.0
            pct = 0.0

        is_late = bool(att['is_late_attempt']) if (att and 'is_late_attempt' in att.keys()) else False
        if is_late:
            late_attempts_count += 1

        if attendance == 'Present':
            present_count += 1
        else:
            absent_count += 1

        if attempt_status in ('Submitted', 'Terminated'):
            submission_count += 1
        if attempt_status == 'Terminated':
            terminated_count += 1
        if violation_count >= 4 or attempt_status == 'Terminated':
            violation_flag_count += 1

        has_violation = (violation_count > 0 or attempt_status == 'Terminated')

        student_list.append({
            'registration_no': reg,
            'roll_no': s['roll_no'],
            'name': s['name'],
            'class_name': s['class_name'],
            'attempt_status': attempt_status,
            'attendance': attendance,
            'is_late_attempt': is_late,
            'violation_count': violation_count,
            'has_violation': has_violation,
            'score': score,
            'percentage': pct
        })

    # Syllabus categories
    cat_rows = cursor.execute('SELECT * FROM syllabus_categories WHERE test_id = ? ORDER BY display_order ASC, id ASC', (test_id,)).fetchall()
    categories = []
    for c in cat_rows:
        try:
            topics = json.loads(c['topics_json'])
        except Exception:
            topics = []
        categories.append({'id': c['id'], 'category_name': c['category_name'], 'topics': topics})

    # Resources
    res_rows = cursor.execute('SELECT * FROM resources WHERE test_id = ?', (test_id,)).fetchall()
    resources = {r['resource_type']: dict(r) for r in res_rows}

    # Questions
    q_rows = cursor.execute('SELECT * FROM test_questions WHERE test_id = ? AND is_active = 1 ORDER BY question_number ASC', (test_id,)).fetchall()
    questions = [dict(q) for q in q_rows]

    conn.close()

    return jsonify({
        'test': test_dict,
        'schedule': schedule_info,
        'metrics': {
            'registered_students': len(students),
            'submissions': submission_count,
            'present_count': present_count,
            'absent_count': absent_count,
            'late_attempt_count': late_attempts_count,
            'terminated_count': terminated_count,
            'violation_flag_count': violation_flag_count,
            'is_published': bool(test['is_published']),
            'last_updated': test['created_at']
        },
        'students': student_list,
        'categories': categories,
        'resources': resources,
        'questions': questions
    })

@app.route('/api/admin/tests/<int:test_id>/attendance', methods=['POST'])
@auth.admin_required
def api_admin_update_attendance(test_id):
    data = request.get_json() or {}
    action = data.get('action')
    reg_no = data.get('registration_no')
    attendance = data.get('attendance')

    conn = get_db()
    cursor = conn.cursor()

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    if not test:
        conn.close()
        return jsonify({'error': 'Test not found'}), 404

    if action == 'mark_all_present':
        students = cursor.execute('SELECT registration_no FROM students').fetchall()
        for s in students:
            cursor.execute('''
                INSERT INTO student_attempts (test_id, registration_no, attempt_status, attendance)
                VALUES (?, ?, 'Not Started', 'Present')
                ON CONFLICT(test_id, registration_no) DO UPDATE SET attendance = 'Present'
            ''', (test_id, s['registration_no']))
            cursor.execute('UPDATE test_results SET attendance = "Present" WHERE test_id = ? AND registration_no = ?', (test_id, s['registration_no']))
        conn.commit()
        conn.close()

        log_audit_event('MARK_ALL_PRESENT', test_id=test_id, new_value='Present')

        if test['is_published']:
            recalculate_scores_and_rankings()

        return jsonify({'success': True, 'message': 'All registered students marked Present.'})

    if not reg_no or attendance not in ('Present', 'Absent'):
        conn.close()
        return jsonify({'error': 'Invalid registration_no or attendance state.'}), 400

    prev_att = cursor.execute('SELECT attendance FROM student_attempts WHERE test_id = ? AND registration_no = ?', (test_id, reg_no)).fetchone()
    old_val = prev_att['attendance'] if prev_att else 'Absent'

    cursor.execute('''
        INSERT INTO student_attempts (test_id, registration_no, attempt_status, attendance)
        VALUES (?, ?, 'Not Started', ?)
        ON CONFLICT(test_id, registration_no) DO UPDATE SET attendance = excluded.attendance
    ''', (test_id, reg_no, attendance))

    cursor.execute('UPDATE test_results SET attendance = ? WHERE test_id = ? AND registration_no = ?', (attendance, test_id, reg_no))

    conn.commit()
    conn.close()

    log_audit_event('ATTENDANCE_OVERRIDE', test_id=test_id, registration_no=reg_no, previous_value=old_val, new_value=attendance)

    if test['is_published']:
        recalculate_scores_and_rankings()

    return jsonify({'success': True, 'message': f'Attendance for {reg_no} updated to {attendance}.'})

@app.route('/api/admin/audit-logs', methods=['GET'])
@auth.admin_required
def api_admin_get_audit_logs():
    conn = get_db()
    logs = conn.execute('SELECT * FROM audit_logs ORDER BY id DESC LIMIT 100').fetchall()
    conn.close()
    return jsonify([dict(l) for l in logs])

@app.route('/api/admin/tests/<int:test_id>/attempts/<registration_no>', methods=['GET'])
@auth.admin_required
def api_admin_get_attempt_detail(test_id, registration_no):
    conn = get_db()
    cursor = conn.cursor()

    student = cursor.execute('SELECT * FROM students WHERE registration_no = ?', (registration_no,)).fetchone()
    if not student:
        conn.close()
        return jsonify({'error': 'Student not found.'}), 404

    attempt = cursor.execute('SELECT * FROM student_attempts WHERE test_id = ? AND registration_no = ?', (test_id, registration_no)).fetchone()
    questions = cursor.execute('SELECT * FROM test_questions WHERE test_id = ? ORDER BY question_number ASC', (test_id,)).fetchall()

    saved_answers = []
    if attempt:
        answers_rows = cursor.execute('''
            SELECT sa.*, q.question_number, q.question_text, q.option_a, q.option_b, q.option_c, q.option_d, q.correct_option, q.marks
            FROM student_answers sa
            JOIN test_questions q ON sa.question_id = q.id
            WHERE sa.attempt_id = ?
        ''', (attempt['id'],)).fetchall()
        answers_map = {a['question_id']: a for a in answers_rows}
    else:
        answers_map = {}

    for q in questions:
        saved_ans = answers_map.get(q['id'])
        selected = saved_ans['selected_option'] if saved_ans else None
        saved_at = saved_ans['saved_at'] if saved_ans else None
        is_correct = (selected == q['correct_option']) if selected else False

        saved_answers.append({
            'question_id': q['id'],
            'question_number': q['question_number'],
            'question_text': q['question_text'],
            'option_a': q['option_a'],
            'option_b': q['option_b'],
            'option_c': q['option_c'],
            'option_d': q['option_d'],
            'correct_option': q['correct_option'],
            'selected_option': selected,
            'is_correct': is_correct,
            'marks': q['marks'],
            'saved_at': saved_at
        })

    violation_logs = []
    if attempt and attempt['violation_logs_json']:
        try:
            violation_logs = json.loads(attempt['violation_logs_json'])
        except Exception:
            violation_logs = []

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    conn.close()

    return jsonify({
        'student': dict(student),
        'test': dict(test) if test else {},
        'attempt': dict(attempt) if attempt else None,
        'violation_logs': violation_logs,
        'total_questions': len(questions),
        'answered_count': sum(1 for a in saved_answers if a['selected_option']),
        'saved_answers': saved_answers
    })

@app.route('/api/admin/tests/<int:test_id>/reset-attempt', methods=['POST'])
@auth.admin_required
def api_admin_reset_attempt(test_id):
    data = request.get_json() or {}
    reg_no = data.get('registration_no')
    if not reg_no:
        return jsonify({'error': 'Registration number required.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    attempt = cursor.execute('SELECT id FROM student_attempts WHERE test_id = ? AND registration_no = ?', (test_id, reg_no)).fetchone()
    if attempt:
        cursor.execute('DELETE FROM student_answers WHERE attempt_id = ?', (attempt['id'],))
        cursor.execute('DELETE FROM student_attempts WHERE id = ?', (attempt['id'],))
    
    cursor.execute('DELETE FROM test_results WHERE test_id = ? AND registration_no = ?', (test_id, reg_no))
    conn.commit()
    conn.close()

    recalculate_scores_and_rankings()
    return jsonify({'success': True, 'message': f'Attempt reset for registration number {reg_no}.'})

@app.route('/api/admin/tests/<int:test_id>/publish-summary', methods=['GET'])
@auth.admin_required
def api_admin_publish_summary(test_id):
    conn = get_db()
    cursor = conn.cursor()

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    if not test:
        conn.close()
        return jsonify({'error': 'Test not found'}), 404

    students = cursor.execute('SELECT registration_no FROM students').fetchall()
    attempts = cursor.execute('SELECT * FROM student_attempts WHERE test_id = ?', (test_id,)).fetchall()
    attempts_map = {a['registration_no']: a for a in attempts}

    present_count = 0
    absent_count = 0
    normal_submissions = 0
    flagged_attempts = 0

    for s in students:
        reg = s['registration_no']
        att = attempts_map.get(reg)

        attendance = att['attendance'] if att else 'Absent'
        attempt_status = att['attempt_status'] if att else 'Not Started'
        violation_count = att['violation_count'] if att else 0

        if attendance == 'Present':
            present_count += 1
        else:
            absent_count += 1

        if attempt_status == 'Submitted' and violation_count < 4:
            normal_submissions += 1
        elif violation_count >= 4 or attempt_status == 'Terminated':
            flagged_attempts += 1

    conn.close()

    return jsonify({
        'test_id': test_id,
        'test_number': test['test_number'],
        'test_name': test['test_name'],
        'total_students': len(students),
        'present_count': present_count,
        'absent_count': absent_count,
        'normal_submissions': normal_submissions,
        'flagged_attempts': flagged_attempts,
        'is_published': bool(test['is_published'])
    })

@app.route('/api/admin/tests/<int:test_id>/publish', methods=['POST'])
@auth.admin_required
def api_admin_publish_workspace_results(test_id):
    conn = get_db()
    cursor = conn.cursor()

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    if not test:
        conn.close()
        return jsonify({'error': 'Test not found'}), 404

    total_marks = float(test['total_marks'])

    students = cursor.execute('SELECT registration_no FROM students').fetchall()
    attempts = cursor.execute('SELECT * FROM student_attempts WHERE test_id = ?', (test_id,)).fetchall()
    attempts_map = {a['registration_no']: a for a in attempts}

    try:
        cursor.execute('BEGIN TRANSACTION;')

        cursor.execute('DELETE FROM test_results WHERE test_id = ?', (test_id,))

        for s in students:
            reg = s['registration_no']
            att = attempts_map.get(reg)

            if att and att['attendance'] == 'Present':
                attendance = 'Present'
                marks = float(att['calculated_score'])
                pct = float(att['calculated_percentage'])
            else:
                attendance = 'Absent'
                marks = 0.0
                pct = 0.0

            cursor.execute('''
                INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage)
                VALUES (?, ?, ?, ?, ?)
            ''', (test_id, reg, attendance, marks, pct))

        cursor.execute('UPDATE tests SET is_published = 1 WHERE id = ?', (test_id,))
        conn.commit()
        conn.close()

        recalculate_scores_and_rankings()
        set_last_updated('rankings_last_updated')

        return jsonify({'success': True, 'message': f'Results for {test["test_number"]} published successfully! Cognify Scores and rankings have been updated.'})

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': f'Failed to publish results: {str(e)}'}), 500

@app.route('/api/admin/tests/<int:test_id>/questions/validate-excel', methods=['POST'])
@auth.admin_required
def api_admin_validate_question_excel(test_id):
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded.'}), 400

    file = request.files['file']
    if not file or not file.filename.endswith('.xlsx'):
        return jsonify({'error': 'Invalid file format. Please upload an Excel (.xlsx) file.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    if not test:
        conn.close()
        return jsonify({'error': 'Test not found.'}), 404

    parse_result = parse_question_excel(file.stream, total_test_marks=test['total_marks'])

    existing_questions = cursor.execute('SELECT COUNT(*) as cnt FROM test_questions WHERE test_id = ? AND is_active = 1', (test_id,)).fetchone()['cnt']
    attempts_count = cursor.execute('SELECT COUNT(*) as cnt FROM student_attempts WHERE test_id = ?', (test_id,)).fetchone()['cnt']

    conn.close()

    parse_result['existing_questions_count'] = existing_questions
    parse_result['has_student_attempts'] = (attempts_count > 0)
    parse_result['student_attempts_count'] = attempts_count

    if attempts_count > 0:
        parse_result['warnings'].append(
            f"⚠️ Warning: {attempts_count} student attempt(s) have already been recorded for this test. Replacing questions will preserve historical attempts while updating future attempts."
        )
    elif existing_questions > 0:
        parse_result['warnings'].append(
            f"Notice: This test already has {existing_questions} question(s). Importing will replace the existing question set."
        )

    return jsonify(parse_result)

@app.route('/api/admin/tests/<int:test_id>/questions/import-excel', methods=['POST'])
@auth.admin_required
def api_admin_import_question_excel(test_id):
    data = request.get_json() or {}
    questions = data.get('questions', [])

    if not isinstance(questions, list) or len(questions) == 0:
        return jsonify({'error': 'No valid questions provided for import.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    try:
        test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
        if not test:
            conn.close()
            return jsonify({'error': 'Test not found.'}), 404

        attempts_count = cursor.execute('SELECT COUNT(*) as cnt FROM student_attempts WHERE test_id = ?', (test_id,)).fetchone()['cnt']

        if attempts_count > 0:
            cursor.execute('UPDATE test_questions SET is_active = 0 WHERE test_id = ? AND is_active = 1', (test_id,))
        else:
            cursor.execute('DELETE FROM test_questions WHERE test_id = ?', (test_id,))

        for q in questions:
            q_num = int(q.get('question_number', 1))
            q_text = str(q.get('question_text', '')).strip()
            opt_a = str(q.get('option_a', '')).strip()
            opt_b = str(q.get('option_b', '')).strip()
            opt_c = str(q.get('option_c', '')).strip()
            opt_d = str(q.get('option_d', '')).strip()
            correct_opt = str(q.get('correct_option', 'A')).strip().upper()
            marks = float(q.get('marks', 1.0))

            if correct_opt not in ('A', 'B', 'C', 'D'):
                raise ValueError(f"Question {q_num}: Invalid correct option '{correct_opt}'")

            cursor.execute('''
                INSERT INTO test_questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
            ''', (test_id, q_num, q_text, opt_a, opt_b, opt_c, opt_d, correct_opt, marks))

        conn.commit()
        conn.close()
        return jsonify({
            'success': True,
            'count': len(questions),
            'message': f'Successfully imported {len(questions)} questions for {test["test_number"]}.'
        })

    except Exception as e:
        conn.rollback()
        conn.close()
        return jsonify({'error': f'Failed to import questions: {str(e)}'}), 500

@app.route('/api/admin/tests/<int:test_id>/questions', methods=['GET', 'POST'])
@auth.admin_required
def api_admin_test_questions(test_id):
    conn = get_db()
    cursor = conn.cursor()

    if request.method == 'GET':
        questions = cursor.execute('SELECT * FROM test_questions WHERE test_id = ? AND is_active = 1 ORDER BY question_number ASC', (test_id,)).fetchall()
        conn.close()
        return jsonify([dict(q) for q in questions])

    data = request.get_json() or {}
    q_num = data.get('question_number')
    q_text = data.get('question_text', '').strip()
    opt_a = data.get('option_a', '').strip()
    opt_b = data.get('option_b', '').strip()
    opt_c = data.get('option_c', '').strip()
    opt_d = data.get('option_d', '').strip()
    correct_opt = data.get('correct_option', 'A').strip().upper()
    marks = data.get('marks', 1.0)

    if not all([q_num, q_text, opt_a, opt_b, opt_c, opt_d, correct_opt]):
        conn.close()
        return jsonify({'error': 'All question fields are required.'}), 400

    if correct_opt not in ('A', 'B', 'C', 'D'):
        conn.close()
        return jsonify({'error': 'Correct option must be A, B, C, or D.'}), 400

    cursor.execute('''
        INSERT INTO test_questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks, is_active)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
    ''', (test_id, int(q_num), q_text, opt_a, opt_b, opt_c, opt_d, correct_opt, float(marks)))

    conn.commit()
    q_id = cursor.lastrowid
    conn.close()
    return jsonify({'success': True, 'question_id': q_id, 'message': 'Question added successfully.'})

@app.route('/api/admin/questions/<int:question_id>', methods=['PUT', 'DELETE'])
@auth.admin_required
def api_admin_manage_question(question_id):
    conn = get_db()
    cursor = conn.cursor()

    q = cursor.execute('SELECT * FROM test_questions WHERE id = ?', (question_id,)).fetchone()
    if not q:
        conn.close()
        return jsonify({'error': 'Question not found.'}), 404

    if request.method == 'DELETE':
        ans_cnt = cursor.execute('SELECT COUNT(*) as cnt FROM student_answers WHERE question_id = ?', (question_id,)).fetchone()['cnt']
        if ans_cnt > 0:
            cursor.execute('UPDATE test_questions SET is_active = 0 WHERE id = ?', (question_id,))
        else:
            cursor.execute('DELETE FROM test_questions WHERE id = ?', (question_id,))
        conn.commit()
        conn.close()
        return jsonify({'success': True, 'message': 'Question deleted successfully.'})

    data = request.get_json() or {}
    q_num = data.get('question_number', q['question_number'])
    q_text = data.get('question_text', q['question_text']).strip()
    opt_a = data.get('option_a', q['option_a']).strip()
    opt_b = data.get('option_b', q['option_b']).strip()
    opt_c = data.get('option_c', q['option_c']).strip()
    opt_d = data.get('option_d', q['option_d']).strip()
    correct_opt = data.get('correct_option', q['correct_option']).strip().upper()
    marks = data.get('marks', q['marks'])

    if not all([q_num, q_text, opt_a, opt_b, opt_c, opt_d, correct_opt]):
        conn.close()
        return jsonify({'error': 'All question fields are required.'}), 400

    if correct_opt not in ('A', 'B', 'C', 'D'):
        conn.close()
        return jsonify({'error': 'Correct option must be A, B, C, or D.'}), 400

    cursor.execute('''
        UPDATE test_questions
        SET question_number = ?, question_text = ?, option_a = ?, option_b = ?, option_c = ?, option_d = ?, correct_option = ?, marks = ?
        WHERE id = ?
    ''', (int(q_num), q_text, opt_a, opt_b, opt_c, opt_d, correct_opt, float(marks), question_id))

    conn.commit()
    conn.close()
    return jsonify({'success': True, 'message': 'Question updated successfully.'})

# --- STUDENT EXAM MODE ROUTES ---
@app.route('/api/student/verify-registration', methods=['POST'])
def api_student_verify_registration():
    data = request.get_json() or {}
    reg_no = data.get('registration_no', '').strip().upper()
    test_id = data.get('test_id')

    if not reg_no or not test_id:
        return jsonify({'valid': False, 'error': 'Registration number and test ID are required.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    student = cursor.execute('SELECT * FROM students WHERE UPPER(registration_no) = ?', (reg_no,)).fetchone()
    if not student:
        conn.close()
        return jsonify({'valid': False, 'error': f'Registration number "{reg_no}" not found in Master Student Database.'}), 404

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    if not test:
        conn.close()
        return jsonify({'valid': False, 'error': 'Test not found.'}), 404

    eval_info = evaluate_test_availability(dict(test))
    if eval_info['availability_state'] == 'BEFORE_START':
        conn.close()
        return jsonify({
            'valid': False,
            'availability_state': 'BEFORE_START',
            'error': f"Test Not Started. Scheduled Start Time: {eval_info['formatted_date']}, {eval_info['start_time']}"
        }), 400

    is_late = (eval_info['availability_state'] == 'AFTER_FINISH')

    existing_attempt = cursor.execute('''
        SELECT * FROM student_attempts WHERE test_id = ? AND registration_no = ?
    ''', (test_id, student['registration_no'])).fetchone()

    if existing_attempt and existing_attempt['attempt_status'] in ('Submitted', 'Terminated'):
        conn.close()
        return jsonify({
            'valid': True,
            'already_submitted': True,
            'attempt_status': existing_attempt['attempt_status'],
            'message': 'Test Already Submitted. A response for this registration number has already been recorded.'
        })

    conn.close()
    return jsonify({
        'valid': True,
        'already_submitted': False,
        'is_late_attempt': is_late,
        'notice': 'Notice: Starting outside official attendance window (Late Attempt).' if is_late else None,
        'student': {
            'registration_no': student['registration_no'],
            'roll_no': student['roll_no'],
            'name': student['name'],
            'class_name': student['class_name']
        }
    })

@app.route('/api/student/start-attempt', methods=['POST'])
def api_student_start_attempt():
    data = request.get_json() or {}
    reg_no = data.get('registration_no', '').strip().upper()
    test_id = data.get('test_id')

    if not reg_no or not test_id:
        return jsonify({'error': 'Missing parameters.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    student = cursor.execute('SELECT * FROM students WHERE UPPER(registration_no) = ?', (reg_no,)).fetchone()
    if not student:
        conn.close()
        return jsonify({'error': 'Student not found.'}), 404

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (test_id,)).fetchone()
    if not test:
        conn.close()
        return jsonify({'error': 'Test not found.'}), 404

    eval_info = evaluate_test_availability(dict(test))
    if eval_info['availability_state'] == 'BEFORE_START':
        conn.close()
        return jsonify({'error': f"Test Not Started. Starts: {eval_info['formatted_date']}, {eval_info['start_time']}"}), 400

    now_dt = datetime.now()
    start_dt, finish_dt = get_test_datetimes(test['test_date'], test['start_time'] if 'start_time' in test.keys() else '10:00 AM', test['finish_time'] if 'finish_time' in test.keys() else '11:00 AM')

    is_late_attempt = 1 if now_dt > finish_dt else 0
    initial_attendance = 'Absent' if is_late_attempt else 'Present'

    attempt = cursor.execute('''
        SELECT * FROM student_attempts WHERE test_id = ? AND registration_no = ?
    ''', (test_id, student['registration_no'])).fetchone()

    now_str = datetime.now(timezone.utc).isoformat()

    if not attempt:
        cursor.execute('''
            INSERT INTO student_attempts (test_id, registration_no, attempt_status, attendance, is_late_attempt, start_time)
            VALUES (?, ?, 'In Progress', ?, ?, ?)
        ''', (test_id, student['registration_no'], initial_attendance, is_late_attempt, now_str))
        conn.commit()
        attempt_id = cursor.lastrowid
        attempt = cursor.execute('SELECT * FROM student_attempts WHERE id = ?', (attempt_id,)).fetchone()
    elif attempt['attempt_status'] in ('Submitted', 'Terminated'):
        conn.close()
        return jsonify({
            'already_submitted': True,
            'message': 'Test Already Submitted. A response for this registration number has already been recorded.'
        }), 400

    # Test Duration Countdown Calculation (Rule 1B & 6)
    duration_mins = int(test['duration_minutes']) if 'duration_minutes' in test.keys() and test['duration_minutes'] else 60
    try:
        attempt_start_str = attempt['start_time']
        if 'T' in attempt_start_str:
            attempt_start_dt = datetime.fromisoformat(attempt_start_str.replace('Z', '+00:00'))
            if attempt_start_dt.tzinfo is not None:
                attempt_start_dt = attempt_start_dt.astimezone().replace(tzinfo=None)
        else:
            attempt_start_dt = datetime.strptime(attempt_start_str, '%Y-%m-%d %H:%M:%S')
    except Exception:
        attempt_start_dt = now_dt

    expiry_dt = attempt_start_dt + timedelta(minutes=duration_mins)
    remaining_seconds = max(0, int((expiry_dt - now_dt).total_seconds()))

    if remaining_seconds <= 0:
        conn.close()
        return jsonify({'error': "Test Time Expired. Your configured test duration has elapsed."}), 400

    q_rows = cursor.execute('SELECT id, test_id, question_number, question_text, option_a, option_b, option_c, option_d, marks FROM test_questions WHERE test_id = ? AND is_active = 1 ORDER BY question_number ASC', (test_id,)).fetchall()
    questions = [dict(q) for q in q_rows]

    saved_rows = cursor.execute('SELECT question_id, selected_option FROM student_answers WHERE attempt_id = ?', (attempt['id'],)).fetchall()
    saved_answers = {r['question_id']: r['selected_option'] for r in saved_rows}

    conn.close()

    return jsonify({
        'attempt_id': attempt['id'],
        'registration_no': student['registration_no'],
        'student': dict(student),
        'test': {
            'id': test['id'],
            'test_number': test['test_number'],
            'test_name': test['test_name'],
            'test_date': eval_info['formatted_date'],
            'start_time': eval_info['start_time'],
            'finish_time': eval_info['finish_time'],
            'start_iso': eval_info['start_iso'],
            'finish_iso': eval_info['finish_iso'],
            'total_marks': test['total_marks'],
            'duration_minutes': test['duration_minutes'] if 'duration_minutes' in test.keys() else 60,
            'remaining_seconds': remaining_seconds,
            'instructions': test['instructions'] if 'instructions' in test.keys() else ''
        },
        'questions': questions,
        'saved_answers': saved_answers,
        'violation_count': attempt['violation_count']
    })

@app.route('/api/student/save-answer', methods=['POST'])
def api_student_save_answer():
    data = request.get_json() or {}
    attempt_id = data.get('attempt_id')
    question_id = data.get('question_id')
    selected_option = data.get('selected_option', '').strip().upper()

    if not attempt_id or not question_id:
        return jsonify({'error': 'attempt_id and question_id required.'}), 400

    if selected_option and selected_option not in ('A', 'B', 'C', 'D'):
        return jsonify({'error': 'Invalid selected option.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    attempt = cursor.execute('SELECT * FROM student_attempts WHERE id = ?', (attempt_id,)).fetchone()
    if not attempt:
        conn.close()
        return jsonify({'error': 'Attempt not found.'}), 404

    test = cursor.execute('SELECT * FROM tests WHERE id = ?', (attempt['test_id'],)).fetchone()

    # Check if student duration has expired
    if test and attempt['start_time']:
        duration_mins = int(test['duration_minutes']) if 'duration_minutes' in test.keys() and test['duration_minutes'] else 60
        now_dt = datetime.now()
        try:
            attempt_start_str = attempt['start_time']
            if 'T' in attempt_start_str:
                attempt_start_dt = datetime.fromisoformat(attempt_start_str.replace('Z', '+00:00'))
                if attempt_start_dt.tzinfo is not None:
                    attempt_start_dt = attempt_start_dt.astimezone().replace(tzinfo=None)
            else:
                attempt_start_dt = datetime.strptime(attempt_start_str, '%Y-%m-%d %H:%M:%S')
        except Exception:
            attempt_start_dt = now_dt

        expiry_dt = attempt_start_dt + timedelta(minutes=duration_mins)
        if now_dt > expiry_dt:
            answers = cursor.execute('''
                SELECT sa.selected_option, q.correct_option, q.marks
                FROM student_answers sa
                JOIN test_questions q ON sa.question_id = q.id
                WHERE sa.attempt_id = ?
            ''', (attempt_id,)).fetchall()

            total_marks = float(test['total_marks']) if test else 1.0
            score = 0.0
            for a in answers:
                if a['selected_option'] and a['selected_option'] == a['correct_option']:
                    score += float(a['marks'])

            percentage = round((score / total_marks) * 100.0, 2) if total_marks > 0 else 0.0
            now_str = datetime.now(timezone.utc).isoformat()

            cursor.execute('''
                UPDATE student_attempts
                SET attempt_status = 'Submitted', end_time = ?, calculated_score = ?, calculated_percentage = ?, updated_at = ?
                WHERE id = ?
            ''', (now_str, score, percentage, now_str, attempt_id))
            conn.commit()
            conn.close()

            return jsonify({
                'expired': True,
                'error': 'Test Duration Expired. Your test duration has elapsed and your answers have been submitted.'
            }), 400

    if attempt['attempt_status'] in ('Submitted', 'Terminated'):
        conn.close()
        return jsonify({'error': 'Attempt has been closed.'}), 400

    cursor.execute('''
        INSERT INTO student_answers (attempt_id, question_id, selected_option, saved_at)
        VALUES (?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(attempt_id, question_id) DO UPDATE SET selected_option = excluded.selected_option, saved_at = CURRENT_TIMESTAMP
    ''', (attempt_id, question_id, selected_option))

    answers = cursor.execute('''
        SELECT sa.selected_option, q.correct_option, q.marks
        FROM student_answers sa
        JOIN test_questions q ON sa.question_id = q.id
        WHERE sa.attempt_id = ?
    ''', (attempt_id,)).fetchall()

    total_marks = float(test['total_marks']) if test else 1.0

    score = 0.0
    for a in answers:
        if a['selected_option'] and a['selected_option'] == a['correct_option']:
            score += float(a['marks'])

    percentage = round((score / total_marks) * 100.0, 2) if total_marks > 0 else 0.0

    now_str = datetime.now(timezone.utc).isoformat()
    cursor.execute('''
        UPDATE student_attempts
        SET calculated_score = ?, calculated_percentage = ?, updated_at = ?
        WHERE id = ?
    ''', (score, percentage, now_str, attempt_id))

    conn.commit()
    conn.close()

    return jsonify({'success': True, 'saved_at': now_str})

@app.route('/api/student/log-violation', methods=['POST'])
def api_student_log_violation():
    data = request.get_json() or {}
    attempt_id = data.get('attempt_id')
    reason = data.get('reason', 'Fullscreen exited').strip()

    if not attempt_id:
        return jsonify({'error': 'attempt_id required.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    attempt = cursor.execute('SELECT * FROM student_attempts WHERE id = ?', (attempt_id,)).fetchone()
    if not attempt:
        conn.close()
        return jsonify({'error': 'Attempt not found.'}), 404

    current_count = attempt['violation_count'] + 1
    
    try:
        logs = json.loads(attempt['violation_logs_json'] or '[]')
    except Exception:
        logs = []

    now_str = datetime.now(timezone.utc).isoformat()
    logs.append({'timestamp': now_str, 'reason': reason, 'violation_number': current_count})

    is_terminated = (current_count >= 4)
    new_status = 'Terminated' if is_terminated else attempt['attempt_status']

    cursor.execute('''
        UPDATE student_attempts
        SET violation_count = ?, violation_logs_json = ?, attempt_status = ?, updated_at = ?
        WHERE id = ?
    ''', (current_count, json.dumps(logs), new_status, now_str, attempt_id))

    conn.commit()
    conn.close()

    if is_terminated:
        return jsonify({
            'terminated': True,
            'violation_count': current_count,
            'message': 'Test Terminated. Your test has been terminated because fullscreen mode was exited repeatedly. Your answers up to this point have been saved. Your submission will be reviewed by the administrator.'
        })

    return jsonify({
        'terminated': False,
        'violation_count': current_count,
        'message': f'Fullscreen Exited. Warning {current_count}/3.'
    })

@app.route('/api/student/submit-attempt', methods=['POST'])
def api_student_submit_attempt():
    data = request.get_json() or {}
    attempt_id = data.get('attempt_id')

    if not attempt_id:
        return jsonify({'error': 'attempt_id required.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    attempt = cursor.execute('SELECT * FROM student_attempts WHERE id = ?', (attempt_id,)).fetchone()
    if not attempt:
        conn.close()
        return jsonify({'error': 'Attempt not found.'}), 404

    now_str = datetime.now(timezone.utc).isoformat()

    answers = cursor.execute('''
        SELECT sa.selected_option, q.correct_option, q.marks
        FROM student_answers sa
        JOIN test_questions q ON sa.question_id = q.id
        WHERE sa.attempt_id = ?
    ''', (attempt_id,)).fetchall()

    test = cursor.execute('SELECT total_marks FROM tests WHERE id = ?', (attempt['test_id'],)).fetchone()
    total_marks = float(test['total_marks']) if test else 1.0

    score = 0.0
    for a in answers:
        if a['selected_option'] and a['selected_option'] == a['correct_option']:
            score += float(a['marks'])

    percentage = round((score / total_marks) * 100.0, 2) if total_marks > 0 else 0.0

    cursor.execute('''
        UPDATE student_attempts
        SET attempt_status = 'Submitted', attendance = 'Present', end_time = ?, calculated_score = ?, calculated_percentage = ?, updated_at = ?
        WHERE id = ?
    ''', (now_str, score, percentage, now_str, attempt_id))

    conn.commit()
    conn.close()

    return jsonify({
        'success': True,
        'message': 'Test Submitted. Your response has been recorded successfully. Results will be published after verification.'
    })

# --- SYLLABUS MANAGEMENT ---
@app.route('/api/admin/syllabus', methods=['POST'])
@auth.admin_required
def api_admin_save_syllabus():
    data = request.get_json() or {}
    test_id = data.get('test_id')
    category_name = data.get('category_name', '').strip()
    topics = data.get('topics', [])
    display_order = data.get('display_order', 0)

    if not test_id or not category_name:
        return jsonify({'error': 'test_id and category_name are required.'}), 400

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO syllabus_categories (test_id, category_name, topics_json, display_order)
        VALUES (?, ?, ?, ?)
    ''', (test_id, category_name, json.dumps(topics), display_order))
    conn.commit()
    conn.close()

    set_last_updated('syllabus_last_updated')
    return jsonify({'success': True, 'message': 'Syllabus category added successfully.'})

@app.route('/api/admin/syllabus/<int:category_id>', methods=['DELETE'])
@auth.admin_required
def api_admin_delete_syllabus(category_id):
    conn = get_db()
    conn.execute('DELETE FROM syllabus_categories WHERE id = ?', (category_id,))
    conn.commit()
    conn.close()
    set_last_updated('syllabus_last_updated')
    return jsonify({'success': True, 'message': 'Syllabus category removed.'})

# --- RESOURCE UPLOADS ---
@app.route('/api/admin/resources/upload', methods=['POST'])
@auth.admin_required
def api_admin_upload_resource():
    test_id = request.form.get('test_id')
    resource_type = request.form.get('resource_type')  # notes, practice, question_paper, answer_key
    title = request.form.get('title', '').strip()

    if not test_id or not resource_type or 'file' not in request.files:
        return jsonify({'error': 'Missing required fields or file.'}), 400

    if resource_type not in ('notes', 'practice', 'question_paper', 'answer_key'):
        return jsonify({'error': 'Invalid resource type.'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file.'}), 400

    filename = secure_filename(file.filename)
    file_bytes = file.read()

    # Predictable bucket & relative path
    if resource_type == 'question_paper':
        bucket_name = 'question-papers'
        relative_path = f"{test_id}/question-paper.pdf"
    elif resource_type == 'answer_key':
        bucket_name = 'answer-keys'
        relative_path = f"{test_id}/answer-key.pdf"
    else:
        bucket_name = 'resources'
        unique_filename = f"{test_id}_{resource_type}_{int(datetime.now().timestamp())}_{filename}"
        relative_path = f"{test_id}/{unique_filename}"

    upload_info = storage_manager.upload_file(bucket_name, relative_path, file_bytes, content_type=file.content_type)

    if not title:
        title = filename

    # Record PostgreSQL metadata
    resource_id = storage_manager.record_resource_metadata(
        test_id=test_id,
        class_id=None,
        resource_type=resource_type,
        title=title,
        storage_path=upload_info['storage_path'],
        file_path=upload_info['file_path'],
        visibility='public' if resource_type in ('notes', 'practice') else 'completed_only'
    )

    set_last_updated(f"resource_{resource_type}_last_updated")
    log_audit_event('UPLOAD_RESOURCE', test_id=test_id, details=upload_info['storage_path'])

    return jsonify({
        'success': True,
        'resource_id': resource_id,
        'storage_path': upload_info['storage_path'],
        'file_path': upload_info['file_path'],
        'message': f'{resource_type.replace("_", " ").title()} uploaded successfully to Supabase Storage.'
    })

@app.route('/api/admin/students/summary', methods=['GET'])
@auth.admin_required
def api_admin_students_summary():
    conn = get_db()
    rows = conn.execute('SELECT class_name, COUNT(*) as cnt FROM students GROUP BY class_name').fetchall()
    conn.close()

    summary = {'SY': 0, 'TY': 0, 'Final Year': 0}
    for r in rows:
        if r['class_name'] in summary:
            summary[r['class_name']] = r['cnt']

    return jsonify(summary)

@app.route('/api/admin/dashboard-stats', methods=['GET'])
@auth.admin_required
def api_admin_dashboard_stats():
    conn = get_db()
    cursor = conn.cursor()

    students_by_class = cursor.execute('SELECT class_name, COUNT(*) as cnt FROM students GROUP BY class_name').fetchall()
    summary = {'SY': 0, 'TY': 0, 'Final Year': 0}
    total_students = 0
    for r in students_by_class:
        if r['class_name'] in summary:
            summary[r['class_name']] = r['cnt']
            total_students += r['cnt']

    tests = cursor.execute('SELECT status, is_published FROM tests').fetchall()
    upcoming_cnt = sum(1 for t in tests if t['status'] == 'Upcoming')
    current_cnt = sum(1 for t in tests if t['status'] == 'Current')
    completed_cnt = sum(1 for t in tests if t['status'] == 'Completed')
    published_cnt = sum(1 for t in tests if t['is_published'] == 1)

    latest_pub = cursor.execute("SELECT MAX(updated_at) as last_pub FROM system_settings WHERE key = 'rankings_last_updated'").fetchone()
    last_pub_time = latest_pub['last_pub'] if latest_pub and latest_pub['last_pub'] else 'Never'

    last_updated = get_last_updated('rankings_last_updated') or datetime.now().strftime('%d/%m/%y, %I:%M %p')

    conn.close()

    return jsonify({
        'class_counts': summary,
        'total_students': total_students,
        'tests_summary': {
            'upcoming': upcoming_cnt,
            'current': current_cnt,
            'completed': completed_cnt,
            'published': published_cnt,
            'total_tests': len(tests)
        },
        'latest_publication': last_pub_time,
        'last_updated': last_updated
    })

@app.route('/api/admin/students/class/<path:class_name>', methods=['GET'])
@auth.admin_required
def api_admin_get_students_by_class(class_name):
    conn = get_db()
    students = conn.execute('SELECT registration_no, roll_no, name, class_name FROM students WHERE class_name = ? ORDER BY roll_no ASC, name ASC', (class_name,)).fetchall()
    conn.close()
    return jsonify([dict(s) for s in students])

@app.route('/api/admin/students', methods=['POST'])
@auth.admin_required
def api_admin_add_student():
    data = request.get_json() or {}
    name = str(data.get('name', '')).strip()
    registration_no = str(data.get('registration_number', '') or data.get('registration_no', '')).strip()
    roll_no = str(data.get('roll_number', '') or data.get('roll_no', '')).strip()
    class_name = str(data.get('class_name', '')).strip()

    if not name or not registration_no or not roll_no or not class_name:
        return jsonify({'success': False, 'error': 'All fields (Name, Registration Number, Roll Number, Class) are required.'}), 400

    if class_name not in ('SY', 'TY', 'Final Year'):
        return jsonify({'success': False, 'error': 'Invalid class name. Supported classes: SY, TY, Final Year.'}), 400

    conn = get_db()
    cursor = conn.cursor()

    # 1. Registration Number Uniqueness Check
    existing_reg = cursor.execute('''
        SELECT registration_no FROM students WHERE LOWER(registration_no) = LOWER(?) OR LOWER(registration_number) = LOWER(?)
    ''', (registration_no, registration_no)).fetchone()

    if existing_reg:
        conn.close()
        return jsonify({'success': False, 'error': f'Registration number "{registration_no}" already exists in master database.'}), 400

    # 2. Roll Number Uniqueness Check within class
    existing_roll = cursor.execute('''
        SELECT roll_no FROM students WHERE class_name = ? AND (LOWER(roll_no) = LOWER(?) OR LOWER(roll_number) = LOWER(?))
    ''', (class_name, roll_no, roll_no)).fetchone()

    if existing_roll:
        conn.close()
        return jsonify({'success': False, 'error': f'Roll number "{roll_no}" already exists for class {class_name}.'}), 400

    # Fetch class_id if exists
    class_row = cursor.execute('SELECT id FROM classes WHERE code = ? OR name = ?', (class_name, class_name)).fetchone()
    class_id = class_row['id'] if class_row else None

    # Insert student
    cursor.execute('''
        INSERT INTO students (registration_no, registration_number, roll_no, roll_number, name, class_id, class_name)
        VALUES (?, ?, ?, ?, ?, ?, ?)
    ''', (registration_no, registration_no, roll_no, roll_no, name, class_id, class_name))

    # 3. Process Historical Completed Tests for Late Student:
    # Ensure completed / published tests have default Absent (0%) records for this student
    completed_tests = cursor.execute('''
        SELECT id FROM tests WHERE status = 'Completed' OR is_published = 1
    ''').fetchall()

    for t in completed_tests:
        tid = t['id']
        cursor.execute('''
            INSERT INTO attendance (test_id, student_id, registration_no, status, updated_by)
            VALUES (?, NULL, ?, 'Absent', 'System')
            ON CONFLICT (test_id, registration_no) DO NOTHING;
        ''', (tid, registration_no))

        cursor.execute('''
            INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained, percentage, published, updated_by)
            VALUES (?, NULL, ?, 'Absent', 0.0, 0.0, 1, 'System')
            ON CONFLICT (test_id, registration_no) DO NOTHING;
        ''', (tid, registration_no))

    conn.commit()
    conn.close()

    # Recalculate competition rankings & Cognify averages
    recalculate_scores_and_rankings()
    log_audit_event('ADD_STUDENT', registration_no=registration_no, new_value=f"Added {name} to {class_name}")

    return jsonify({
        'success': True,
        'registration_no': registration_no,
        'message': f'Student "{name}" ({registration_no}) added successfully to {class_name}.'
    })

@app.route('/api/student/dashboard/<registration_no>', methods=['GET'])
def api_student_get_dashboard(registration_no):
    reg_no = registration_no.strip().upper()
    conn = get_db()
    cursor = conn.cursor()

    student = cursor.execute('SELECT registration_no, roll_no, name, class_name FROM students WHERE UPPER(registration_no) = ?', (reg_no,)).fetchone()
    if not student:
        conn.close()
        return jsonify({'found': False, 'error': f'Registration number "{reg_no}" not found in master database.'}), 404

    score_row = cursor.execute('SELECT cognify_score, completed_tests_count, rank FROM student_scores WHERE registration_no = ?', (student['registration_no'],)).fetchone()
    cognify_score = score_row['cognify_score'] if score_row else 0.0
    rank = score_row['rank'] if score_row else 0

    published_tests = cursor.execute('SELECT id, test_number, test_name, test_date, total_marks FROM tests WHERE is_published = 1 ORDER BY id ASC').fetchall()

    results_list = []
    for t in published_tests:
        tid = t['id']
        t_marks = float(t['total_marks'])

        res = cursor.execute('SELECT attendance, marks_obtained, percentage FROM test_results WHERE test_id = ? AND registration_no = ?', (tid, student['registration_no'])).fetchone()

        if res:
            att = res['attendance']
            m_obtained = float(res['marks_obtained'])
            pct = float(res['percentage'])
        else:
            att_row = cursor.execute('SELECT attendance, calculated_score, calculated_percentage FROM student_attempts WHERE test_id = ? AND registration_no = ?', (tid, student['registration_no'])).fetchone()
            if att_row:
                att = att_row['attendance']
                m_obtained = float(att_row['calculated_score']) if att == 'Present' else 0.0
                pct = float(att_row['calculated_percentage']) if att == 'Present' else 0.0
            else:
                att = 'Absent'
                m_obtained = 0.0
                pct = 0.0

        results_list.append({
            'test_id': tid,
            'test_number': t['test_number'],
            'test_name': t['test_name'],
            'test_date': t['test_date'],
            'total_marks': t_marks,
            'attendance': att,
            'marks_obtained': m_obtained,
            'percentage': pct
        })

    conn.close()

    return jsonify({
        'found': True,
        'student': dict(student),
        'cognify_score': cognify_score,
        'rank': rank,
        'completed_tests_count': len(published_tests),
        'results': results_list
    })

@app.route('/api/admin/students/validate', methods=['POST'])
@auth.admin_required
def api_admin_validate_student_list():
    target_class = request.form.get('class_name')
    if not target_class or 'file' not in request.files:
        return jsonify({'valid': False, 'errors': ['Target class and Excel file are required.']}), 400

    file = request.files['file']
    if not file.filename.endswith('.xlsx'):
        return jsonify({'valid': False, 'errors': ['Only .xlsx Excel files are supported.']}), 400

    from excel_processor import validate_student_list_excel
    preview = validate_student_list_excel(file.stream, target_class)

    conn = get_db()
    existing_count = conn.execute('SELECT COUNT(*) as cnt FROM students WHERE class_name = ?', (target_class,)).fetchone()['cnt']
    conn.close()

    preview['existing_count'] = existing_count
    return jsonify(preview)

@app.route('/api/admin/students/import', methods=['POST'])
@auth.admin_required
def api_admin_import_student_list():
    data = request.get_json() or {}
    target_class = data.get('class_name')
    parsed_students = data.get('parsed_students', [])

    if not target_class or not parsed_students:
        return jsonify({'success': False, 'error': 'Invalid payload for student list import.'}), 400

    from excel_processor import save_master_student_list
    result = save_master_student_list(target_class, parsed_students)
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 500

@app.route('/api/admin/resources/<int:resource_id>', methods=['DELETE'])
@auth.admin_required
def api_admin_delete_resource(resource_id):
    conn = get_db()
    cursor = conn.cursor()
    resource = cursor.execute('SELECT * FROM resources WHERE id = ?', (resource_id,)).fetchone()

    if resource:
        rel_path = resource['file_path'].lstrip('/')
        full_path = os.path.join(Config.BASE_DIR, rel_path)
        if os.path.exists(full_path):
            try:
                os.remove(full_path)
            except Exception:
                pass
        cursor.execute('DELETE FROM resources WHERE id = ?', (resource_id,))
        conn.commit()

    conn.close()
    return jsonify({'success': True, 'message': 'Resource deleted successfully.'})

# --- EXCEL RESULTS IMPORT & PUBLISHING ---
@app.route('/api/admin/results/validate', methods=['POST'])
@auth.admin_required
def api_admin_validate_results():
    test_id = request.form.get('test_id')
    if not test_id or 'file' not in request.files:
        return jsonify({'valid': False, 'errors': ['Test ID and Excel file are required.']}), 400

    file = request.files['file']
    if not file.filename.endswith('.xlsx'):
        return jsonify({'valid': False, 'errors': ['Only .xlsx Excel files are supported.']}), 400

    preview = validate_excel_results(file.stream, int(test_id))

    # Check if results already exist for this test
    conn = get_db()
    existing_count = conn.execute('SELECT COUNT(*) as cnt FROM test_results WHERE test_id = ?', (test_id,)).fetchone()['cnt']
    conn.close()

    preview['results_exist'] = existing_count > 0
    return jsonify(preview)

@app.route('/api/admin/results/publish', methods=['POST'])
@auth.admin_required
def api_admin_publish_results():
    data = request.get_json() or {}
    test_id = data.get('test_id')
    parsed_records = data.get('parsed_records', [])
    missing_regs = data.get('missing_regs', [])

    if not test_id or not parsed_records:
        return jsonify({'success': False, 'error': 'Invalid payload for publishing results.'}), 400

    result = publish_test_results(int(test_id), parsed_records, missing_regs)
    if result['success']:
        return jsonify(result)
    else:
        return jsonify(result), 500

@app.route('/api/admin/backup', methods=['GET'])
@auth.admin_required
def api_admin_backup():
    now_str = datetime.now().strftime("%Y%m%d_%H%M%S")
    backup_filename = f"cognify_backup_{now_str}.zip"
    backup_path = os.path.join(Config.BACKUP_FOLDER, backup_filename)
    os.makedirs(os.path.dirname(backup_path), exist_ok=True)

    with zipfile.ZipFile(backup_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
        # Add database
        db_file = os.path.join(Config.BASE_DIR, 'storage', 'cognify.db')
        if os.path.exists(db_file):
            zipf.write(db_file, arcname='cognify.db')

        # Add storage folder
        for root, _, files in os.walk(storage_manager.LOCAL_STORAGE_DIR):
            for file in files:
                abs_f = os.path.join(root, file)
                rel_f = os.path.relpath(abs_f, Config.BASE_DIR)
                zipf.write(abs_f, arcname=rel_f)

    with open(backup_path, 'rb') as f:
        backup_bytes = f.read()

    relative_path = f"{now_str}/{backup_filename}"
    upload_info = storage_manager.upload_file('backups', relative_path, backup_bytes, content_type='application/zip')

    date_ddmmyy = datetime.now().strftime("%d/%m/%y")
    set_last_updated('backup_last_updated', date_ddmmyy)

    conn = get_db()
    cursor = conn.cursor()
    cursor.execute('''
        INSERT INTO backups (storage_path, status, metadata, created_at)
        VALUES (?, 'Completed', ?, CURRENT_TIMESTAMP)
    ''', (upload_info['storage_path'], json.dumps({'size': len(backup_bytes), 'date': date_ddmmyy})))
    conn.commit()
    conn.close()

    log_audit_event('CREATE_BACKUP', details=upload_info['storage_path'])
    return send_file(backup_path, as_attachment=True, download_name=backup_filename)

@app.route('/api/admin/resources/all', methods=['GET'])
@auth.admin_required
def api_admin_get_all_resources():
    conn = get_db()
    rows = conn.execute('''
        SELECT r.*, t.test_number, t.test_name
        FROM resources r
        JOIN tests t ON r.test_id = t.id
        ORDER BY r.id DESC
    ''').fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/admin/syllabus/all', methods=['GET'])
@auth.admin_required
def api_admin_get_all_syllabus():
    conn = get_db()
    rows = conn.execute('''
        SELECT s.*, t.test_number, t.test_name
        FROM syllabus_categories s
        JOIN tests t ON s.test_id = t.id
        ORDER BY s.test_id ASC, s.display_order ASC
    ''').fetchall()
    conn.close()
    result = []
    for r in rows:
        d = dict(r)
        try:
            d['topics'] = json.loads(d['topics_json'])
        except Exception:
            d['topics'] = []
        result.append(d)
    return jsonify(result)

@app.route('/api/admin/results/test/<int:test_id>', methods=['GET'])
@auth.admin_required
def api_admin_get_test_results(test_id):
    conn = get_db()
    rows = conn.execute('''
        SELECT tr.*, s.roll_no, s.name as student_name, s.class_name
        FROM test_results tr
        JOIN students s ON tr.registration_no = s.registration_no
        WHERE tr.test_id = ?
        ORDER BY tr.percentage DESC, s.name ASC
    ''', (test_id,)).fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/admin/backups/history', methods=['GET'])
@auth.admin_required
def api_admin_get_backup_history():
    backups = []
    if os.path.exists(Config.BACKUP_FOLDER):
        for f in os.listdir(Config.BACKUP_FOLDER):
            if f.endswith('.zip'):
                fpath = os.path.join(Config.BACKUP_FOLDER, f)
                stat = os.stat(fpath)
                mtime = datetime.fromtimestamp(stat.st_mtime).strftime('%d/%m/%y, %I:%M %p')
                backups.append({
                    'filename': f,
                    'created_at': mtime,
                    'size_bytes': stat.st_size,
                    'file_path': f'/api/admin/backup/download/{f}'
                })
    backups.sort(key=lambda x: x['created_at'], reverse=True)
    return jsonify(backups)

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

