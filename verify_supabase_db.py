import os
from config import Config
from database import get_db, init_db, get_last_updated, set_last_updated
from models import (
    get_top10_rankings,
    get_test_timeline,
    get_current_test_details,
    get_semester_plan,
    recalculate_scores_and_rankings
)

def verify_supabase():
    print("Connecting to Supabase PostgreSQL...")
    conn = get_db()

    # 1. Verify students count
    res_students = conn.execute("SELECT count(*) FROM students").fetchone()
    student_count = res_students[0] if isinstance(res_students, tuple) else res_students['count']
    print(f"Total students in Supabase DB: {student_count}")

    # 2. Verify tests count
    res_tests = conn.execute("SELECT count(*) FROM tests").fetchone()
    test_count = res_tests[0] if isinstance(res_tests, tuple) else res_tests['count']
    print(f"Total tests in Supabase DB: {test_count}")

    # 3. Verify test results count
    res_results = conn.execute("SELECT count(*) FROM test_results").fetchone()
    result_count = res_results[0] if isinstance(res_results, tuple) else res_results['count']
    print(f"Total test results in Supabase DB: {result_count}")

    conn.close()

    print("\nRecalculating scores & rankings on Supabase PostgreSQL...")
    recalculate_scores_and_rankings()

    print("\nFetching Top 10 Rankings from Supabase PostgreSQL...")
    top10 = get_top10_rankings()
    for class_name, ranks in top10['rankings'].items():
        print(f"  Class {class_name}: {len(ranks)} top students found.")
        if ranks:
            print(f"    #1 Rank: {ranks[0]['name']} - Score: {ranks[0]['cognify_score']}%")

    print("\nFetching Test Timeline from Supabase PostgreSQL...")
    timeline = get_test_timeline()
    print(f"  Previous test: {timeline['previous']['test_name'] if timeline['previous'] else 'None'}")
    print(f"  Current test: {timeline['current']['test_name'] if timeline['current'] else 'None'}")
    print(f"  Next test: {timeline['next']['test_name'] if timeline['next'] else 'None'}")

    print("\nFetching Current Test Details from Supabase PostgreSQL...")
    cur_details = get_current_test_details()
    if cur_details:
        print(f"  Current test ID {cur_details['id']}: {cur_details['test_name']}")
        print(f"  Categories count: {len(cur_details['categories'])}")

    print("\nSUCCESS: All Supabase PostgreSQL backend operations verified clean!")

if __name__ == '__main__':
    verify_supabase()
