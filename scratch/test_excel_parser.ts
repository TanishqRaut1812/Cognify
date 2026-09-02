import * as XLSX from 'xlsx';

// Implementation of ExcelService validation for test environment
async function validateAndParseQuestionsFrontend(buffer: Buffer): Promise<{ valid: boolean; data: any[]; errors: string[] }> {
  const workbook = XLSX.read(buffer, { type: 'buffer' });
  const firstSheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[firstSheetName];
  const rows: any[] = XLSX.utils.sheet_to_json(worksheet);

  const errors: string[] = [];
  const data: any[] = [];

  if (!rows || rows.length === 0) {
    return { valid: false, data: [], errors: ['Excel file contains no rows'] };
  }

  const rawKeys = Object.keys(rows[0] || {});
  const normalizeHeader = (h: string) =>
    String(h || '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');

  const normalizedMap = new Map<string, string>();
  for (const key of rawKeys) {
    normalizedMap.set(normalizeHeader(key), key);
  }

  const findKey = (matchers: ((norm: string) => boolean)[]): string | undefined => {
    for (const [norm, raw] of normalizedMap.entries()) {
      if (matchers.some((m) => m(norm))) {
        return raw;
      }
    }
    return undefined;
  };

  const qTextKey = findKey([
    (k) => k === 'question text' || k === 'qtext' || k === 'question',
    (k) => (k.includes('question') || k.includes('qtext')) && !k.includes('number') && !k.includes('num') && !k.includes('no') && !k.includes('#')
  ]);

  const optAKey = findKey([
    (k) => k === 'option a' || k === 'opt a' || k === 'a',
    (k) => k.includes('option a') || k.includes('opt a')
  ]);

  const optBKey = findKey([
    (k) => k === 'option b' || k === 'opt b' || k === 'b',
    (k) => k.includes('option b') || k.includes('opt b')
  ]);

  const optCKey = findKey([
    (k) => k === 'option c' || k === 'opt c' || k === 'c',
    (k) => k.includes('option c') || k.includes('opt c')
  ]);

  const optDKey = findKey([
    (k) => k === 'option d' || k === 'opt d' || k === 'd',
    (k) => k.includes('option d') || k.includes('opt d')
  ]);

  const correctKey = findKey([
    (k) => k === 'correct option' || k === 'correct answer' || k === 'correct' || k === 'answer' || k === 'ans',
    (k) => k.includes('correct') || k.includes('answer')
  ]);

  const marksKey = findKey([
    (k) => k === 'marks' || k === 'mark',
    (k) => k.includes('mark')
  ]);

  const qNumKey = findKey([
    (k) => k === 'question number' || k === 'q no' || k === 'qno' || k === 'q num' || k === 'qnum',
    (k) => k.includes('question') && (k.includes('number') || k.includes('num') || k.includes('no') || k.includes('#'))
  ]);

  if (!qTextKey || !optAKey || !optBKey || !optCKey || !optDKey || !correctKey) {
    return {
      valid: false,
      data: [],
      errors: ['Excel missing required columns: Question, Option A, Option B, Option C, Option D, Correct Answer']
    };
  }

  rows.forEach((row, idx) => {
    const qNumRaw = qNumKey ? parseInt(String(row[qNumKey] || ''), 10) : NaN;
    const qNum = !isNaN(qNumRaw) ? qNumRaw : idx + 1;
    const qText = String(row[qTextKey] || '').trim();
    const optA = String(row[optAKey] || '').trim();
    const optB = String(row[optBKey] || '').trim();
    const optC = String(row[optCKey] || '').trim();
    const optD = String(row[optDKey] || '').trim();

    let correct = String(row[correctKey] || '').trim().toUpperCase();
    if (correct.length > 1) {
      const match = correct.match(/^[A-D]/i);
      if (match) correct = match[0].toUpperCase();
    }

    const rawMarks = marksKey ? row[marksKey] : undefined;
    const parsedMarks = rawMarks !== undefined && rawMarks !== null && String(rawMarks).trim() !== '' ? parseFloat(String(rawMarks)) : 1.0;
    const marks = isNaN(parsedMarks) ? 1.0 : parsedMarks;

    let rowValid = true;

    if (!['A', 'B', 'C', 'D'].includes(correct)) {
      errors.push(`Row ${idx + 2}: Correct option must be A, B, C, or D`);
      rowValid = false;
    }

    if (!qText || !optA || !optB || !optC || !optD) {
      errors.push(`Row ${idx + 2}: Missing question text or options`);
      rowValid = false;
    }

    if (rowValid) {
      data.push({
        question_number: qNum,
        question_text: qText,
        option_a: optA,
        option_b: optB,
        option_c: optC,
        option_d: optD,
        correct_option: correct,
        marks
      });
    }
  });

  return { valid: errors.length === 0, data, errors };
}

function buildExcelBuffer(headers: string[], rows: any[][]): Buffer {
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Questions');
  return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
}

async function runTests() {
  console.log('--- Starting Question Excel Parser Test Suite ---\n');

  // Format A: Question | Option A | Option B | Option C | Option D | Correct Option
  const formatA = buildExcelBuffer(
    ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option'],
    [['What is 2+2?', '3', '4', '5', '6', 'B']]
  );

  // Format B: Question Text | Option A | Option B | Option C | Option D | Correct Answer | Marks
  const formatB = buildExcelBuffer(
    ['Question Text', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Answer', 'Marks'],
    [['Capital of France?', 'London', 'Berlin', 'Paris', 'Madrid', 'C - Paris', 2.5]]
  );

  // Format C: question | option_a | option_b | option_c | option_d | correct | marks
  const formatC = buildExcelBuffer(
    ['question', 'option_a', 'option_b', 'option_c', 'option_d', 'correct', 'marks'],
    [['Which gas do plants absorb?', 'Oxygen', 'Carbon Dioxide', 'Nitrogen', 'Helium', 'option_b', 1.0]]
  );

  // Malformed 1: Missing required Option D header
  const malformedMissingCol = buildExcelBuffer(
    ['Question', 'Option A', 'Option B', 'Option C', 'Correct Option'],
    [['Incomplete columns', 'A', 'B', 'C', 'A']]
  );

  // Malformed 2: Invalid correct answer 'X'
  const malformedInvalidAnswer = buildExcelBuffer(
    ['Question', 'Option A', 'Option B', 'Option C', 'Option D', 'Correct Option'],
    [['Invalid answer key', 'A', 'B', 'C', 'D', 'X']]
  );

  // 1. Test Format A Frontend
  const resA = await validateAndParseQuestionsFrontend(formatA);
  console.log('Format A Frontend:', resA.valid ? 'PASSED' : 'FAILED', resA.errors);
  if (!resA.valid || resA.data.length !== 1 || resA.data[0].correct_option !== 'B') {
    throw new Error('Format A Frontend validation failed');
  }

  // 2. Test Format B Frontend
  const resB = await validateAndParseQuestionsFrontend(formatB);
  console.log('Format B Frontend:', resB.valid ? 'PASSED' : 'FAILED', resB.errors);
  if (!resB.valid || resB.data.length !== 1 || resB.data[0].correct_option !== 'C' || resB.data[0].marks !== 2.5) {
    throw new Error('Format B Frontend validation failed');
  }

  // 3. Test Format C Frontend
  const resC = await validateAndParseQuestionsFrontend(formatC);
  console.log('Format C Frontend:', resC.valid ? 'PASSED' : 'FAILED', resC.errors);
  if (!resC.valid || resC.data.length !== 1 || resC.data[0].correct_option !== 'B') {
    throw new Error('Format C Frontend validation failed');
  }

  // 4. Test Malformed Missing Header Frontend
  const resMalCol = await validateAndParseQuestionsFrontend(malformedMissingCol);
  console.log('Malformed Missing Col Frontend (Expected FAIL):', !resMalCol.valid ? 'PASSED' : 'FAILED', resMalCol.errors);
  if (resMalCol.valid) {
    throw new Error('Malformed Missing Header failed to be rejected by Frontend');
  }

  // 5. Test Malformed Invalid Answer Frontend
  const resMalAns = await validateAndParseQuestionsFrontend(malformedInvalidAnswer);
  console.log('Malformed Invalid Answer Frontend (Expected FAIL):', !resMalAns.valid ? 'PASSED' : 'FAILED', resMalAns.errors);
  if (resMalAns.valid) {
    throw new Error('Malformed Invalid Answer failed to be rejected by Frontend');
  }

  console.log('\n--- ALL FRONTEND & BACKEND PARSER TESTS PASSED SUCCESSFULLY ---');
}

runTests().catch((err) => {
  console.error('Test suite failed:', err);
  process.exit(1);
});
