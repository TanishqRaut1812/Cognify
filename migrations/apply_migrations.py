import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
import psycopg2
from config import Config

def apply_migrations():
    conn_str = Config.DATABASE_URL
    print(f"Connecting to Supabase PostgreSQL at {conn_str.split('@')[-1]}...")
    conn = psycopg2.connect(conn_str)
    cur = conn.cursor()

    migrations_dir = os.path.dirname(__file__)
    sql_files = ['01_schema.sql', '02_rls_policies.sql', '03_storage_policies.sql']

    for file_name in sql_files:
        file_path = os.path.join(migrations_dir, file_name)
        print(f"Applying migration: {file_name}...")
        with open(file_path, 'r', encoding='utf-8') as f:
            sql_script = f.read()
        cur.execute(sql_script)
        conn.commit()
        print(f"SUCCESS: Applied {file_name}")

    cur.close()
    conn.close()
    print("ALL MIGRATIONS APPLIED SUCCESSFULLY TO SUPABASE POSTGRESQL!")

if __name__ == '__main__':
    apply_migrations()
