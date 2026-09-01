from flask import session, request, jsonify
from functools import wraps
from werkzeug.security import check_password_hash
from config import Config

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if not session.get('is_admin'):
            return jsonify({'error': 'Unauthorized. Admin authentication required.'}), 401
        return f(*args, **kwargs)
    return decorated_function

def handle_login():
    data = request.get_json() or {}
    password = data.get('password', '')

    if not password:
        return jsonify({'success': False, 'error': 'Password is required.'}), 400

    if check_password_hash(Config.ADMIN_PASSWORD_HASH, password):
        session['is_admin'] = True
        session.permanent = True
        return jsonify({'success': True, 'message': 'Authenticated successfully.'})
    else:
        return jsonify({'success': False, 'error': 'Incorrect password. Please try again.'}), 401

def handle_logout():
    session.pop('is_admin', None)
    return jsonify({'success': True, 'message': 'Logged out successfully.'})

def is_admin():
    return bool(session.get('is_admin'))

def handle_status():
    is_authenticated = is_admin()
    return jsonify({'authenticated': is_authenticated})
