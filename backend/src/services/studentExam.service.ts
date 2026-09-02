import { query } from '../db/pool';
import { generateAttemptToken } from './studentAuth.service';
import { TestMetadataDto } from '../types/read.types';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface StudentProfileDto {
  registrationNumber: string;
  name: string;
  class: string;
}

export interface StudentAttemptDetailsDto {
  id: number;
  testId: number;
  registrationNo: string;
  startedAt: string;
  deadline: string;
  currentServerTime: string;
  attemptStatus: 'In Progress' | 'Submitted' | 'Terminated';
  fullscreenViolationCount: number;
  cheatingFlag: boolean;
  score?: number;
  percentage?: number;
}

export interface SafeStudentQuestionDto {
  id: number;
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  marks: number;
}

export interface StudentResultDto {
  testId: number;
  testTitle: string;
  totalMarks: number;
  attendance: string;
  published: boolean;
  marksObtained?: number | null;
  percentage?: number | null;
}

export async function verifyStudent(registrationNumber: string): Promise<StudentProfileDto> {
  if (!registrationNumber || !registrationNumber.trim()) {
    throw new ValidationError('Registration number is required');
  }

  const regNo = registrationNumber.trim();
  const sql = `
    SELECT registration_no AS "registrationNumber", name, class_name AS class
    FROM students
    WHERE registration_no = $1
    LIMIT 1;
  `;

  const res = await query(sql, [regNo]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Student with Registration Number '${regNo}' not found`);
  }

  return res.rows[0];
}

export async function getAvailableTestsForStudent(registrationNumber: string): Promise<TestMetadataDto[]> {
  const student = await verifyStudent(registrationNumber);

  const sql = `
    SELECT 
      t.id,
      t.test_number AS "testNumber",
      t.test_name AS title,
      t.class_name AS "className",
      t.test_date AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.duration_minutes AS "durationMinutes",
      t.total_marks AS "totalMarks",
      t.status,
      (t.is_published = 1) AS "isPublished",
      t.instructions
    FROM tests t
    ORDER BY t.id ASC;
  `;

  const res = await query(sql);
  return res.rows.map((t) => ({
    id: t.id,
    testNumber: t.testNumber,
    title: t.title,
    className: t.className || student.class,
    testDate: t.testDate,
    startTime: t.startTime,
    finishTime: t.finishTime,
    durationMinutes: t.durationMinutes,
    totalMarks: parseFloat(t.totalMarks) || 50,
    status: t.status,
    isPublished: Boolean(t.isPublished),
    resultStatus: Boolean(t.isPublished) ? 'Published' : 'Unpublished',
    instructions: t.instructions || ''
  }));
}

export async function startTestAttempt(testId: number, registrationNumber: string): Promise<{
  attemptId: number;
  attemptToken: string;
  student: StudentProfileDto;
  test: TestMetadataDto;
  questions: SafeStudentQuestionDto[];
  startedAt: string;
  deadline: string;
  durationMinutes: number;
}> {
  const student = await verifyStudent(registrationNumber);
  
  const testRes = await query('SELECT * FROM tests WHERE id = $1', [testId]);
  if (testRes.rows.length === 0) {
    throw new NotFoundError(`Test with ID ${testId} not found`);
  }
  const test = testRes.rows[0];
  const durationMins = test.duration_minutes || 60;

  const attemptRes = await query(
    `INSERT INTO student_attempts (test_id, registration_no, attempt_status, attendance, started_at, start_time)
     VALUES ($1, $2, 'In Progress', 'Present', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
     ON CONFLICT (test_id, registration_no) DO UPDATE 
     SET attempt_status = EXCLUDED.attempt_status, attendance = 'Present'
     RETURNING id, started_at, start_time`,
    [testId, student.registrationNumber]
  );

  const attemptId = attemptRes.rows[0].id;
  const attemptToken = generateAttemptToken(attemptId, testId, student.registrationNumber, durationMins);

  const qRes = await query(
    `SELECT id, question_number AS "questionNumber", question_text AS "questionText", option_a AS "optionA", option_b AS "optionB", option_c AS "optionC", option_d AS "optionD", marks
     FROM questions
     WHERE test_id = $1 AND is_active = 1
     ORDER BY question_number ASC`,
    [testId]
  );
  const startedAtIso = new Date().toISOString();
  const deadlineIso = new Date(Date.now() + durationMins * 60 * 1000).toISOString();

  return {
    attemptId,
    attemptToken,
    student,
    test: {
      id: test.id,
      testNumber: test.test_number,
      title: test.test_name,
      className: student.class,
      testDate: test.test_date,
      startTime: test.start_time,
      finishTime: test.finish_time,
      durationMinutes: durationMins,
      totalMarks: parseFloat(test.total_marks) || 50,
      status: test.status,
      isPublished: Boolean(test.is_published),
      resultStatus: Boolean(test.is_published) ? 'Published' : 'Unpublished',
      instructions: test.instructions || ''
    },
    questions: qRes.rows.map((q) => ({
      id: q.id,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      marks: parseFloat(q.marks) || 1.0
    })),
    startedAt: startedAtIso,
    deadline: deadlineIso,
    durationMinutes: durationMins
  };
}

export async function getAttemptDetailsAdminOrStudent(attemptId: number): Promise<StudentAttemptDetailsDto> {
  const res = await query(
    `SELECT 
       sa.id,
       sa.test_id AS "testId",
       sa.registration_no AS "registrationNo",
       sa.started_at AS "startedAt",
       sa.attempt_status AS "attemptStatus",
       sa.violation_count AS "fullscreenViolationCount",
       sa.cheating_flag AS "cheatingFlag",
       sa.calculated_score AS score,
       sa.calculated_percentage AS percentage,
       t.duration_minutes
     FROM student_attempts sa
     JOIN tests t ON sa.test_id = t.id
     WHERE sa.id = $1`,
    [attemptId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError(`Attempt ID ${attemptId} not found`);
  }

  const row = res.rows[0];
  const durationMins = row.duration_minutes || 60;
  const startedAtIso = row.startedAt ? new Date(row.startedAt).toISOString() : new Date().toISOString();
  const deadlineIso = new Date(new Date(startedAtIso).getTime() + durationMins * 60 * 1000).toISOString();

  return {
    id: row.id,
    testId: row.testId,
    registrationNo: row.registrationNo,
    startedAt: startedAtIso,
    deadline: deadlineIso,
    currentServerTime: new Date().toISOString(),
    attemptStatus: row.attemptStatus,
    fullscreenViolationCount: row.fullscreenViolationCount || 0,
    cheatingFlag: Boolean(row.cheatingFlag),
    score: parseFloat(row.score) || 0.0,
    percentage: parseFloat(row.percentage) || 0.0
  };
}

export async function getExamQuestionsForStudent(attemptId: number): Promise<SafeStudentQuestionDto[]> {
  const attRes = await query('SELECT test_id FROM student_attempts WHERE id = $1', [attemptId]);
  if (attRes.rows.length === 0) {
    throw new NotFoundError(`Attempt ID ${attemptId} not found`);
  }
  const testId = attRes.rows[0].test_id;

  const res = await query(
    `SELECT id, question_number AS "questionNumber", question_text AS "questionText", option_a AS "optionA", option_b AS "optionB", option_c AS "optionC", option_d AS "optionD", marks
     FROM questions
     WHERE test_id = $1 AND is_active = 1
     ORDER BY question_number ASC`,
    [testId]
  );

  return res.rows.map((q) => ({
    id: q.id,
    questionNumber: q.questionNumber,
    questionText: q.questionText,
    optionA: q.optionA,
    optionB: q.optionB,
    optionC: q.optionC,
    optionD: q.optionD,
    marks: parseFloat(q.marks) || 1.0
  }));
}

export async function getSavedAnswersForStudent(attemptId: number): Promise<{ questionId: number; selectedOption: string }[]> {
  const res = await query(
    `SELECT question_id AS "questionId", selected_option AS "selectedOption"
     FROM student_answers
     WHERE attempt_id = $1`,
    [attemptId]
  );
  return res.rows.map((r) => ({
    questionId: r.questionId,
    selectedOption: r.selectedOption || ''
  }));
}

export async function calculateAndPersistAttemptScore(
  attemptId: number,
  status: 'Submitted' | 'Terminated'
): Promise<{ score: number; percentage: number }> {
  const attRes = await query(
    'SELECT test_id, registration_no, attempt_status, violation_count, cheating_flag FROM student_attempts WHERE id = $1',
    [attemptId]
  );
  if (attRes.rows.length === 0) {
    throw new NotFoundError(`Attempt ID ${attemptId} not found`);
  }
  const { test_id, registration_no, attempt_status, violation_count, cheating_flag } = attRes.rows[0];

  const answersRes = await query(
    `SELECT sa.selected_option, COALESCE(NULLIF(tq.correct_answer, ''), tq.correct_option) AS correct_answer, tq.marks
     FROM student_answers sa
     JOIN questions tq ON sa.question_id = tq.id
     WHERE sa.attempt_id = $1`,
    [attemptId]
  );

  let marksObtained = 0.0;
  for (const a of answersRes.rows) {
    const selected = (a.selected_option || '').trim().toUpperCase();
    const correct = (a.correct_answer || '').trim().toUpperCase();
    if (selected && correct && selected === correct) {
      marksObtained += parseFloat(a.marks) || 1.0;
    }
  }

  const testRes = await query('SELECT total_marks FROM tests WHERE id = $1', [test_id]);
  const totalMarks = parseFloat(testRes.rows[0]?.total_marks) || 50.0;
  const percentage = Math.round((marksObtained / totalMarks) * 10000) / 100;

  const isTerminated = status === 'Terminated' || attempt_status === 'Terminated' || (violation_count || 0) >= 4 || cheating_flag === 1;

  if (isTerminated) {
    await query(
      `UPDATE student_attempts
       SET attempt_status = 'Terminated', cheating_flag = 1, calculated_score = $1, calculated_percentage = $2, score = $3, percentage = $4
       WHERE id = $5`,
      [marksObtained, percentage, marksObtained, percentage, attemptId]
    );
  } else {
    await query(
      `UPDATE student_attempts
       SET attempt_status = 'Submitted', submitted_at = CURRENT_TIMESTAMP, calculated_score = $1, calculated_percentage = $2, score = $3, percentage = $4
       WHERE id = $5`,
      [marksObtained, percentage, marksObtained, percentage, attemptId]
    );
  }

  await query(
    `INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage)
     VALUES ($1, $2, 'Present', $3, $4)
     ON CONFLICT (test_id, registration_no) DO UPDATE SET marks_obtained = EXCLUDED.marks_obtained, percentage = EXCLUDED.percentage`,
    [test_id, registration_no, marksObtained, percentage]
  );

  return { score: marksObtained, percentage };
}

export async function saveStudentAnswer(attemptId: number, questionId: number, selectedOption: string): Promise<void> {
  const attRes = await query(
    `SELECT attempt_status, violation_count, cheating_flag FROM student_attempts WHERE id = $1`,
    [attemptId]
  );
  if (attRes.rows.length === 0) {
    throw new NotFoundError(`Attempt ID ${attemptId} not found`);
  }
  const row = attRes.rows[0];
  if (row.attempt_status === 'Terminated' || (row.violation_count || 0) >= 4 || row.cheating_flag === 1) {
    throw new ValidationError('Exam attempt is terminated due to security violations. Answer modifications are disabled.');
  }

  await query(
    `INSERT INTO student_answers (attempt_id, question_id, selected_option)
     VALUES ($1, $2, $3)
     ON CONFLICT (attempt_id, question_id) DO UPDATE SET selected_option = EXCLUDED.selected_option`,
    [attemptId, questionId, selectedOption || '']
  );
}

export async function reportFullscreenViolation(attemptId: number): Promise<{ violationCount: number; terminated: boolean }> {
  const res = await query(
    `UPDATE student_attempts
     SET violation_count = violation_count + 1,
         fullscreen_violation_count = fullscreen_violation_count + 1,
         attempt_status = CASE WHEN violation_count + 1 >= 4 THEN 'Terminated' ELSE attempt_status END,
         cheating_flag = CASE WHEN violation_count + 1 >= 4 THEN 1 ELSE cheating_flag END
     WHERE id = $1
     RETURNING violation_count, attempt_status, cheating_flag`,
    [attemptId]
  );

  if (res.rows.length === 0) {
    throw new NotFoundError(`Attempt ID ${attemptId} not found`);
  }

  const vCount = res.rows[0].violation_count;
  const isTerminated = vCount >= 4 || res.rows[0].attempt_status === 'Terminated' || res.rows[0].cheating_flag === 1;

  if (isTerminated) {
    await calculateAndPersistAttemptScore(attemptId, 'Terminated');
  }

  return { violationCount: vCount, terminated: isTerminated };
}

export async function submitTestAttempt(attemptId: number): Promise<{ score: number; percentage: number }> {
  const attRes = await query(
    `SELECT attempt_status, violation_count, cheating_flag FROM student_attempts WHERE id = $1`,
    [attemptId]
  );
  if (attRes.rows.length === 0) {
    throw new NotFoundError(`Attempt ID ${attemptId} not found`);
  }
  const row = attRes.rows[0];
  if (row.attempt_status === 'Terminated' || (row.violation_count || 0) >= 4 || row.cheating_flag === 1) {
    return await calculateAndPersistAttemptScore(attemptId, 'Terminated');
  }

  return await calculateAndPersistAttemptScore(attemptId, 'Submitted');
}

export async function getStudentResultsService(registrationNumber: string): Promise<StudentResultDto[]> {
  const res = await query(
    `SELECT 
       t.id AS "testId",
       t.test_name AS "testTitle",
       t.total_marks AS "totalMarks",
       COALESCE(tr.attendance, sa.attendance, 'Absent') AS attendance,
       (t.is_published = 1) AS published,
       tr.marks_obtained AS "marksObtained",
       tr.percentage AS percentage
     FROM tests t
     LEFT JOIN test_results tr ON t.id = tr.test_id AND tr.registration_no = $1
     LEFT JOIN student_attempts sa ON t.id = sa.test_id AND sa.registration_no = $1
     ORDER BY t.id ASC`,
    [registrationNumber]
  );

  return res.rows.map((r) => ({
    testId: r.testId,
    testTitle: r.testTitle,
    totalMarks: parseFloat(r.totalMarks) || 50,
    attendance: r.attendance,
    published: Boolean(r.published),
    marksObtained: r.marksObtained !== null ? parseFloat(r.marksObtained) : null,
    percentage: r.percentage !== null ? parseFloat(r.percentage) : null
  }));
}
