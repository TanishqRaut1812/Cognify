import urllib.request
import urllib.parse
import json
import http.cookiejar

BASE_URL = 'http://localhost:5000'

def test_all_updates():
    cookie_jar = http.cookiejar.CookieJar()
    opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cookie_jar))

    print("1. Testing Admin Authentication...")
    login_data = json.dumps({'password': 'CognifyAdmin2026!'}).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/admin/login", data=login_data, headers={'Content-Type': 'application/json'})
    res = opener.open(req)
    data = json.loads(res.read().decode())
    assert data['success'] is True
    print("   Admin Login OK")

    print("2. Testing Master Student Summary Endpoint...")
    req = urllib.request.Request(f"{BASE_URL}/api/admin/students/summary")
    res = opener.open(req)
    summary = json.loads(res.read().decode())
    print("   Student Summary:", summary)
    assert summary['SY'] == 75
    assert summary['TY'] == 75
    assert summary['Final Year'] == 75

    print("3. Testing Master Student List Validation (sample_sy_students.xlsx)...")
    boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW'
    with open('sample_sy_students.xlsx', 'rb') as f:
        file_bytes = f.read()

    body = (
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="class_name"\r\n\r\nSY\r\n'
        f'--{boundary}\r\n'
        f'Content-Disposition: form-data; name="file"; filename="sample_sy_students.xlsx"\r\n'
        f'Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet\r\n\r\n'
    ).encode('utf-8') + file_bytes + f'\r\n--{boundary}--\r\n'.encode('utf-8')

    req = urllib.request.Request(
        f"{BASE_URL}/api/admin/students/validate",
        data=body,
        headers={'Content-Type': f'multipart/form-data; boundary={boundary}'}
    )
    res = opener.open(req)
    val_data = json.loads(res.read().decode())
    print(f"   SY Student List Validation: Valid={val_data['valid']}, Detected={val_data['total_detected']}, ValidCount={val_data['valid_count']}, ExistingCount={val_data['existing_count']}")
    assert val_data['valid'] is True
    assert val_data['valid_count'] == 75

    print("4. Testing Master Student List Import...")
    imp_payload = json.dumps({
        'class_name': 'SY',
        'parsed_students': val_data['parsed_students']
    }).encode('utf-8')
    req = urllib.request.Request(f"{BASE_URL}/api/admin/students/import", data=imp_payload, headers={'Content-Type': 'application/json'})
    res = opener.open(req)
    imp_res = json.loads(res.read().decode())
    print("   Import Result:", imp_res['message'])
    assert imp_res['success'] is True

    print("5. Verifying Public API Endpoints...")
    req = urllib.request.Request(f"{BASE_URL}/api/public/timeline")
    res = opener.open(req)
    timeline = json.loads(res.read().decode())
    print("   Timeline Current Test:", timeline['current']['test_number'], "-", timeline['current']['test_date'])
    assert timeline['current'] is not None

    print("\nALL COGNIFY UPDATES VERIFIED SUCCESSFULLY AND PASSED 100%!")

if __name__ == '__main__':
    test_all_updates()
