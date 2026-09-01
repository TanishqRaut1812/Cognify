import sqlite3
import os
import psycopg2
from config import Config
from database import init_db, get_db

SQLITE_DB_PATH = os.path.join(os.path.dirname(__file__), 'storage', 'cognify.db')

def migrate():
    print("1. Initializing Supabase PostgreSQL database tables...")
    init_db()

    if not os.path.exists(SQLITE_DB_PATH):
        print(f"SQLite database not found at {SQLITE_DB_PATH}. Skipping data migration.")
        return

    print("2. Connecting to local SQLite database...")
    sq_conn = sqlite3.connect(SQLITE_DB_PATH)
    sq_conn.row_factory = sqlite3.Row

    pg_conn_str = Config.DATABASE_URL
    print(f"3. Connecting to Supabase PostgreSQL at {pg_conn_str.split('@')[-1]}...")
    pg_conn = psycopg2.connect(pg_conn_str)
    pg_cur = pg_conn.cursor()

    tables = [
        'students',
        'tests',
        'syllabus_categories',
        'resources',
        'test_questions',
        'student_attempts',
        'student_answers',
        'test_results',
        'student_scores',
        'system_settings',
        'audit_logs'
    ]

    print("4. Truncating target PostgreSQL tables...")
    pg_cur.execute("TRUNCATE TABLE audit_logs, student_answers, student_attempts, test_questions, test_results, student_scores, resources, syllabus_categories, tests, students, system_settings RESTART IDENTITY CASCADE;")
    pg_conn.commit()

    total_migrated = 0

    for table in tables:
        sq_rows = sq_conn.execute(f"SELECT * FROM {table}").fetchall()
        if not sq_rows:
            print(f"  - Table '{table}': 0 rows to migrate.")
            continue

        columns = sq_rows[0].keys()
        cols_str = ", ".join(columns)
        placeholders = ", ".join(["%s"] * len(columns))
        insert_sql = f"INSERT INTO {table} ({cols_str}) VALUES ({placeholders})"

        values_list = []
        for r in sq_rows:
            row_vals = [r[col] for col in columns]
            values_list.append(row_vals)

        psycopg2.extras.execute_batch(pg_cur, insert_sql, values_list)
        pg_conn.commit()
        print(f"  - Table '{table}': Migrated {len(values_list)} rows.")
        total_migrated += len(values_list)

    print("5. Resetting PostgreSQL serial sequences...")
    serial_tables = ['tests', 'syllabus_categories', 'resources', 'test_questions', 'student_attempts', 'student_answers', 'test_results', 'audit_logs']
    for st in serial_tables:
        pg_cur.execute(f"SELECT setval(pg_get_serial_sequence('{st}', 'id'), COALESCE((SELECT MAX(id) FROM {st}), 1));")
    pg_conn.commit()

    sq_conn.close()
    pg_conn.close()

    print(f"SUCCESS: Migration completed! Total {total_migrated} rows migrated to Supabase PostgreSQL.")

if __name__ == '__main__':
    migrate()
