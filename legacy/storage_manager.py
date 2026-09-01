import os
import json
import time
import requests
from datetime import datetime, timezone
from config import Config
from database import get_db

# Supabase Storage Base Endpoint
SUPABASE_URL = getattr(Config, 'SUPABASE_URL', 'https://xcsrhshotfqvisqwlxme.supabase.co')
SUPABASE_SERVICE_KEY = getattr(Config, 'SUPABASE_SERVICE_ROLE_KEY', getattr(Config, 'SUPABASE_KEY', ''))

STORAGE_BASE_URL = f"{SUPABASE_URL}/storage/v1"

# Local Fallback Base Directory
LOCAL_STORAGE_DIR = os.path.join(os.path.dirname(__file__), 'storage')

BUCKETS = {
    'question-papers': {'public': False},
    'answer-keys': {'public': False},
    'resources': {'public': True},
    'excel-imports': {'public': False},
    'backups': {'public': False}
}

def get_headers():
    return {
        'apikey': SUPABASE_SERVICE_KEY,
        'Authorization': f'Bearer {SUPABASE_SERVICE_KEY}'
    }

def init_storage():
    """
    Ensures storage directories and Supabase Storage buckets exist.
    """
    for b in BUCKETS:
        os.makedirs(os.path.join(LOCAL_STORAGE_DIR, b), exist_ok=True)

    if not SUPABASE_SERVICE_KEY:
        return

    try:
        url = f"{STORAGE_BASE_URL}/bucket"
        res = requests.get(url, headers=get_headers(), timeout=5)
        if res.status_code == 200:
            existing_buckets = [item['id'] for item in res.json()]
            for bucket_id, config in BUCKETS.items():
                if bucket_id not in existing_buckets:
                    payload = {
                        'id': bucket_id,
                        'name': bucket_id,
                        'public': config['public']
                    }
                    requests.post(url, json=payload, headers=get_headers(), timeout=5)
    except Exception as e:
        print(f"Supabase Storage init notice: {e}")

def upload_file(bucket_name, relative_path, file_content_bytes, content_type='application/octet-stream'):
    """
    Uploads a file to Supabase Storage (and mirrors locally).
    Returns dict with storage_path, file_path, and metadata.
    """
    relative_path = relative_path.lstrip('/')
    
    # 1. Local mirror write
    local_path = os.path.join(LOCAL_STORAGE_DIR, bucket_name, relative_path)
    os.makedirs(os.path.dirname(local_path), exist_ok=True)
    with open(local_path, 'wb') as f:
        f.write(file_content_bytes)

    supabase_uploaded = False
    if SUPABASE_SERVICE_KEY:
        try:
            url = f"{STORAGE_BASE_URL}/object/{bucket_name}/{relative_path}"
            headers = get_headers()
            headers['Content-Type'] = content_type
            headers['x-upsert'] = 'true'
            
            res = requests.post(url, data=file_content_bytes, headers=headers, timeout=10)
            if res.status_code in (200, 201):
                supabase_uploaded = True
        except Exception as e:
            print(f"Supabase Storage upload fallback to local: {e}")

    storage_path = f"{bucket_name}/{relative_path}"
    file_path = f"/static/uploads/{bucket_name}/{relative_path}"

    return {
        'bucket': bucket_name,
        'relative_path': relative_path,
        'storage_path': storage_path,
        'file_path': file_path,
        'local_path': local_path,
        'size_bytes': len(file_content_bytes),
        'supabase_uploaded': supabase_uploaded
    }

def get_signed_url(bucket_name, relative_path, expires_in=3600):
    """
    Generates a short-lived signed URL for private files.
    """
    relative_path = relative_path.lstrip('/')
    if SUPABASE_SERVICE_KEY:
        try:
            url = f"{STORAGE_BASE_URL}/object/sign/{bucket_name}/{relative_path}"
            headers = get_headers()
            headers['Content-Type'] = 'application/json'
            payload = {'expiresIn': expires_in}
            
            res = requests.post(url, json=payload, headers=headers, timeout=5)
            if res.status_code == 200:
                data = res.json()
                signed_path = data.get('signedURL') or data.get('url')
                if signed_path:
                    if signed_path.startswith('http'):
                        return signed_path
                    return f"{SUPABASE_URL}/storage/v1{signed_path}"
        except Exception as e:
            print(f"Signed URL fallback: {e}")

    # Fallback endpoint
    return f"/api/resources/storage/download/{bucket_name}/{relative_path}"

def delete_file(bucket_name, relative_path):
    """
    Deletes a file or directory from Supabase Storage and local storage.
    """
    relative_path = relative_path.lstrip('/')
    local_path = os.path.join(LOCAL_STORAGE_DIR, bucket_name, relative_path)
    if os.path.exists(local_path):
        try:
            if os.path.isdir(local_path):
                import shutil
                shutil.rmtree(local_path)
            else:
                os.remove(local_path)
        except Exception as e:
            print(f"Error removing local file/dir: {e}")

    if SUPABASE_SERVICE_KEY:
        try:
            url = f"{STORAGE_BASE_URL}/object/{bucket_name}"
            headers = get_headers()
            headers['Content-Type'] = 'application/json'
            payload = {'prefixes': [relative_path]}
            requests.delete(url, json=payload, headers=headers, timeout=5)
        except Exception as e:
            print(f"Error deleting Supabase object: {e}")

def delete_test_assets(test_id):
    """
    Deletes associated question papers, answer keys, resources, and excel imports for a test.
    """
    conn = get_db()
    cursor = conn.cursor()
    
    # 1. Fetch test resources
    resources = cursor.execute('SELECT id, storage_path, file_path FROM resources WHERE test_id = ?', (test_id,)).fetchall()
    for r in resources:
        spath = r['storage_path'] or r['file_path']
        if spath and '/' in spath:
            parts = spath.lstrip('/').replace('static/uploads/', '').split('/', 1)
            if len(parts) == 2:
                delete_file(parts[0], parts[1])

    cursor.execute('DELETE FROM resources WHERE test_id = ?', (test_id,))

    # 2. Delete test question paper and answer key folders
    delete_file('question-papers', f"{test_id}/question-paper.pdf")
    delete_file('answer-keys', f"{test_id}/answer-key.pdf")

    # 3. Delete excel imports for test
    delete_file('excel-imports', f"{test_id}")

    conn.commit()
    conn.close()

def record_resource_metadata(test_id, class_id, resource_type, title, storage_path, file_path, visibility=None):
    """
    Inserts or updates resource metadata in PostgreSQL database.
    """
    if not visibility:
        visibility = 'public' if resource_type in ('notes', 'practice') else 'completed_only'
    conn = get_db()
    cursor = conn.cursor()
    
    existing = cursor.execute('''
        SELECT id FROM resources WHERE test_id = ? AND resource_type = ? AND title = ?
    ''', (test_id, resource_type, title)).fetchone()

    now_str = datetime.now(timezone.utc).isoformat()

    if existing:
        resource_id = existing['id']
        cursor.execute('''
            UPDATE resources
            SET class_id = ?, storage_path = ?, file_path = ?, visibility = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        ''', (class_id, storage_path, file_path, visibility, resource_id))
    else:
        cursor.execute('''
            INSERT INTO resources (test_id, class_id, resource_type, title, storage_path, file_path, visibility, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        ''', (test_id, class_id, resource_type, title, storage_path, file_path, visibility))
        resource_id = cursor.lastrowid

    conn.commit()
    conn.close()
    return resource_id
