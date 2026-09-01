import openpyxl
import re

def clean_header_str(val):
    if val is None:
        return ''
    s = str(val).lower().strip()
    s = re.sub(r'[\._\-#\s]+', '', s)
    return s

def normalize_correct_option(val, opt_a, opt_b, opt_c, opt_d):
    if val is None:
        return None, "Correct answer cell is empty."

    s_val = str(val).strip()
    u_val = s_val.upper()

    # Direct match for single letter A, B, C, D
    if u_val in ('A', 'B', 'C', 'D'):
        return u_val, None

    # Handles "Option A", "Opt A", "Choice A", "A.", "(A)"
    m = re.search(r'\b([A-D])\b', u_val)
    if m:
        return m.group(1), None

    # Text match against option values
    opt_a_str = str(opt_a or '').strip().lower()
    opt_b_str = str(opt_b or '').strip().lower()
    opt_c_str = str(opt_c or '').strip().lower()
    opt_d_str = str(opt_d or '').strip().lower()

    lower_val = s_val.lower()
    if lower_val and lower_val == opt_a_str:
        return 'A', None
    if lower_val and lower_val == opt_b_str:
        return 'B', None
    if lower_val and lower_val == opt_c_str:
        return 'C', None
    if lower_val and lower_val == opt_d_str:
        return 'D', None

    return None, f"Correct answer '{s_val}' must be A, B, C, or D."

def parse_question_excel(file_stream, total_test_marks=None):
    """
    Parses an uploaded .xlsx file containing questions, options, and correct answers.
    Returns:
        dict: {
            'valid': bool,
            'questions': list of dicts,
            'errors': list of str,
            'warnings': list of str,
            'total_detected': int,
            'valid_count': int,
            'invalid_count': int
        }
    """
    errors = []
    warnings = []
    questions = []

    try:
        wb = openpyxl.load_workbook(file_stream, data_only=True)
    except Exception as e:
        return {
            'valid': False,
            'questions': [],
            'errors': [f"Unable to read Excel workbook. Please ensure it is a valid .xlsx file. Error: {str(e)}"],
            'warnings': [],
            'total_detected': 0,
            'valid_count': 0,
            'invalid_count': 0
        }

    sheet = wb.active
    if not sheet:
        return {
            'valid': False,
            'questions': [],
            'errors': ["Workbook contains no visible worksheets."],
            'warnings': [],
            'total_detected': 0,
            'valid_count': 0,
            'invalid_count': 0
        }

    rows = list(sheet.iter_rows(values_only=True))
    if not rows:
        return {
            'valid': False,
            'questions': [],
            'errors': ["Excel sheet is empty."],
            'warnings': [],
            'total_detected': 0,
            'valid_count': 0,
            'invalid_count': 0
        }

    # Locate header row (first non-empty row)
    header_row_idx = -1
    for i, row in enumerate(rows):
        if any(cell is not None and str(cell).strip() != '' for cell in row):
            header_row_idx = i
            break

    if header_row_idx == -1:
        return {
            'valid': False,
            'questions': [],
            'errors': ["Excel sheet contains no header row or data."],
            'warnings': [],
            'total_detected': 0,
            'valid_count': 0,
            'invalid_count': 0
        }

    headers = [clean_header_str(cell) for cell in rows[header_row_idx]]

    col_map = {
        'q_num': -1,
        'q_text': -1,
        'opt_a': -1,
        'opt_b': -1,
        'opt_c': -1,
        'opt_d': -1,
        'correct_opt': -1,
        'marks': -1
    }

    for idx, h in enumerate(headers):
        if not h:
            continue
        if col_map['q_num'] == -1 and (h in ('questionno', 'questionnumber', 'qno', 'qnum', 'srno', 'sno', 'no', 'number', 'q', 'questionnum') or 'qnum' in h or 'qno' in h or h.startswith('questionno') or h.startswith('qno')):
            col_map['q_num'] = idx
        elif col_map['q_text'] == -1 and (h in ('question', 'questiontext', 'questionprompt', 'qtext', 'prompt', 'questionstatement', 'statement') or 'question' in h or 'prompt' in h):
            col_map['q_text'] = idx
        elif col_map['opt_a'] == -1 and h in ('optiona', 'opta', 'a', 'choicea'):
            col_map['opt_a'] = idx
        elif col_map['opt_b'] == -1 and h in ('optionb', 'optb', 'b', 'choiceb'):
            col_map['opt_b'] = idx
        elif col_map['opt_c'] == -1 and h in ('optionc', 'optc', 'c', 'choicec'):
            col_map['opt_c'] = idx
        elif col_map['opt_d'] == -1 and h in ('optiond', 'optd', 'd', 'choiced'):
            col_map['opt_d'] = idx
        elif col_map['correct_opt'] == -1 and h in ('correctanswer', 'correctoption', 'correct', 'answer', 'ans', 'key', 'correctans'):
            col_map['correct_opt'] = idx
        elif col_map['marks'] == -1 and h in ('marks', 'mark', 'points', 'weight'):
            col_map['marks'] = idx

    missing_cols = []
    if col_map['q_num'] == -1: missing_cols.append("Question Number")
    if col_map['q_text'] == -1: missing_cols.append("Question Text")
    if col_map['opt_a'] == -1: missing_cols.append("Option A")
    if col_map['opt_b'] == -1: missing_cols.append("Option B")
    if col_map['opt_c'] == -1: missing_cols.append("Option C")
    if col_map['opt_d'] == -1: missing_cols.append("Option D")
    if col_map['correct_opt'] == -1: missing_cols.append("Correct Answer")

    if missing_cols:
        return {
            'valid': False,
            'questions': [],
            'errors': [f"Missing required columns in Excel file: {', '.join(missing_cols)}."],
            'warnings': [],
            'total_detected': 0,
            'valid_count': 0,
            'invalid_count': 0
        }

    seen_q_nums = set()
    total_detected = 0

    for r_idx, row in enumerate(rows[header_row_idx + 1:], start=header_row_idx + 2):
        if not any(cell is not None and str(cell).strip() != '' for cell in row):
            continue

        total_detected += 1

        def get_val(col_i):
            if col_i < len(row) and row[col_i] is not None:
                return str(row[col_i]).strip()
            return ''

        q_num_raw = get_val(col_map['q_num'])
        q_text = get_val(col_map['q_text'])
        opt_a = get_val(col_map['opt_a'])
        opt_b = get_val(col_map['opt_b'])
        opt_c = get_val(col_map['opt_c'])
        opt_d = get_val(col_map['opt_d'])
        correct_raw = get_val(col_map['correct_opt'])
        marks_raw = get_val(col_map['marks']) if col_map['marks'] != -1 else ''

        row_label = f"Row {r_idx}"

        # 1. Validate Question Number
        if not q_num_raw:
            errors.append(f"{row_label}: Question number is missing.")
            q_num = total_detected
        else:
            try:
                q_num = int(float(q_num_raw))
            except ValueError:
                errors.append(f"{row_label}: Invalid question number '{q_num_raw}'. Must be an integer.")
                q_num = total_detected

        if q_num in seen_q_nums:
            errors.append(f"{row_label}: Duplicate question number {q_num} detected.")
        else:
            seen_q_nums.add(q_num)

        # 2. Validate Question Text
        if not q_text:
            errors.append(f"{row_label}: Question text is missing.")

        # 3. Validate Options
        if not opt_a: errors.append(f"{row_label}: Option A is missing.")
        if not opt_b: errors.append(f"{row_label}: Option B is missing.")
        if not opt_c: errors.append(f"{row_label}: Option C is missing.")
        if not opt_d: errors.append(f"{row_label}: Option D is missing.")

        # 4. Validate Correct Option
        norm_correct, opt_err = normalize_correct_option(correct_raw, opt_a, opt_b, opt_c, opt_d)
        if opt_err:
            errors.append(f"{row_label}: {opt_err}")

        # 5. Parse Marks
        marks = 1.0
        if marks_raw:
            try:
                marks = float(marks_raw)
                if marks <= 0:
                    marks = 1.0
            except ValueError:
                marks = 1.0

        questions.append({
            'question_number': q_num,
            'question_text': q_text,
            'option_a': opt_a,
            'option_b': opt_b,
            'option_c': opt_c,
            'option_d': opt_d,
            'correct_option': norm_correct or 'A',
            'marks': marks
        })

    is_valid = (len(errors) == 0 and len(questions) > 0)
    valid_count = len(questions) if is_valid else 0
    invalid_count = len(errors)

    if is_valid and total_test_marks is not None:
        try:
            target_marks = float(total_test_marks)
            sum_marks = sum(q['marks'] for q in questions)
            if abs(sum_marks - target_marks) > 0.01:
                warnings.append(
                    f"Warning: Sum of question marks ({sum_marks:.1f}) does not equal the test's configured total marks ({target_marks:.1f})."
                )
        except (ValueError, TypeError):
            pass

    return {
        'valid': is_valid,
        'questions': questions,
        'errors': errors,
        'warnings': warnings,
        'total_detected': total_detected,
        'valid_count': valid_count,
        'invalid_count': invalid_count
    }
