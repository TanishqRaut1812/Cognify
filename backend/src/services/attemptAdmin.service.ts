import { query } from '../db/pool';
import { NotFoundError } from '../types/api.types';

export interface AttemptAdminDto {
  id: number;
  testId: number;
  testTitle?: string;
  registrationNo: string;
  studentName?: string;
  startedAt: string;
  submittedAt?: string;
  attemptStatus: 'Not Started' | 'In Progress' | 'Submitted' | 'Terminated';
  attendance: 'Present' | 'Absent';
  fullscreenViolationCount: number;
  violationCount: number;
  cheatingFlag: boolean;
  score?: number;
  percentage?: number;
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
  return res.rows.map((r) => ({
    ...r,
    startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : new Date().toISOString(),
    submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : undefined,
    score: r.score !== null ? parseFloat(r.score) : 0,
    percentage: r.percentage !== null ? parseFloat(r.percentage) : 0
  }));
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
    throw new NotFoundError(`Attempt with ID ${attemptId} not found`);
  }

  const r = res.rows[0];
  return {
    ...r,
    startedAt: r.startedAt ? new Date(r.startedAt).toISOString() : new Date().toISOString(),
    submittedAt: r.submittedAt ? new Date(r.submittedAt).toISOString() : undefined,
    score: r.score !== null ? parseFloat(r.score) : 0,
    percentage: r.percentage !== null ? parseFloat(r.percentage) : 0
  };
}
