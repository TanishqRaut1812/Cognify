import ExcelJS from 'exceljs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { query, transaction } from '../db/pool';
import { s3Client } from './storage.service';
import { createAuditLog } from './auditLog.service';
import { QuestionDto } from '../types/read.types';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface CreateQuestionInput {
  testId: number;
  questionNumber?: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: 'A' | 'B' | 'C' | 'D';
  marks?: number;
}

export async function getAdminQuestionsForTest(testId: number): Promise<QuestionDto[]> {
  const sql = `
    SELECT 
      id,
      test_id AS "testId",
      question_number AS "questionNumber",
      question_text AS "questionText",
      option_a AS "optionA",
      option_b AS "optionB",
      option_c AS "optionC",
      option_d AS "optionD",
      marks,
      COALESCE(NULLIF(correct_answer, ''), correct_option) AS "correctAnswer"
    FROM questions
    WHERE test_id = $1 AND is_active = 1
    ORDER BY question_number ASC, id ASC;
  `;

  const res = await query(sql, [testId]);
  return res.rows.map((r) => ({
    ...r,
    marks: parseFloat(r.marks)
  }));
}

export async function getQuestionByIdAdmin(id: number): Promise<QuestionDto> {
  const sql = `
    SELECT 
      id,
      test_id AS "testId",
      question_number AS "questionNumber",
      question_text AS "questionText",
      option_a AS "optionA",
      option_b AS "optionB",
      option_c AS "optionC",
      option_d AS "optionD",
      marks,
      COALESCE(NULLIF(correct_answer, ''), correct_option) AS "correctAnswer"
    FROM questions
    WHERE id = $1;
  `;

  const res = await query(sql, [id]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Question with ID ${id} not found`);
  }
  return {
    ...res.rows[0],
    marks: parseFloat(res.rows[0].marks)
  };
}

export async function createQuestionAdmin(input: CreateQuestionInput): Promise<QuestionDto> {
  if (!input.testId || !input.questionText || !input.optionA || !input.optionB || !input.optionC || !input.optionD) {
    throw new ValidationError('Question text and all four options (A, B, C, D) are required');
  }

  const validAnswer = String(input.correctAnswer || 'A').toUpperCase();
  if (!['A', 'B', 'C', 'D'].includes(validAnswer)) {
    throw new ValidationError('Correct answer must be A, B, C, or D');
  }

  let qNum = input.questionNumber;
  if (!qNum) {
    const maxRes = await query(`SELECT MAX(question_number) as max_num FROM questions WHERE test_id = $1;`, [input.testId]);
    qNum = (maxRes.rows[0]?.max_num || 0) + 1;
  }

  const sql = `
    INSERT INTO questions (
      test_id, question_number, question_text, option_a, option_b, option_c, option_d,
      correct_answer, correct_option, marks, is_active
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 1)
    RETURNING id;
  `;

  const res = await query(sql, [
    input.testId,
    qNum,
    input.questionText,
    input.optionA,
    input.optionB,
    input.optionC,
    input.optionD,
    validAnswer,
    input.marks || 1.0
  ]);

  const newId = res.rows[0].id;

  await createAuditLog({
    action: 'CREATE_QUESTION',
    entityType: 'question',
    entityId: newId,
    testId: input.testId,
    details: `Created question #${qNum} for test ${input.testId}`
  });

  return getQuestionByIdAdmin(newId);
}

export async function updateQuestionAdmin(id: number, input: Partial<CreateQuestionInput>): Promise<QuestionDto> {
  const current = await getQuestionByIdAdmin(id);

  let validAnswer = current.correctAnswer;
  if (input.correctAnswer) {
    const upper = String(input.correctAnswer).toUpperCase();
    if (!['A', 'B', 'C', 'D'].includes(upper)) {
      throw new ValidationError('Correct answer must be A, B, C, or D');
    }
    validAnswer = upper as any;
  }

  const sql = `
    UPDATE questions
    SET 
      question_number = COALESCE($1, question_number),
      question_text = COALESCE($2, question_text),
      option_a = COALESCE($3, option_a),
      option_b = COALESCE($4, option_b),
      option_c = COALESCE($5, option_c),
      option_d = COALESCE($6, option_d),
      correct_answer = COALESCE($7, correct_answer),
      correct_option = COALESCE($7, correct_option),
      marks = COALESCE($8, marks),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $9;
  `;

  await query(sql, [
    input.questionNumber || null,
    input.questionText || null,
    input.optionA || null,
    input.optionB || null,
    input.optionC || null,
    input.optionD || null,
    validAnswer || null,
    input.marks || null,
    id
  ]);

  const updated = await getQuestionByIdAdmin(id);

  await createAuditLog({
    action: 'UPDATE_QUESTION',
    entityType: 'question',
    entityId: id,
    testId: updated.testId,
    previousValue: JSON.stringify(current),
    newValue: JSON.stringify(updated)
  });

  return updated;
}

export async function deleteQuestionAdmin(id: number): Promise<void> {
  const q = await getQuestionByIdAdmin(id);
  await query(`DELETE FROM questions WHERE id = $1;`, [id]);

  await createAuditLog({
    action: 'DELETE_QUESTION',
    entityType: 'question',
    entityId: id,
    testId: q.testId,
    details: `Deleted question #${q.questionNumber} from test ${q.testId}`
  });
}

export async function importQuestionsFromExcel(
  testId: number,
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{
  totalRows: number;
  inserted: number;
  invalid: number;
  storageKey?: string;
  errors: string[];
}> {
  const timestamp = Date.now();
  const s3Key = `question-lists/test_${testId}_questions_${timestamp}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: 'question-lists',
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );
  } catch (err: any) {
    console.warn(`S3 upload warning during question Excel import: ${err.message}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new ValidationError('Excel file contains no readable worksheets');
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '')
      .trim()
      .toLowerCase()
      .replace(/_/g, ' ')
      .replace(/\s+/g, ' ');
  });

  const qTextCol = headers.findIndex(
    (h) => h && ((h.includes('question') && !h.includes('number') && !h.includes('num') && !h.includes('no') && !h.includes('#')) || h.includes('qtext'))
  );
  const optACol = headers.findIndex((h) => h && (h.includes('option a') || h.includes('opt a') || h === 'a'));
  const optBCol = headers.findIndex((h) => h && (h.includes('option b') || h.includes('opt b') || h === 'b'));
  const optCCol = headers.findIndex((h) => h && (h.includes('option c') || h.includes('opt c') || h === 'c'));
  const optDCol = headers.findIndex((h) => h && (h.includes('option d') || h.includes('opt d') || h === 'd'));
  const ansCol = headers.findIndex((h) => h && (h.includes('answer') || h.includes('correct')));
  const marksCol = headers.findIndex((h) => h && h.includes('mark'));

  if (qTextCol === -1 || optACol === -1 || optBCol === -1 || optCCol === -1 || optDCol === -1 || ansCol === -1) {
    throw new ValidationError('Excel missing required columns: Question, Option A, Option B, Option C, Option D, Correct Answer');
  }

  const questionsToInsert: Array<{
    qNum: number;
    qText: string;
    optA: string;
    optB: string;
    optC: string;
    optD: string;
    ans: string;
    marks: number;
  }> = [];

  const errors: string[] = [];
  let invalidCount = 0;
  let qNumberCounter = 1;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const qText = String(row.getCell(qTextCol).value || '').trim();
    const optA = String(row.getCell(optACol).value || '').trim();
    const optB = String(row.getCell(optBCol).value || '').trim();
    const optC = String(row.getCell(optCCol).value || '').trim();
    const optD = String(row.getCell(optDCol).value || '').trim();
    let ans = String(row.getCell(ansCol).value || '').trim().toUpperCase();

    if (ans.length > 1) {
      const startMatch = ans.match(/^[A-D]\b/i) || ans.match(/^[A-D][\s.\-_)]/i);
      if (startMatch) {
        ans = startMatch[0][0].toUpperCase();
      } else {
        const optMatch = ans.match(/(?:OPTION|OPT)[\s_]*([A-D])\b/i) || ans.match(/\b([A-D])\b/i);
        if (optMatch) ans = optMatch[1].toUpperCase();
      }
    }

    const rawMarks = marksCol !== -1 ? String(row.getCell(marksCol).value || '').trim() : '';
    const parsedMarks = rawMarks ? parseFloat(rawMarks) : 1.0;
    const marks = isNaN(parsedMarks) ? 1.0 : parsedMarks;

    if (!qText || !optA || !optB || !optC || !optD || !['A', 'B', 'C', 'D'].includes(ans)) {
      invalidCount++;
      errors.push(`Row ${rowNumber}: Invalid question text, options, or correct answer ('${ans}')`);
      return;
    }

    questionsToInsert.push({
      qNum: qNumberCounter++,
      qText,
      optA,
      optB,
      optC,
      optD,
      ans,
      marks
    });
  });

  let insertedCount = 0;

  await transaction(async (client) => {
    for (const item of questionsToInsert) {
      await client.query(
        `
        INSERT INTO questions (
          test_id, question_number, question_text, option_a, option_b, option_c, option_d,
          correct_answer, correct_option, marks, is_active
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8, $9, 1);
      `,
        [testId, item.qNum, item.qText, item.optA, item.optB, item.optC, item.optD, item.ans, item.marks]
      );
      insertedCount++;
    }

    await createAuditLog(
      {
        action: 'EXCEL_IMPORT_QUESTIONS',
        entityType: 'question',
        testId,
        details: `Imported ${insertedCount} questions from Excel file ${originalFilename} into test ${testId}`
      },
      client
    );
  });

  return {
    totalRows: worksheet.rowCount - 1,
    inserted: insertedCount,
    invalid: invalidCount,
    storageKey: s3Key,
    errors
  };
}
