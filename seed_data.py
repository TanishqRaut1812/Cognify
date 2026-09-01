import os
import openpyxl
from database import init_db, get_db
from models import recalculate_scores_and_rankings
from config import Config
import random

def seed():
    print("Initializing Database...")
    init_db()

    conn = get_db()
    cursor = conn.cursor()

    # Check if students already seeded
    existing_count = cursor.execute('SELECT COUNT(*) as cnt FROM students').fetchone()['cnt']
    if existing_count > 0:
        print(f"Database already contains {existing_count} students. Skipping student seeding.")
        conn.close()
        return

    print("Seeding ~225 Master Students across SY, TY, and Final Year...")

    first_names = [
        "Aarav", "Ananya", "Aditya", "Diya", "Rohan", "Isha", "Vihaan", "Riya",
        "Arjun", "Kavya", "Dev", "Anushka", "Kabir", "Neha", "Sai", "Pooja",
        "Yash", "Sneha", "Tanmay", "Shruti", "Atharva", "Siddhi", "Pranav", "Gauri",
        "Om", "Tanvi", "Siddharth", "Aarya", "Varun", "Isha", "Rahul", "Meera",
        "Karan", "Nisha", "Manish", "Aditi", "Sahil", "Priya", "Sameer", "Shreya",
        "Kunal", "Tanisha", "Harsh", "Simran", "Gaurav", "Ritika", "Akash", "Krutika",
        "Nikhil", "Divya", "Sanket", "Rutuja", "Abhishek", "Mansi", "Tejas", "Sayali"
    ]

    last_names = [
        "Sharma", "Verma", "Patil", "Deshmukh", "Joshi", "Kulkarni", "Pawar", "Shinde",
        "Gupta", "Mehta", "Shah", "Chavan", "More", "Rao", "Nair", "Iyer",
        "Singhania", "Agarwal", "Bhosale", "Gaikwad", "Jadhav", "Mane", "Wagh", "Thakur"
    ]

    classes_data = [
        ('SY', 'REG2026SY', 75),
        ('TY', 'REG2026TY', 75),
        ('Final Year', 'REG2026FY', 75)
    ]

    all_students = []

    for cname, prefix, count in classes_data:
        for i in range(1, count + 1):
            reg_no = f"{prefix}{i:03d}"
            roll_no = f"{cname[:2].upper()}-{i:02d}"
            fn = first_names[(i * 3 + len(cname)) % len(first_names)]
            ln = last_names[(i * 7 + count) % len(last_names)]
            name = f"{fn} {ln}"

            cursor.execute('''
                INSERT INTO students (registration_no, registration_number, roll_no, roll_number, name, class_name)
                VALUES (?, ?, ?, ?, ?, ?)
            ''', (reg_no, reg_no, roll_no, roll_no, name, cname))

            all_students.append({
                'registration_no': reg_no,
                'roll_no': roll_no,
                'name': name,
                'class_name': cname
            })

    print(f"Successfully seeded {len(all_students)} master students.")

    # Seed Tests
    print("Seeding Tests...")

    tests = [
        {
            'test_number': 'Test 01',
            'test_name': 'Quantitative Aptitude & Logic Foundation',
            'test_date': '2026-07-15',
            'total_marks': 50,
            'status': 'Completed'
        },
        {
            'test_number': 'Test 02',
            'test_name': 'Verbal Reasoning & Data Interpretation',
            'test_date': '2026-08-01',
            'total_marks': 100,
            'status': 'Completed'
        },
        {
            'test_number': 'Test 03',
            'test_name': 'Advanced Spatial & Analytical Ability',
            'test_date': '2026-08-25',
            'total_marks': 75,
            'status': 'Current'
        },
        {
            'test_number': 'Test 04',
            'test_name': 'Comprehensive Mental Ability Final',
            'test_date': '2026-09-10',
            'total_marks': 100,
            'status': 'Upcoming'
        }
    ]

    test_ids = {}
    for t in tests:
        is_pub = 1 if t['status'] == 'Completed' else 0
        cursor.execute('''
            INSERT INTO tests (test_number, test_name, test_date, total_marks, status, is_published, duration_minutes)
            VALUES (?, ?, ?, ?, ?, ?, 60)
        ''', (t['test_number'], t['test_name'], t['test_date'], t['total_marks'], t['status'], is_pub))
        test_ids[t['test_number']] = cursor.lastrowid

    # Seed Sample Questions for Exam Mode
    print("Seeding Online Test Questions for Exam Mode...")
    sample_questions_map = {
        'Test 01': [
            ("If a train 150m long crosses a pole in 6 seconds, what is its speed in km/h?", "75 km/h", "90 km/h", "100 km/h", "120 km/h", "B", 10.0),
            ("Find the next number in the series: 3, 7, 15, 31, 63, ?", "95", "115", "127", "129", "C", 10.0),
            ("A item bought for $400 is sold for $480. What is the profit percentage?", "15%", "18%", "20%", "25%", "C", 10.0),
            ("If A can complete a task in 10 days and B in 15 days, how many days working together?", "5 days", "6 days", "7.5 days", "8 days", "B", 10.0),
            ("The average of 5 consecutive numbers is 24. What is the largest number?", "24", "25", "26", "27", "C", 10.0)
        ],
        'Test 02': [
            ("Choose the word most opposite in meaning to 'EPHEMERAL':", "Transient", "Eternal", "Fleeting", "Fragile", "B", 20.0),
            ("Complete the analogy: Book is to Reading as Fork is to ?", "Cooking", "Eating", "Serving", "Cutting", "B", 20.0),
            ("Find the misspelt word:", "Accommodate", "Embarrass", "Conscientous", "Necessary", "C", 20.0),
            ("Identify the synonym of 'PRAGMATIC':", "Theoretical", "Practical", "Idealistic", "Arrogant", "B", 20.0),
            ("Select the sentence with correct grammar:", "Neither of the boys were present.", "Neither of the boys was present.", "Neither of the boy were present.", "None of the boys was present.", "B", 20.0)
        ],
        'Test 03': [
            ("Which 3D shape is formed by folding a net with 6 identical square faces?", "Prism", "Pyramid", "Cube", "Cylinder", "C", 15.0),
            ("Looking at a mirror reflection of a clock showing 3:15, what is the actual time?", "8:45", "9:15", "8:15", "9:45", "A", 15.0),
            ("If CODE is written as ECDF, how is LOGIC written?", "NQIKE", "NQIKE", "NQJKE", "MPHJD", "C", 15.0),
            ("Point A is 5m North of B. C is 12m East of A. What is the shortest distance between B and C?", "13m", "15m", "17m", "20m", "A", 15.0),
            ("All cats are mammals. All mammals are animals. Therefore:", "All animals are cats", "All cats are animals", "Some cats are not animals", "No cats are animals", "B", 15.0)
        ],
        'Test 04': [
            ("What is the compound interest on $10,000 at 10% per annum for 2 years?", "$2,000", "$2,100", "$2,200", "$2,500", "B", 20.0),
            ("If RED is coded as 27 and BLUE is coded as 40, how is GREEN coded?", "49", "54", "60", "65", "A", 20.0),
            ("Find the odd one out:", "Copper", "Zinc", "Brass", "Iron", "C", 20.0),
            ("A clock is set right at 5 AM. It loses 16 minutes in 24 hours. What will be true time when it indicates 10 PM on 4th day?", "11 PM", "10 PM", "9 PM", "Midnight", "A", 20.0),
            ("Statement: Should renewable energy be mandated? Argument I: Yes, to curb climate change. Argument II: No, it is expensive.", "Only I is strong", "Only II is strong", "Both are strong", "Neither is strong", "A", 20.0)
        ]
    }

    for t_name, q_list in sample_questions_map.items():
        tid = test_ids[t_name]
        for q_idx, q_item in enumerate(q_list, start=1):
            q_text, o_a, o_b, o_c, o_d, c_opt, mks = q_item
            cursor.execute('''
                INSERT INTO test_questions (test_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_option, marks)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (tid, q_idx, q_text, o_a, o_b, o_c, o_d, c_opt, mks))

    # Seed Syllabus for Test 03 (Current Test) and Test 04
    print("Seeding Syllabus & Categories...")

    syllabus_test3 = [
        {
            'category_name': 'Quantitative Aptitude',
            'topics': ['Number Series & Sequences', 'Percentage & Profit-Loss', 'Data Interpretation Charts'],
            'display_order': 1
        },
        {
            'category_name': 'Logical Reasoning',
            'topics': ['Blood Relations & Family Tree', 'Syllogisms & Deductive Logic', 'Coding & Decoding'],
            'display_order': 2
        },
        {
            'category_name': 'Spatial & Abstract Reasoning',
            'topics': ['Pattern Completion & Series', '3D Shape Rotations & Folding', 'Mirror & Water Images'],
            'display_order': 3
        }
    ]

    import json
    for cat in syllabus_test3:
        cursor.execute('''
            INSERT INTO syllabus_categories (test_id, category_name, topics_json, display_order)
            VALUES (?, ?, ?, ?)
        ''', (test_ids['Test 03'], cat['category_name'], json.dumps(cat['topics']), cat['display_order']))

    for cat in syllabus_test3:
        cursor.execute('''
            INSERT INTO syllabus_categories (test_id, category_name, topics_json, display_order)
            VALUES (?, ?, ?, ?)
        ''', (test_ids['Test 04'], cat['category_name'], json.dumps(cat['topics']), cat['display_order']))

    # Generate Dummy PDF files for Resources
    print("Creating sample resource files...")
    dummy_files = {
        'notes_t3.pdf': (Config.NOTES_FOLDER, 'Test 03 - Comprehensive Study Notes.pdf', 'notes', test_ids['Test 03']),
        'practice_t3.pdf': (Config.PRACTICE_FOLDER, 'Test 03 - Practice Questions Set A.pdf', 'practice', test_ids['Test 03']),
        'notes_t1.pdf': (Config.NOTES_FOLDER, 'Test 01 - Quant Basics Notes.pdf', 'notes', test_ids['Test 01']),
        'paper_t1.pdf': (Config.QUESTION_PAPERS_FOLDER, 'Test 01 - Question Paper.pdf', 'question_paper', test_ids['Test 01']),
        'key_t1.pdf': (Config.ANSWER_KEYS_FOLDER, 'Test 01 - Official Answer Key.pdf', 'answer_key', test_ids['Test 01']),
        'paper_t2.pdf': (Config.QUESTION_PAPERS_FOLDER, 'Test 02 - Question Paper.pdf', 'question_paper', test_ids['Test 02']),
        'key_t2.pdf': (Config.ANSWER_KEYS_FOLDER, 'Test 02 - Official Answer Key.pdf', 'answer_key', test_ids['Test 02'])
    }

    # Ensure directories exist
    Config.init_app(None)

    for fname, (folder, title, rtype, tid) in dummy_files.items():
        os.makedirs(folder, exist_ok=True)
        fpath = os.path.join(folder, fname)
        if not os.path.exists(fpath):
            with open(fpath, 'wb') as f:
                f.write(b"%PDF-1.4 %Cognify Sample Academic Resource Document\n1 0 obj << /Type /Catalog >> endobj\n")
        
        rel_path = f"/static/uploads/{os.path.basename(folder)}/{fname}"
        cursor.execute('''
            INSERT INTO resources (test_id, resource_type, title, file_path)
            VALUES (?, ?, ?, ?)
        ''', (tid, rtype, title, rel_path))

    conn.commit()

    # Generate Excel sheets & seed results for Test 01 & Test 02
    print("Generating sample Excel student lists and test result sheets...")

    # Generate Student List Excel Files per class
    for cname, filename in [('SY', 'sample_sy_students.xlsx'), ('TY', 'sample_ty_students.xlsx'), ('Final Year', 'sample_fy_students.xlsx')]:
        class_stus = [s for s in all_students if s['class_name'] == cname]
        wb_stu = openpyxl.Workbook()
        ws_stu = wb_stu.active
        ws_stu.title = "Master Students"
        ws_stu.append(["Registration Number", "Roll Number", "Name"])

        for cs in class_stus:
            ws_stu.append([cs['registration_no'], cs['roll_no'], cs['name']])

        stu_path = os.path.join(Config.BASE_DIR, filename)
        wb_stu.save(stu_path)
        print(f"Generated sample student list Excel: {stu_path}")

    random.seed(42)  # Deterministic realistic scores


    for tid_key, max_m in [('Test 01', 50), ('Test 02', 100)]:
        tid = test_ids[tid_key]
        wb = openpyxl.Workbook()
        ws = wb.active
        ws.title = "Results"

        ws.append(["Registration Number", "Roll Number", "Name", "Class", "Attendance", "Score"])

        for idx, s in enumerate(all_students):
            # ~5% absent rate
            is_present = (idx % 19 != 0)
            att = "Present" if is_present else "Absent"
            if is_present:
                # Distribution of scores with some top performers and ties
                base = 0.6 + (hash(s['registration_no'] + tid_key) % 38) / 100.0  # 60% to 98%
                score = round(base * max_m, 1)
                score = min(float(max_m), max(0.0, score))
            else:
                score = 0.0

            ws.append([s['registration_no'], s['roll_no'], s['name'], s['class_name'], att, score])

            pct = round((score / max_m) * 100.0, 2) if att == "Present" else 0.0
            cursor.execute('''
                INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage)
                VALUES (?, ?, ?, ?, ?)
            ''', (tid, s['registration_no'], att, score, pct))

        excel_filename = f"sample_{tid_key.lower().replace(' ', '')}_results.xlsx"
        excel_path = os.path.join(Config.BASE_DIR, excel_filename)
        wb.save(excel_path)
        print(f"Generated sample Excel result sheet: {excel_path}")

    conn.commit()
    conn.close()

    # Calculate Cognify Scores & Competition Rankings
    print("Calculating initial Cognify Scores and Competition Rankings...")
    recalculate_scores_and_rankings()
    print("Seeding complete!")

if __name__ == '__main__':
    seed()
