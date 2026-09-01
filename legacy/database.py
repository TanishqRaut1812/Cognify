import os
import sqlite3
import psycopg2
import psycopg2.extras
from config import Config

DB_PATH = os.path.join(os.path.dirname(__file__), 'storage', 'cognify.db')

def get_db_connection_string():
    return getattr(Config, 'DATABASE_URL', os.environ.get('DATABASE_URL', 'postgresql://postgres.xcsrhshotfqvisqwlxme:CognifyAdmin2026!@aws-0-ap-south-1.pooler.supabase.com:5432/postgres'))

def replace_unquoted_placeholders(sql):
    result = []
    in_single_quote = False
    i = 0
    n = len(sql)
    while i < n:
        ch = sql[i]
        if ch == "'":
            # Check for escaped single quote in SQL: '' or \'
            if i + 1 < n and sql[i+1] == "'":
                result.append("''")
                i += 2
                continue
            in_single_quote = not in_single_quote
            result.append(ch)
        elif ch == '?' and not in_single_quote:
            result.append('%s')
        else:
            result.append(ch)
        i += 1
    return "".join(result)

class CursorWrapper:
    def __init__(self, pg_cursor):
        self._cursor = pg_cursor
        self.lastrowid = None

    def _convert_sql(self, sql, params=None):
        if params is not None and params != ():
            # Escape literal % as %% for psycopg2 parameter formatting
            sql = sql.replace('%', '%%')
        return replace_unquoted_placeholders(sql)

    def execute(self, sql, params=None):
        converted_sql = self._convert_sql(sql, params)
        sql_strip = converted_sql.strip().lower()
        
        tables_with_id = {'classes', 'tests', 'questions', 'question_versions', 'syllabus', 'syllabus_categories', 'resources', 'test_questions', 'student_attempts', 'student_answers', 'attendance', 'test_results', 'audit_logs', 'backups'}
        is_insert = sql_strip.startswith('insert into')
        
        if is_insert:
            has_returning = 'returning' in sql_strip
            if not has_returning:
                should_return_id = False
                for table in tables_with_id:
                    if f'insert into {table}' in sql_strip or f'insert into "{table}"' in sql_strip:
                        should_return_id = True
                        break
                if should_return_id:
                    converted_sql = converted_sql.rstrip().rstrip(';') + ' RETURNING id;'
                    has_returning = True

            if params is not None:
                self._cursor.execute(converted_sql, params)
            else:
                self._cursor.execute(converted_sql)

            if has_returning:
                row = self._cursor.fetchone()
                if row:
                    if isinstance(row, dict) or hasattr(row, 'get'):
                        self.lastrowid = row.get('id')
                    else:
                        self.lastrowid = row[0]
            return self

        if params is not None:
            self._cursor.execute(converted_sql, params)
        else:
            self._cursor.execute(converted_sql)
        return self

    def executemany(self, sql, param_list):
        if param_list:
            converted_sql = self._convert_sql(sql, param_list[0])
        else:
            converted_sql = self._convert_sql(sql)
        self._cursor.executemany(converted_sql, param_list)
        return self

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        if size is not None:
            return self._cursor.fetchmany(size)
        return self._cursor.fetchmany()

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def close(self):
        self._cursor.close()

class ConnectionWrapper:
    def __init__(self, pg_conn):
        self._conn = pg_conn

    def cursor(self):
        return CursorWrapper(self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor))

    def execute(self, sql, params=None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

def get_db():
    if 'test_cognify' in DB_PATH or os.environ.get('FLASK_ENV') == 'testing':
        os.makedirs(os.path.dirname(DB_PATH), exist_ok=True)
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys = ON;")
        conn.execute("PRAGMA journal_mode = WAL;")
        return conn

    conn_str = get_db_connection_string()
    pg_conn = psycopg2.connect(conn_str)
    return ConnectionWrapper(pg_conn)

def init_db():
    conn = get_db()
    
    if isinstance(conn, sqlite3.Connection):
        cursor = conn.cursor()
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS students (
                registration_no TEXT PRIMARY KEY,
                roll_no TEXT NOT NULL,
                name TEXT NOT NULL,
                class_name TEXT NOT NULL CHECK(class_name IN ('SY', 'TY', 'Final Year'))
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS tests (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_number TEXT NOT NULL,
                test_name TEXT NOT NULL,
                test_date TEXT NOT NULL,
                total_marks REAL NOT NULL CHECK(total_marks > 0),
                status TEXT NOT NULL CHECK(status IN ('Upcoming', 'Current', 'Completed')),
                is_published INTEGER NOT NULL DEFAULT 0,
                duration_minutes INTEGER NOT NULL DEFAULT 60,
                instructions TEXT DEFAULT '',
                start_time TEXT NOT NULL DEFAULT '10:00 AM',
                finish_time TEXT NOT NULL DEFAULT '11:00 AM',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS syllabus_categories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                category_name TEXT NOT NULL,
                topics_json TEXT NOT NULL,
                display_order INTEGER DEFAULT 0,
                FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS resources (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                resource_type TEXT NOT NULL CHECK(resource_type IN ('notes', 'practice', 'question_paper', 'answer_key')),
                title TEXT NOT NULL,
                file_path TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS test_questions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                question_number INTEGER NOT NULL,
                question_text TEXT NOT NULL,
                option_a TEXT NOT NULL,
                option_b TEXT NOT NULL,
                option_c TEXT NOT NULL,
                option_d TEXT NOT NULL,
                correct_option TEXT NOT NULL CHECK(correct_option IN ('A', 'B', 'C', 'D')),
                marks REAL NOT NULL DEFAULT 1.0,
                is_active INTEGER NOT NULL DEFAULT 1,
                FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS student_attempts (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                registration_no TEXT NOT NULL,
                attempt_status TEXT NOT NULL CHECK(attempt_status IN ('Not Started', 'In Progress', 'Submitted', 'Terminated')),
                attendance TEXT NOT NULL DEFAULT 'Absent' CHECK(attendance IN ('Present', 'Absent')),
                is_late_attempt INTEGER NOT NULL DEFAULT 0,
                violation_count INTEGER NOT NULL DEFAULT 0,
                violation_logs_json TEXT DEFAULT '[]',
                start_time TIMESTAMP,
                end_time TIMESTAMP,
                calculated_score REAL DEFAULT 0.0,
                calculated_percentage REAL DEFAULT 0.0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
                FOREIGN KEY (registration_no) REFERENCES students(registration_no) ON DELETE CASCADE,
                UNIQUE(test_id, registration_no)
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS student_answers (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                attempt_id INTEGER NOT NULL,
                question_id INTEGER NOT NULL,
                selected_option TEXT CHECK(selected_option IN ('A', 'B', 'C', 'D', '')),
                saved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (attempt_id) REFERENCES student_attempts(id) ON DELETE CASCADE,
                FOREIGN KEY (question_id) REFERENCES test_questions(id) ON DELETE CASCADE,
                UNIQUE(attempt_id, question_id)
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS test_results (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                test_id INTEGER NOT NULL,
                registration_no TEXT NOT NULL,
                attendance TEXT NOT NULL CHECK(attendance IN ('Present', 'Absent')),
                marks_obtained REAL NOT NULL,
                percentage REAL NOT NULL,
                FOREIGN KEY (test_id) REFERENCES tests(id) ON DELETE CASCADE,
                FOREIGN KEY (registration_no) REFERENCES students(registration_no) ON DELETE CASCADE,
                UNIQUE(test_id, registration_no)
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS student_scores (
                registration_no TEXT PRIMARY KEY,
                cognify_score REAL NOT NULL DEFAULT 0.0,
                completed_tests_count INTEGER NOT NULL DEFAULT 0,
                rank INTEGER NOT NULL DEFAULT 0,
                class_name TEXT NOT NULL,
                last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (registration_no) REFERENCES students(registration_no) ON DELETE CASCADE
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS system_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        ''')

        cursor.execute('''
            CREATE TABLE IF NOT EXISTS audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                action TEXT NOT NULL,
                test_id INTEGER,
                registration_no TEXT,
                previous_value TEXT,
                new_value TEXT
            );
        ''')

        conn.commit()
        conn.close()
        return

    from migrations.apply_migrations import apply_migrations
    apply_migrations()

def set_last_updated(key_name, timestamp_str=None):
    from datetime import datetime
    if not timestamp_str:
        timestamp_str = datetime.now().strftime('%d/%m/%y, %I:%M %p')
    conn = get_db()
    conn.execute('''
        INSERT INTO system_settings (key, value, updated_at)
        VALUES (?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value, updated_at=CURRENT_TIMESTAMP;
    ''', (key_name, timestamp_str))
    conn.commit()
    conn.close()

def get_last_updated(key_name):
    conn = get_db()
    row = conn.execute('SELECT value, updated_at FROM system_settings WHERE key = ?', (key_name,)).fetchone()
    conn.close()
    if row:
        return row['value'] or row['updated_at']
    return None

def log_audit_event(action, test_id=None, registration_no=None, previous_value=None, new_value=None):
    """
    Lightweight audit log recording admin and critical system actions.
    """
    try:
        conn = get_db()
        conn.execute('''
            INSERT INTO audit_logs (action, test_id, registration_no, previous_value, new_value)
            VALUES (?, ?, ?, ?, ?)
        ''', (action, test_id, registration_no, str(previous_value) if previous_value is not None else None, str(new_value) if new_value is not None else None))
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"Audit log error: {str(e)}")
