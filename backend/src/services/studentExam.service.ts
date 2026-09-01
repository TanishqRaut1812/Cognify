import { query, transaction } from '../db/pool';
import { generateAttemptToken } from './studentAuth.service';
import { QuestionDto, TestMetadataDto } from '../types/read.types';
import { AppError, NotFoundError, ValidationError } from '../types/api.types';

export interface StudentProfileDto {
  id: number;
  registrationNumber: string;
  name: string;
  class: string;
}

export interface StudentAttemptDetailsDto {
  id: number;
  testId: number;
  studentId?: number;
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

export interface StudentAnswerDto {
  questionId: number;
  selectedOption: string;
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
    SELECT id, registration_no AS "registrationNumber", name, class_name AS class
    FROM students
    WHERE registration_no = $1 OR registration_number = $1
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
      COALESCE(NULLIF(t.title, ''), t.test_name) AS title,
      c.code AS "className",
      t.class_id AS "classId",
      t.test_date AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.duration_minutes AS "durationMinutes",
      t.total_marks AS "totalMarks",
      t.status,
      t.result_status AS "resultStatus",
      (t.is_published = 1) AS "isPublished",
      t.instructions
    FROM tests t
    LEFT JOIN classes c ON t.class_id = c.id
    WHERE (t.class_id = (SELECT class_id FROM students WHERE id = $1) OR c.code = $2)
    ORDER BY t.test_date DESC, t.id DESC;
  `;

  const res = await query(sql, [student.id, student.class]);
  return res.rows;
}

export async function startTestAttempt(
  registrationNumber: string,
  testId: number
): Promise<{ attempt: StudentAttemptDetailsDto; attemptToken: string }> {
  const student = await verifyStudent(registrationNumber);

  // Fetch test details
  const testRes = await query(`SELECT * FROM tests WHERE id = $1;`, [testId]);
  if (testRes.rows.length === 0) {
    throw new NotFoundError(`Test with ID ${testId} not found`);
  }
  const test = testRes.rows[0];

  if (test.status === 'Upcoming') {
    throw new AppError('Test is not yet active for student attempts', 403, 'TEST_NOT_ACTIVE');
  }

  if (test.status === 'Completed') {
    throw new AppError('Test has already been completed by admin', 403, 'TEST_COMPLETED');
  }

  // Execute within transaction to prevent race conditions & duplicate attempts
  return await transaction(async (client) => {
    // Lock existing attempt for this student and test
    const existingRes = await client.query(
      `SELECT * FROM student_attempts WHERE test_id = $1 AND (student_id = $2 OR registration_no = $3) FOR UPDATE;`,
      [testId, student.id, student.registrationNumber]
    );

    let attemptRow: any;

    if (existingRes.rows.length > 0) {
      attemptRow = existingRes.rows[0];

      if (attemptRow.attempt_status === 'Submitted' || attemptRow.attempt_status === 'Terminated') {
        throw new AppError(
          `Test attempt is already ${attemptRow.attempt_status.toLowerCase()}`,
          409,
          'ATTEMPT_ALREADY_COMPLETED'
        );
      }
    } else {
      // Create new attempt row
      const insertRes = await client.query(
        `
        INSERT INTO student_attempts (
          test_id, student_id, registration_no, started_at, start_time, attempt_status, attendance,
          fullscreen_violation_count, violation_count, cheating_flag
        ) VALUES ($1, $2, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, 'In Progress', 'Absent', 0, 0, 0)
        RETURNING *;
      `,
        [testId, student.id, student.registrationNumber]
      );
      attemptRow = insertRes.rows[0];
    }

    const startedAt = new Date(attemptRow.started_at || attemptRow.start_time || Date.now());
    const durationMinutes = test.duration_minutes || 60;
    const deadline = new Date(startedAt.getTime() + durationMinutes * 60 * 1000);
    const now = new Date();

    // Expiry check
    if (now > deadline && attemptRow.attempt_status === 'In Progress') {
      await finalizeAttemptExpiry(client, attemptRow.id, test);
      throw new AppError('Attempt deadline has passed', 410, 'ATTEMPT_EXPIRED');
    }

    const attemptToken = generateAttemptToken(
      attemptRow.id,
      testId,
      student.registrationNumber,
      durationMinutes
    );

    const attemptDetails: StudentAttemptDetailsDto = {
      id: attemptRow.id,
      testId,
      studentId: student.id,
      registrationNo: student.registrationNumber,
      startedAt: startedAt.toISOString(),
      deadline: deadline.toISOString(),
      currentServerTime: now.toISOString(),
      attemptStatus: attemptRow.attempt_status,
      fullscreenViolationCount: attemptRow.fullscreen_violation_count || 0,
      cheatingFlag: attemptRow.cheating_flag === 1
    };

    return { attempt: attemptDetails, attemptToken };
  });
}

export async function finalizeAttemptExpiry(clientOrPool: any, attemptId: number, test: any): Promise<void> {
  const answersRes = await clientOrPool.query(
    `SELECT question_id, selected_answer, selected_option FROM student_answers WHERE attempt_id = $1;`,
    [attemptId]
  );
  const questionsRes = await clientOrPool.query(
    `SELECT id, correct_answer, marks FROM questions WHERE test_id = $1 AND is_active = 1;`,
    [test.id]
  );

  const answerMap = new Map<number, string>();
  answersRes.rows.forEach((r: any) => {
    answerMap.set(r.question_id, r.selected_answer || r.selected_option || '');
  });

  let totalScore = 0;
  questionsRes.rows.forEach((q: any) => {
    const selected = answerMap.get(q.id);
    if (selected && selected.toUpperCase() === q.correct_answer.toUpperCase()) {
      totalScore += parseFloat(q.marks || 1.0);
    }
  });

  const percentage = Math.round((totalScore / test.total_marks) * 10000) / 100;

  await clientOrPool.query(
    `
    UPDATE student_attempts
    SET 
      attempt_status = 'Submitted',
      submitted_at = CURRENT_TIMESTAMP,
      score = $1,
      calculated_score = $1,
      percentage = $2,
      calculated_percentage = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $3;
  `,
    [totalScore, percentage, attemptId]
  );

  // Sync to test_results
  const attRes = await clientOrPool.query(`SELECT registration_no, student_id FROM student_attempts WHERE id = $1;`, [attemptId]);
  if (attRes.rows.length > 0) {
    const regNo = attRes.rows[0].registration_no;
    const stId = attRes.rows[0].student_id;
    await clientOrPool.query(
      `
      INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained, percentage, published)
      VALUES ($1, $2, $3, 'Absent', $4, $5, 0)
      ON CONFLICT (test_id, registration_no)
      DO UPDATE SET 
        marks_obtained = EXCLUDED.marks_obtained,
        percentage = EXCLUDED.percentage,
        updated_at = CURRENT_TIMESTAMP;
    `,
      [test.id, stId, regNo, totalScore, percentage]
    );
  }
}

export async function getAttemptDetailsAdminOrStudent(attemptId: number): Promise<StudentAttemptDetailsDto> {
  const sql = `
    SELECT 
      sa.id,
      sa.test_id AS "testId",
      sa.student_id AS "studentId",
      sa.registration_no AS "registrationNo",
      sa.started_at AS "startedAt",
      sa.start_time AS "startTime",
      sa.attempt_status AS "attemptStatus",
      sa.fullscreen_violation_count AS "fullscreenViolationCount",
      (sa.cheating_flag = 1) AS "cheatingFlag",
      t.duration_minutes AS "durationMinutes"
    FROM student_attempts sa
    LEFT JOIN tests t ON sa.test_id = t.id
    WHERE sa.id = $1;
  `;

  const res = await query(sql, [attemptId]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
  }

  const row = res.rows[0];
  const startedAt = new Date(row.startedAt || row.startTime || Date.now());
  const deadline = new Date(startedAt.getTime() + (row.durationMinutes || 60) * 60 * 1000);
  const now = new Date();

  if (now > deadline && row.attemptStatus === 'In Progress') {
    const testRes = await query(`SELECT * FROM tests WHERE id = $1;`, [row.testId]);
    if (testRes.rows.length > 0) {
      await finalizeAttemptExpiry(query, attemptId, testRes.rows[0]);
      row.attemptStatus = 'Submitted';
    }
  }

  return {
    id: row.id,
    testId: row.testId,
    studentId: row.studentId,
    registrationNo: row.registrationNo,
    startedAt: startedAt.toISOString(),
    deadline: deadline.toISOString(),
    currentServerTime: now.toISOString(),
    attemptStatus: row.attemptStatus as any,
    fullscreenViolationCount: row.fullscreenViolationCount || 0,
    cheatingFlag: row.cheatingFlag
  };
}

export async function getExamQuestionsForStudent(attemptId: number): Promise<SafeStudentQuestionDto[]> {
  const attempt = await getAttemptDetailsAdminOrStudent(attemptId);

  if (attempt.attemptStatus === 'Terminated') {
    throw new AppError('Attempt terminated due to cheating violations', 403, 'ATTEMPT_TERMINATED');
  }

  const sql = `
    SELECT 
      id,
      question_number AS "questionNumber",
      question_text AS "questionText",
      option_a AS "optionA",
      option_b AS "optionB",
      option_c AS "optionC",
      option_d AS "optionD",
      marks
    FROM questions
    WHERE test_id = $1 AND is_active = 1
    ORDER BY question_number ASC, id ASC;
  `;

  const res = await query(sql, [attempt.testId]);
  return res.rows.map((r) => ({
    ...r,
    marks: parseFloat(r.marks)
  }));
}

export async function saveStudentAnswer(
  attemptId: number,
  questionId: number,
  selectedOption: string
): Promise<{ success: boolean; questionId: number; selectedOption: string }> {
  const attempt = await getAttemptDetailsAdminOrStudent(attemptId);

  if (attempt.attemptStatus !== 'In Progress') {
    throw new AppError(`Cannot save answers for attempt with status '${attempt.attemptStatus}'`, 403, 'ATTEMPT_NOT_IN_PROGRESS');
  }

  const opt = (selectedOption || '').trim().toUpperCase();
  if (opt !== '' && !['A', 'B', 'C', 'D'].includes(opt)) {
    throw new ValidationError('Selected option must be A, B, C, D, or empty');
  }

  // Verify question belongs to test
  const qCheck = await query(`SELECT id FROM questions WHERE id = $1 AND test_id = $2;`, [questionId, attempt.testId]);
  if (qCheck.rows.length === 0) {
    throw new ValidationError(`Question ${questionId} does not belong to test ${attempt.testId}`);
  }

  const sql = `
    INSERT INTO student_answers (attempt_id, question_id, selected_answer, selected_option, answered_at, saved_at)
    VALUES ($1, $2, $3, $3, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    ON CONFLICT (attempt_id, question_id)
    DO UPDATE SET 
      selected_answer = EXCLUDED.selected_answer,
      selected_option = EXCLUDED.selected_option,
      saved_at = CURRENT_TIMESTAMP;
  `;

  await query(sql, [attemptId, questionId, opt]);
  return { success: true, questionId, selectedOption: opt };
}

export async function getSavedAnswersForStudent(attemptId: number): Promise<StudentAnswerDto[]> {
  await getAttemptDetailsAdminOrStudent(attemptId);

  const sql = `
    SELECT 
      question_id AS "questionId",
      COALESCE(NULLIF(selected_answer, ''), selected_option, '') AS "selectedOption"
    FROM student_answers
    WHERE attempt_id = $1
    ORDER BY question_id ASC;
  `;

  const res = await query(sql, [attemptId]);
  return res.rows;
}

export async function reportFullscreenViolation(
  attemptId: number
): Promise<{ violationCount: number; terminated: boolean; cheating: boolean; message?: string }> {
  const attempt = await getAttemptDetailsAdminOrStudent(attemptId);

  if (attempt.attemptStatus === 'Terminated' || attempt.cheatingFlag) {
    return {
      violationCount: attempt.fullscreenViolationCount,
      terminated: true,
      cheating: true,
      message: 'Attempt is already terminated for cheating'
    };
  }

  if (attempt.attemptStatus === 'Submitted') {
    throw new AppError('Attempt is already submitted', 400, 'ATTEMPT_SUBMITTED');
  }

  const newCount = attempt.fullscreenViolationCount + 1;
  const isTerminated = newCount > 3;
  const newStatus = isTerminated ? 'Terminated' : 'In Progress';
  const cheatingFlag = isTerminated ? 1 : 0;

  const sql = `
    UPDATE student_attempts
    SET 
      fullscreen_violation_count = $1,
      violation_count = $1,
      cheating_flag = $2,
      attempt_status = $3,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $4
    RETURNING fullscreen_violation_count;
  `;

  await query(sql, [newCount, cheatingFlag, newStatus, attemptId]);

  return {
    violationCount: newCount,
    terminated: isTerminated,
    cheating: isTerminated,
    message: isTerminated ? 'Test attempt terminated due to excessive fullscreen exits (>3 violations).' : `Warning: Fullscreen exit #${newCount} recorded.`
  };
}

export async function submitTestAttempt(attemptId: number): Promise<{
  success: boolean;
  attemptId: number;
  status: string;
  submittedAt: string;
  message: string;
}> {
  return await transaction(async (client) => {
    // Lock attempt row
    const attRes = await client.query(`SELECT * FROM student_attempts WHERE id = $1 FOR UPDATE;`, [attemptId]);
    if (attRes.rows.length === 0) {
      throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
    }

    const attempt = attRes.rows[0];

    if (attempt.attempt_status === 'Submitted') {
      return {
        success: true,
        attemptId,
        status: 'Submitted',
        submittedAt: new Date(attempt.submitted_at || Date.now()).toISOString(),
        message: 'Test has already been submitted.'
      };
    }

    if (attempt.attempt_status === 'Terminated') {
      throw new AppError('Terminated test attempts cannot be submitted normally', 403, 'ATTEMPT_TERMINATED');
    }

    const testId = attempt.test_id;
    const testRes = await client.query(`SELECT * FROM tests WHERE id = $1;`, [testId]);
    const test = testRes.rows[0];

    // Load active questions & correct answers
    const questionsRes = await client.query(
      `SELECT id, correct_answer, marks FROM questions WHERE test_id = $1 AND is_active = 1;`,
      [testId]
    );

    // Load saved answers
    const answersRes = await client.query(
      `SELECT question_id, selected_answer, selected_option FROM student_answers WHERE attempt_id = $1;`,
      [attemptId]
    );

    const answerMap = new Map<number, string>();
    answersRes.rows.forEach((r: any) => {
      answerMap.set(r.question_id, r.selected_answer || r.selected_option || '');
    });

    let totalScore = 0;
    questionsRes.rows.forEach((q: any) => {
      const selected = answerMap.get(q.id);
      if (selected && selected.toUpperCase() === q.correct_answer.toUpperCase()) {
        totalScore += parseFloat(q.marks || 1.0);
      }
    });

    const totalMarks = parseFloat(test.total_marks || 100);
    const percentage = Math.round((totalScore / totalMarks) * 10000) / 100;
    const submittedAt = new Date();

    // Update attempt
    await client.query(
      `
      UPDATE student_attempts
      SET 
        attempt_status = 'Submitted',
        submitted_at = $1,
        score = $2,
        calculated_score = $2,
        percentage = $3,
        calculated_percentage = $3,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $4;
    `,
      [submittedAt, totalScore, percentage, attemptId]
    );

    // Upsert into test_results
    await client.query(
      `
      INSERT INTO test_results (test_id, student_id, registration_no, attendance, marks_obtained, percentage, published)
      VALUES ($1, $2, $3, 'Absent', $4, $5, $6)
      ON CONFLICT (test_id, registration_no)
      DO UPDATE SET 
        marks_obtained = EXCLUDED.marks_obtained,
        percentage = EXCLUDED.percentage,
        updated_at = CURRENT_TIMESTAMP;
    `,
      [testId, attempt.student_id, attempt.registration_no, totalScore, percentage, test.result_status === 'Published' ? 1 : 0]
    );

    return {
      success: true,
      attemptId,
      status: 'Submitted',
      submittedAt: submittedAt.toISOString(),
      message: 'Test submitted successfully.'
    };
  });
}

export async function getStudentResultsService(registrationNumber: string): Promise<StudentResultDto[]> {
  const student = await verifyStudent(registrationNumber);

  const sql = `
    SELECT 
      tr.test_id AS "testId",
      COALESCE(NULLIF(t.title, ''), t.test_name) AS "testTitle",
      t.total_marks AS "totalMarks",
      tr.attendance,
      (tr.published = 1 AND t.result_status = 'Published') AS published,
      tr.marks_obtained AS "marksObtained",
      tr.percentage
    FROM test_results tr
    LEFT JOIN tests t ON tr.test_id = t.id
    WHERE tr.student_id = $1 OR tr.registration_no = $2
    ORDER BY t.test_date DESC, t.id DESC;
  `;

  const res = await query(sql, [student.id, student.registrationNumber]);

  return res.rows.map((r) => {
    const isPub = Boolean(r.published);
    return {
      testId: r.testId,
      testTitle: r.testTitle,
      totalMarks: parseFloat(r.totalMarks),
      attendance: r.attendance,
      published: isPub,
      marksObtained: isPub ? parseFloat(r.marksObtained) : null,
      percentage: isPub ? parseFloat(r.percentage) : null
    };
  });
}
