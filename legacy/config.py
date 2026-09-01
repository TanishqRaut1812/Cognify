import os
from werkzeug.security import generate_password_hash

try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass

BASE_DIR = os.path.abspath(os.path.dirname(__file__))

class Config:
    BASE_DIR = BASE_DIR
    SECRET_KEY = os.environ.get('SECRET_KEY', 'cognify-itsa-secret-key-2026-super-secure')
    DATABASE_URL = os.environ.get('DATABASE_URL', 'postgresql://postgres.xcsrhshotfqvisqwlxme:CognifyAdmin2026!@aws-0-ap-south-1.pooler.supabase.com:5432/postgres')
    DB_PATH = os.path.join(BASE_DIR, 'storage', 'cognify.db')

    
    # Upload directories
    UPLOAD_FOLDER = os.path.join(BASE_DIR, 'static', 'uploads')
    NOTES_FOLDER = os.path.join(UPLOAD_FOLDER, 'notes')
    PRACTICE_FOLDER = os.path.join(UPLOAD_FOLDER, 'practice')
    QUESTION_PAPERS_FOLDER = os.path.join(UPLOAD_FOLDER, 'question_papers')
    ANSWER_KEYS_FOLDER = os.path.join(UPLOAD_FOLDER, 'answer_keys')
    BACKUP_FOLDER = os.path.join(BASE_DIR, 'backups')
    
    # Admin Credentials
    # Default password can be overridden via env var ADMIN_PASSWORD
    DEFAULT_ADMIN_PASSWORD = os.environ.get('ADMIN_PASSWORD', 'CognifyAdmin2026!')
    ADMIN_PASSWORD_HASH = generate_password_hash(DEFAULT_ADMIN_PASSWORD)

    @classmethod
    def init_app(cls, app):
        os.makedirs(os.path.join(BASE_DIR, 'storage'), exist_ok=True)
        os.makedirs(cls.UPLOAD_FOLDER, exist_ok=True)
        os.makedirs(cls.NOTES_FOLDER, exist_ok=True)
        os.makedirs(cls.PRACTICE_FOLDER, exist_ok=True)
        os.makedirs(cls.QUESTION_PAPERS_FOLDER, exist_ok=True)
        os.makedirs(cls.ANSWER_KEYS_FOLDER, exist_ok=True)
        os.makedirs(cls.BACKUP_FOLDER, exist_ok=True)
