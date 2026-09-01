from database import get_db, set_last_updated, get_last_updated
from datetime import datetime, timezone
import json

def recalculate_scores_and_rankings():
    """
    Recalculates Cognify Scores and competition rankings for all students across all completed tests.
    Formula:
      For each completed test:
        Percentage = (marks_obtained / total_marks) * 100
        Absent = 0% (counts towards denominator)
      Cognify Score = Average of all completed test percentages.
      Competition ranking (1, 2, 2, 4, 5) per class.
    """
    conn = get_db()
    cursor = conn.cursor()

    # 1. Fetch all published test IDs and their total_marks
    completed_tests = cursor.execute('''
        SELECT id, total_marks FROM tests WHERE is_published = 1
    ''').fetchall()

    completed_test_ids = [t['id'] for t in completed_tests]
    num_completed_tests = len(completed_test_ids)

    # 2. Fetch all master students
    students = cursor.execute('''
        SELECT registration_no, roll_no, name, class_name FROM students
    ''').fetchall()

    if not students:
        conn.close()
        return

    student_calculated_scores = []

    if num_completed_tests == 0:
        # No completed tests yet - scores are 0% for everyone
        for s in students:
            student_calculated_scores.append({
                'registration_no': s['registration_no'],
                'cognify_score': 0.0,
                'completed_tests_count': 0,
                'class_name': s['class_name'],
                'name': s['name']
            })
    else:
        # Pre-fetch all results for completed tests
        placeholders = ','.join(['?'] * len(completed_test_ids))
        results_rows = cursor.execute(f'''
            SELECT registration_no, test_id, attendance, marks_obtained, percentage
            FROM test_results
            WHERE test_id IN ({placeholders})
        ''', completed_test_ids).fetchall()

        # Map results: (registration_no, test_id) -> percentage
        results_map = {}
        for r in results_rows:
            pct = r['percentage'] if r['attendance'] == 'Present' else 0.0
            results_map[(r['registration_no'], r['test_id'])] = pct

        for s in students:
            reg_no = s['registration_no']
            total_percentage_sum = 0.0
            for tid in completed_test_ids:
                # If student record exists in result, use that percentage (0 if Absent)
                # If student was not listed in the sheet, treat as Absent (0%)
                pct = results_map.get((reg_no, tid), 0.0)
                total_percentage_sum += pct
            
            avg_score = round(total_percentage_sum / num_completed_tests, 2)
            student_calculated_scores.append({
                'registration_no': reg_no,
                'cognify_score': avg_score,
                'completed_tests_count': num_completed_tests,
                'class_name': s['class_name'],
                'name': s['name']
            })

    # 3. Compute Competition Ranking per class group ('SY', 'TY', 'Final Year')
    classes = ['SY', 'TY', 'Final Year']
    now_str = datetime.now(timezone.utc).isoformat()

    cursor.execute('DELETE FROM student_scores;')

    for c in classes:
        class_students = [s for s in student_calculated_scores if s['class_name'] == c]
        # Sort by score descending, then by name ascending for stability
        class_students.sort(key=lambda x: (-x['cognify_score'], x['name']))

        # Apply Competition Ranking (1, 2, 2, 4, 5)
        # Standard competition rank = 1 + number of students strictly higher score
        for i, student in enumerate(class_students):
            score = student['cognify_score']
            if num_completed_tests == 0 or score == 0.0:
                # If score is 0 / no tests, rank is 0 or unranked indicator, but we keep standard competition rank
                # Count how many students have strictly higher score
                higher_count = sum(1 for s in class_students if s['cognify_score'] > score)
                rank = higher_count + 1
            else:
                higher_count = sum(1 for s in class_students if s['cognify_score'] > score)
                rank = higher_count + 1

            cursor.execute('''
                INSERT INTO student_scores (registration_no, cognify_score, completed_tests_count, rank, class_name, last_updated)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (student['registration_no'], student['cognify_score'], student['completed_tests_count'], rank, c, now_str))

    conn.commit()
    conn.close()

    # Update system last_updated setting
    set_last_updated('rankings_last_updated', now_str)

def get_top10_rankings(class_name=None):
    """
    Returns rankings for rank <= 10 per class (or specified class).
    Includes students tied at rank 10 cutoff.
    """
    conn = get_db()
    cursor = conn.cursor()

    query = '''
        SELECT ss.registration_no, ss.cognify_score, ss.completed_tests_count, ss.rank, ss.class_name, ss.last_updated,
               s.roll_no, s.name
        FROM student_scores ss
        JOIN students s ON ss.registration_no = s.registration_no
        WHERE ss.rank <= 10 AND ss.cognify_score > 0
    '''
    params = []
    if class_name:
        query += ' AND ss.class_name = ?'
        params.append(class_name)

    query += ' ORDER BY ss.class_name ASC, ss.rank ASC, s.name ASC'

    rows = cursor.execute(query, params).fetchall()
    conn.close()

    result = {}
    for r in rows:
        cname = r['class_name']
        if cname not in result:
            result[cname] = []
        result[cname].append({
            'registration_no': r['registration_no'],
            'roll_no': r['roll_no'],
            'name': r['name'],
            'cognify_score': r['cognify_score'],
            'completed_tests_count': r['completed_tests_count'],
            'rank': r['rank']
        })

    last_updated = get_last_updated('rankings_last_updated')
    return {
        'rankings': result,
        'last_updated': last_updated
    }

def get_all_rankings(class_name):
    """
    Returns full rankings for a given class (Rankings page).
    Only includes public attributes: rank, name, cognify_score.
    """
    conn = get_db()
    cursor = conn.cursor()
    rows = cursor.execute('''
        SELECT ss.rank, s.name, ss.cognify_score, ss.completed_tests_count
        FROM student_scores ss
        JOIN students s ON ss.registration_no = s.registration_no
        WHERE ss.class_name = ?
        ORDER BY ss.rank ASC, s.name ASC
    ''', (class_name,)).fetchall()
    conn.close()

    return [{
        'rank': r['rank'],
        'name': r['name'],
        'cognify_score': r['cognify_score'],
        'completed_tests_count': r['completed_tests_count']
    } for r in rows]

def parse_date_str(date_str):
    """
    Parses date string which can be DD/MM/YY, DD/MM/YYYY, or YYYY-MM-DD.
    Returns (year, month, day) tuple.
    """
    if not date_str:
        now = datetime.now()
        return now.year, now.month, now.day
    
    date_str = str(date_str).strip()
    parts = date_str.split('/')
    if len(parts) == 3:
        day = int(parts[0])
        month = int(parts[1])
        yr = int(parts[2])
        if yr < 100:
            yr += 2000
        return yr, month, day
    
    parts = date_str.split('-')
    if len(parts) == 3:
        if len(parts[0]) == 4:
            return int(parts[0]), int(parts[1]), int(parts[2])
        else:
            yr = int(parts[2])
            if yr < 100:
                yr += 2000
            return yr, int(parts[1]), int(parts[0])
            
    now = datetime.now()
    return now.year, now.month, now.day

def parse_time_str(time_str):
    """
    Parses time string like "10:00 AM", "11:30 PM", "14:00".
    Returns (hour, minute) tuple.
    """
    if not time_str:
        return 10, 0
    
    time_str = str(time_str).strip().upper()
    try:
        dt = datetime.strptime(time_str, "%I:%M %p")
        return dt.hour, dt.minute
    except ValueError:
        pass
    
    try:
        dt = datetime.strptime(time_str, "%H:%M")
        return dt.hour, dt.minute
    except ValueError:
        pass

    try:
        dt = datetime.strptime(time_str, "%I:%M%p")
        return dt.hour, dt.minute
    except ValueError:
        pass
        
    return 10, 0

def format_date_ddmmyy(date_str):
    """
    Formats any input date string to DD/MM/YY.
    """
    try:
        yr, mo, dy = parse_date_str(date_str)
        yr_short = str(yr)[-2:]
        return f"{dy:02d}/{mo:02d}/{yr_short}"
    except Exception:
        return date_str

def get_test_datetimes(test_date_str, start_time_str, finish_time_str):
    """
    Returns (start_datetime, finish_datetime) as naive datetime objects.
    """
    yr, mo, dy = parse_date_str(test_date_str)
    s_hr, s_min = parse_time_str(start_time_str or '10:00 AM')
    f_hr, f_min = parse_time_str(finish_time_str or '11:00 AM')

    start_dt = datetime(yr, mo, dy, s_hr, s_min)
    finish_dt = datetime(yr, mo, dy, f_hr, f_min)

    if finish_dt <= start_dt:
        from datetime import timedelta
        finish_dt += timedelta(days=1)

    return start_dt, finish_dt

def evaluate_test_availability(test, current_dt=None):
    """
    Evaluates test availability state:
    - 'BEFORE_START': current_time < start_datetime
    - 'ACTIVE': start_datetime <= current_time < finish_datetime
    - 'AFTER_FINISH': current_time >= finish_datetime
    
    Resource access (Question Paper & Answer Key) requires BOTH:
    1. current_time >= finish_datetime
    2. status == 'Completed'
    """
    if current_dt is None:
        current_dt = datetime.now()

    t_date = test['test_date'] if isinstance(test, dict) or hasattr(test, 'keys') else getattr(test, 'test_date', '')
    s_time = test['start_time'] if (isinstance(test, dict) or hasattr(test, 'keys')) and 'start_time' in test.keys() else getattr(test, 'start_time', '10:00 AM')
    f_time = test['finish_time'] if (isinstance(test, dict) or hasattr(test, 'keys')) and 'finish_time' in test.keys() else getattr(test, 'finish_time', '11:00 AM')

    start_dt, finish_dt = get_test_datetimes(t_date, s_time, f_time)
    formatted_date = format_date_ddmmyy(t_date)

    if current_dt < start_dt:
        state = 'BEFORE_START'
    elif current_dt >= finish_dt:
        state = 'AFTER_FINISH'
    else:
        state = 'ACTIVE'

    if isinstance(test, dict):
        test_status = test.get('status') or test.get('test_status') or 'Upcoming'
    else:
        test_status = getattr(test, 'status', getattr(test, 'test_status', 'Upcoming'))
    resources_accessible = (current_dt >= finish_dt) and (test_status == 'Completed')

    return {
        'formatted_date': formatted_date,
        'start_time': s_time,
        'finish_time': f_time,
        'start_iso': start_dt.isoformat(),
        'finish_iso': finish_dt.isoformat(),
        'current_iso': current_dt.isoformat(),
        'availability_state': state,
        'resources_accessible': resources_accessible
    }

def get_test_timeline():
    """
    Returns Previous Test, Current Test, Next Test overview.
    - Previous Test: Most recently completed test
    - Current Test: Test marked Current by administrator
    - Next Test: Earliest Upcoming test
    """
    conn = get_db()
    cursor = conn.cursor()

    current_test = cursor.execute('''
        SELECT * FROM tests WHERE status = 'Current' ORDER BY test_date DESC LIMIT 1
    ''').fetchone()

    previous_test = cursor.execute('''
        SELECT * FROM tests WHERE status = 'Completed' ORDER BY test_date DESC, id DESC LIMIT 1
    ''').fetchone()

    next_test = cursor.execute('''
        SELECT * FROM tests WHERE status = 'Upcoming' ORDER BY test_date ASC, id ASC LIMIT 1
    ''').fetchone()

    conn.close()

    def format_test(t):
        if not t:
            return None
        eval_info = evaluate_test_availability(t)
        return {
            'id': t['id'],
            'test_number': t['test_number'],
            'test_name': t['test_name'],
            'test_date': eval_info['formatted_date'],
            'raw_test_date': t['test_date'],
            'start_time': eval_info['start_time'],
            'finish_time': eval_info['finish_time'],
            'total_marks': t['total_marks'],
            'status': t['status'],
            'is_published': bool(t['is_published']) if 'is_published' in t.keys() else False,
            'availability_state': eval_info['availability_state'],
            'resources_accessible': eval_info['resources_accessible'],
            'start_iso': eval_info['start_iso'],
            'finish_iso': eval_info['finish_iso']
        }

    return {
        'previous': format_test(previous_test),
        'current': format_test(current_test),
        'next': format_test(next_test)
    }

def get_current_test_details():
    """
    Returns current test along with its syllabus categories, topics, and resource availability.
    """
    conn = get_db()
    cursor = conn.cursor()

    current_test = cursor.execute('''
        SELECT * FROM tests WHERE status = 'Current' ORDER BY test_date DESC LIMIT 1
    ''').fetchone()

    if not current_test:
        conn.close()
        return None

    test_id = current_test['id']
    eval_info = evaluate_test_availability(current_test)

    # Get syllabus categories
    categories_rows = cursor.execute('''
        SELECT * FROM syllabus_categories WHERE test_id = ? ORDER BY display_order ASC, id ASC
    ''', (test_id,)).fetchall()

    categories = []
    for c in categories_rows:
        try:
            topics = json.loads(c['topics_json'])
        except Exception:
            topics = []
        categories.append({
            'id': c['id'],
            'category_name': c['category_name'],
            'topics': topics
        })

    # Get resources for this test
    resources_rows = cursor.execute('''
        SELECT * FROM resources WHERE test_id = ?
    ''', (test_id,)).fetchall()

    resources = {
        'notes': None,
        'practice': None,
        'question_paper': None,
        'answer_key': None
    }
    for r in resources_rows:
        rtype = r['resource_type']
        if rtype in ('notes', 'practice'):
            resources[rtype] = {
                'id': r['id'],
                'title': r['title'],
                'file_path': r['file_path'],
                'updated_at': r['updated_at']
            }
        elif rtype in ('question_paper', 'answer_key') and eval_info['resources_accessible']:
            # Double-condition requirement: Current Time >= Finish Time AND status == 'Completed'
            resources[rtype] = {
                'id': r['id'],
                'title': r['title'],
                'file_path': r['file_path'],
                'updated_at': r['updated_at']
            }

    conn.close()

    return {
        'id': current_test['id'],
        'test_number': current_test['test_number'],
        'test_name': current_test['test_name'],
        'test_date': eval_info['formatted_date'],
        'raw_test_date': current_test['test_date'],
        'start_time': eval_info['start_time'],
        'finish_time': eval_info['finish_time'],
        'total_marks': current_test['total_marks'],
        'status': current_test['status'],
        'is_published': bool(current_test['is_published']),
        'duration_minutes': current_test['duration_minutes'] if 'duration_minutes' in current_test.keys() else 60,
        'availability_state': eval_info['availability_state'],
        'resources_accessible': eval_info['resources_accessible'],
        'start_iso': eval_info['start_iso'],
        'finish_iso': eval_info['finish_iso'],
        'categories': categories,
        'resources': resources
    }

def get_semester_plan():
    """
    Returns all tests chronologically with permitted resources based on availability & status.
    Visibility Rules:
    - Notes & Practice: Available for test.
    - Question Paper & Answer Key: Available ONLY when BOTH Current Time >= Finish Time AND Status == 'Completed'.
    """
    conn = get_db()
    cursor = conn.cursor()

    tests_rows = cursor.execute('''
        SELECT * FROM tests ORDER BY test_date ASC, id ASC
    ''').fetchall()

    plan = []
    for t in tests_rows:
        test_id = t['id']
        eval_info = evaluate_test_availability(t)

        # Categories
        cat_rows = cursor.execute('''
            SELECT * FROM syllabus_categories WHERE test_id = ? ORDER BY display_order ASC, id ASC
        ''', (test_id,)).fetchall()

        categories = []
        for c in cat_rows:
            try:
                topics = json.loads(c['topics_json'])
            except Exception:
                topics = []
            categories.append({
                'id': c['id'],
                'category_name': c['category_name'],
                'topics': topics
            })

        # Resources
        res_rows = cursor.execute('''
            SELECT * FROM resources WHERE test_id = ?
        ''', (test_id,)).fetchall()

        res_dict = {r['resource_type']: r for r in res_rows}

        notes = {'id': res_dict['notes']['id'], 'title': res_dict['notes']['title'], 'file_path': res_dict['notes']['file_path']} if 'notes' in res_dict else None
        practice = {'id': res_dict['practice']['id'], 'title': res_dict['practice']['title'], 'file_path': res_dict['practice']['file_path']} if 'practice' in res_dict else None
        
        # Enforce double-condition visibility rules (Current Time >= Finish Time AND status == 'Completed')
        if eval_info['resources_accessible']:
            question_paper = {'id': res_dict['question_paper']['id'], 'title': res_dict['question_paper']['title'], 'file_path': res_dict['question_paper']['file_path']} if 'question_paper' in res_dict else None
            answer_key = {'id': res_dict['answer_key']['id'], 'title': res_dict['answer_key']['title'], 'file_path': res_dict['answer_key']['file_path']} if 'answer_key' in res_dict else None
        else:
            question_paper = None
            answer_key = None

        plan.append({
            'id': t['id'],
            'test_number': t['test_number'],
            'test_name': t['test_name'],
            'test_date': eval_info['formatted_date'],
            'raw_test_date': t['test_date'],
            'start_time': eval_info['start_time'],
            'finish_time': eval_info['finish_time'],
            'total_marks': t['total_marks'],
            'status': t['status'],
            'is_published': bool(t['is_published']),
            'duration_minutes': t['duration_minutes'] if 'duration_minutes' in t.keys() else 60,
            'availability_state': eval_info['availability_state'],
            'resources_accessible': eval_info['resources_accessible'],
            'start_iso': eval_info['start_iso'],
            'finish_iso': eval_info['finish_iso'],
            'categories': categories,
            'notes': notes,
            'practice': practice,
            'question_paper': question_paper,
            'answer_key': answer_key
        })

    conn.close()
    return plan
