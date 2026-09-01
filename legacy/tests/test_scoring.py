import pytest
import sqlite3
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from database import init_db, get_db
from models import recalculate_scores_and_rankings, get_top10_rankings

@pytest.fixture(autouse=True)
def setup_test_db(tmp_path, monkeypatch):
    test_db = str(tmp_path / "test_cognify.db")
    monkeypatch.setattr('database.DB_PATH', test_db)
    init_db()

def test_competition_ranking_and_absences():
    conn = get_db()
    cursor = conn.cursor()

    # Seed 5 master students in SY
    students = [
        ('REG001', 'SY-01', 'Student A', 'SY'),
        ('REG002', 'SY-02', 'Student B', 'SY'),
        ('REG003', 'SY-03', 'Student C', 'SY'),
        ('REG004', 'SY-04', 'Student D', 'SY'),
        ('REG005', 'SY-05', 'Student E', 'SY'),
    ]
    cursor.executemany('INSERT INTO students VALUES (?,?,?,?)', students)

    # Seed 2 completed & published tests with total marks 50 and 100
    cursor.execute("INSERT INTO tests (id, test_number, test_name, test_date, total_marks, status, is_published) VALUES (1, 'T1', 'Test 1', '2026-01-01', 50, 'Completed', 1)")
    cursor.execute("INSERT INTO tests (id, test_number, test_name, test_date, total_marks, status, is_published) VALUES (2, 'T2', 'Test 2', '2026-01-10', 100, 'Completed', 1)")

    # Test 1 scores (out of 50):
    # A: 40/50 = 80%
    # B: 45/50 = 90%
    # C: 45/50 = 90%
    # D: Absent = 0%
    # E: 30/50 = 60%
    t1_results = [
        (1, 'REG001', 'Present', 40.0, 80.0),
        (1, 'REG002', 'Present', 45.0, 90.0),
        (1, 'REG003', 'Present', 45.0, 90.0),
        (1, 'REG004', 'Absent', 0.0, 0.0),
        (1, 'REG005', 'Present', 30.0, 60.0),
    ]
    cursor.executemany('INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage) VALUES (?,?,?,?,?)', t1_results)

    # Test 2 scores (out of 100):
    # A: 90/100 = 90% -> Avg = (80 + 90) / 2 = 85.0%
    # B: 80/100 = 80% -> Avg = (90 + 80) / 2 = 85.0% (TIE with A)
    # C: 70/100 = 70% -> Avg = (90 + 70) / 2 = 80.0%
    # D: 100/100 = 100% -> Avg = (0 + 100) / 2 = 50.0% (Absence in T1 counted!)
    # E: 50/100 = 50% -> Avg = (60 + 50) / 2 = 55.0%
    t2_results = [
        (2, 'REG001', 'Present', 90.0, 90.0),
        (2, 'REG002', 'Present', 80.0, 80.0),
        (2, 'REG003', 'Present', 70.0, 70.0),
        (2, 'REG004', 'Present', 100.0, 100.0),
        (2, 'REG005', 'Present', 50.0, 50.0),
    ]
    cursor.executemany('INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage) VALUES (?,?,?,?,?)', t2_results)

    conn.commit()
    conn.close()

    # Trigger calculation
    recalculate_scores_and_rankings()

    # Verify scores and competition ranks:
    # A: 85.0%, Rank 1 (tied with B)
    # B: 85.0%, Rank 1 (tied with A)
    # C: 80.0%, Rank 3 (skips rank 2 because 2 students ranked higher)
    # E: 55.0%, Rank 4
    # D: 50.0%, Rank 5
    conn = get_db()
    scores = conn.execute('SELECT registration_no, cognify_score, rank FROM student_scores ORDER BY rank ASC, registration_no ASC').fetchall()
    conn.close()

    res_dict = {s['registration_no']: (s['cognify_score'], s['rank']) for s in scores}

    assert res_dict['REG001'] == (85.0, 1)
    assert res_dict['REG002'] == (85.0, 1)
    assert res_dict['REG003'] == (80.0, 3)
    assert res_dict['REG005'] == (55.0, 4)
    assert res_dict['REG004'] == (50.0, 5)

def test_top10_cutoff_with_ties():
    conn = get_db()
    cursor = conn.cursor()

    # Seed 12 students with some tied scores
    for i in range(1, 13):
        cursor.execute("INSERT INTO students VALUES (?,?,?,?)", (f'REG{i:03d}', f'R-{i}', f'Student {i}', 'TY'))

    cursor.execute("INSERT INTO tests (id, test_number, test_name, test_date, total_marks, status, is_published) VALUES (1, 'T1', 'Test 1', '2026-01-01', 100, 'Completed', 1)")

    # Tied scores at rank 10 cutoff
    # Ranks 1 to 9: 99, 98, 97, 96, 95, 94, 93, 92, 91
    # Ranks 10, 11, 12: 90, 90, 90 (all 3 should get rank 10!)
    for i in range(1, 10):
        cursor.execute("INSERT INTO test_results VALUES (NULL, 1, ?, 'Present', ?, ?)", (f'REG{i:03d}', 100.0 - i, 100.0 - i))
    for i in range(10, 13):
        cursor.execute("INSERT INTO test_results VALUES (NULL, 1, ?, 'Present', 90.0, 90.0)", (f'REG{i:03d}',))

    conn.commit()
    conn.close()

    recalculate_scores_and_rankings()

    top10 = get_top10_rankings('TY')
    ty_rankings = top10['rankings']['TY']

    # All 12 students should be included because ranks 10, 11, 12 are all tied at rank 10!
    assert len(ty_rankings) == 12
    assert ty_rankings[-1]['rank'] == 10
