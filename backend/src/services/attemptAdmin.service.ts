import { query } from '../db/pool';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface AttemptAdminDto {
  id: number;
  testId: number;
  testTitle?: string;
  registrationNo: string;
  studentName?: string;
  startedAt: string;
  submittedAt?: string;
  attemptStatus: string;
  attendance?: string;
  fullscreenViolationCount: number;
  violationCount: number;
  cheatingFlag: boolean;
  score: number;
  percentage: number;
}

export interface QuestionReviewItemDto {
  questionId: number;
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  selectedOption: string;
  correctOption: string;
  isCorrect: boolean;
  isAnswered: boolean;
  marks: number;
}

export interface AttemptAnswerReviewDto {
  attemptId: number;
  testId: number;
  registrationNo: string;
  studentName?: string;
  attemptStatus: string;
  summary: {
    totalQuestions: number;
    answeredCount: number;
    unansweredCount: number;
    correctCount: number;
    incorrectCount: number;
    calculatedMarks: number;
    maxMarks: number;
    percentage: number;
  };
  questions: QuestionReviewItemDto[];
}

export async function getTestAttemptsAdmin(testId: number): Promise<AttemptAdminDto[]> {
  const sql = `
    SELECT 
      sa.id,
      sa.test_id AS "testId",
      t.test_name AS "testTitle",
      sa.registration_no AS "registrationNo",
      st.name AS "studentName",
      COALESCE(sa.started_at, sa.start_time) AS "startedAt",
      COALESCE(sa.submitted_at, sa.end_time) AS "submittedAt",
      sa.attempt_status AS "attemptStatus",
      sa.attendance,
      COALESCE(sa.fullscreen_violation_count, sa.violation_count, 0) AS "fullscreenViolationCount",
      COALESCE(sa.violation_count, 0) AS "violationCount",
      (COALESCE(sa.cheating_flag, 0) = 1) AS "cheatingFlag",
      COALESCE(sa.score, sa.calculated_score, 0) AS score,
      COALESCE(sa.percentage, sa.calculated_percentage, 0) AS percentage
    FROM student_attempts sa
    LEFT JOIN students st ON sa.registration_no = st.registration_no
    LEFT JOIN tests t ON sa.test_id = t.id
    WHERE sa.test_id = $1
    ORDER BY COALESCE(sa.started_at, sa.start_time) DESC, sa.id DESC;
  `;

  const res = await query(sql, [testId]);
  return res.rows.map((r) => {
    const vCount = (r.fullscreenViolationCount !== undefined ? r.fullscreenViolationCount : r.violationCount) || 0;
    const isTerminated = r.attemptStatus === 'Terminated' || vCount >= 4 || r.cheatingFlag;
    return {
      ...r,
      attemptStatus: isTerminated ? 'Terminated' : r.attemptStatus,
      startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : new Date().toISOString(),
      submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : undefined,
      score: r.score !== null ? parseFloat(r.score) : 0,
      percentage: r.percentage !== null ? parseFloat(r.percentage) : 0
    };
  });
}

export async function getAttemptByIdAdmin(attemptId: number): Promise<AttemptAdminDto> {
  const sql = `
    SELECT 
      sa.id,
      sa.test_id AS "testId",
      t.test_name AS "testTitle",
      sa.registration_no AS "registrationNo",
      st.name AS "studentName",
      COALESCE(sa.started_at, sa.start_time) AS "startedAt",
      COALESCE(sa.submitted_at, sa.end_time) AS "submittedAt",
      sa.attempt_status AS "attemptStatus",
      sa.attendance,
      COALESCE(sa.fullscreen_violation_count, sa.violation_count, 0) AS "fullscreenViolationCount",
      COALESCE(sa.violation_count, 0) AS "violationCount",
      (COALESCE(sa.cheating_flag, 0) = 1) AS "cheatingFlag",
      COALESCE(sa.score, sa.calculated_score, 0) AS score,
      COALESCE(sa.percentage, sa.calculated_percentage, 0) AS percentage
    FROM student_attempts sa
    LEFT JOIN students st ON sa.registration_no = st.registration_no
    LEFT JOIN tests t ON sa.test_id = t.id
    WHERE sa.id = $1;
  `;

  const res = await query(sql, [attemptId]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Attempt ID ${attemptId} not found`);
  }

  const r = res.rows[0];
  const vCount = (r.fullscreenViolationCount !== undefined ? r.fullscreenViolationCount : r.violationCount) || 0;
  const isTerminated = r.attemptStatus === 'Terminated' || vCount >= 4 || r.cheatingFlag;

  return {
    ...r,
    attemptStatus: isTerminated ? 'Terminated' : r.attemptStatus,
    startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : new Date().toISOString(),
    submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : undefined,
    score: r.score !== null ? parseFloat(r.score) : 0,
    percentage: r.percentage !== null ? parseFloat(r.percentage) : 0
  };
}

export async function getAttemptAnswerReviewAdmin(testId: number, attemptId: number): Promise<AttemptAnswerReviewDto> {
  const attempt = await getAttemptByIdAdmin(attemptId);
  if (Number(attempt.testId) !== Number(testId)) {
    throw new ValidationError(`Attempt ID ${attemptId} does not belong to Test ID ${testId}`);
  }

  const testRes = await query(`SELECT total_marks FROM tests WHERE id = $1`, [testId]);
  const totalMarks = parseFloat(testRes.rows[0]?.total_marks) || 50.0;

  const qSql = `
    SELECT 
      q.id AS "questionId",
      q.question_number AS "questionNumber",
      q.question_text AS "questionText",
      q.option_a AS "optionA",
      q.option_b AS "optionB",
      q.option_c AS "optionC",
      q.option_d AS "optionD",
      COALESCE(NULLIF(q.correct_answer, ''), q.correct_option) AS "correctOption",
      q.marks,
      sa.selected_option AS "selectedOption"
    FROM questions q
    LEFT JOIN student_answers sa ON sa.question_id = q.id AND sa.attempt_id = $1
    WHERE q.test_id = $2
    ORDER BY q.question_number ASC, q.id ASC;
  `;

  const qRes = await query(qSql, [attemptId, testId]);

  let answeredCount = 0;
  let unansweredCount = 0;
  let correctCount = 0;
  let incorrectCount = 0;
  let calculatedMarks = 0.0;

  const questionItems: QuestionReviewItemDto[] = qRes.rows.map((r) => {
    const selected = (r.selectedOption || '').trim().toUpperCase();
    const correct = (r.correctOption || '').trim().toUpperCase();
    const isAnswered = selected !== '';
    const isCorrect = isAnswered && selected === correct;
    const questionMarks = parseFloat(r.marks) || 1.0;
    const awardedMarks = isCorrect ? questionMarks : 0.0;

    if (isAnswered) {
      answeredCount++;
      if (isCorrect) {
        correctCount++;
        calculatedMarks += awardedMarks;
      } else {
        incorrectCount++;
      }
    } else {
      unansweredCount++;
    }

    return {
      questionId: r.questionId,
      questionNumber: r.questionNumber,
      questionText: r.questionText,
      optionA: r.optionA,
      optionB: r.optionB,
      optionC: r.optionC,
      optionD: r.optionD,
      selectedOption: selected,
      correctOption: correct,
      isCorrect,
      isAnswered,
      marks: awardedMarks
    };
  });

  const percentage = totalMarks > 0 ? Math.round((calculatedMarks / totalMarks) * 10000) / 100 : 0.0;

  return {
    attemptId,
    testId,
    registrationNo: attempt.registrationNo,
    studentName: attempt.studentName,
    attemptStatus: attempt.attemptStatus,
    summary: {
      totalQuestions: questionItems.length,
      answeredCount,
      unansweredCount,
      correctCount,
      incorrectCount,
      calculatedMarks,
      maxMarks: totalMarks,
      percentage
    },
    questions: questionItems
  };
}
