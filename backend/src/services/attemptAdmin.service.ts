import { query } from '../db/pool';
import { NotFoundError } from '../types/api.types';

export interface AttemptAdminDto {
  id: number;
  testId: number;
  testTitle?: string;
  studentId?: number;
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
      t.title AS "testTitle",
      sa.student_id AS "studentId",
      sa.registration_no AS "registrationNo",
      st.name AS "studentName",
      sa.started_at AS "startedAt",
      sa.submitted_at AS "submittedAt",
      sa.attempt_status AS "attemptStatus",
      sa.attendance,
      sa.fullscreen_violation_count AS "fullscreenViolationCount",
      sa.violation_count AS "violationCount",
      (sa.cheating_flag = 1) AS "cheatingFlag",
      sa.score,
      sa.percentage
    FROM student_attempts sa
    LEFT JOIN students st ON sa.student_id = st.id OR sa.registration_no = st.registration_no
    LEFT JOIN tests t ON sa.test_id = t.id
    WHERE sa.test_id = $1
    ORDER BY sa.started_at DESC, sa.id DESC;
  `;

  const res = await query(sql, [testId]);
  return res.rows.map((r) => ({
    ...r,
    score: r.score !== null ? parseFloat(r.score) : undefined,
    percentage: r.percentage !== null ? parseFloat(r.percentage) : undefined
  }));
}

export async function getAttemptByIdAdmin(attemptId: number): Promise<AttemptAdminDto> {
  const sql = `
    SELECT 
      sa.id,
      sa.test_id AS "testId",
      t.title AS "testTitle",
      sa.student_id AS "studentId",
      sa.registration_no AS "registrationNo",
      st.name AS "studentName",
      sa.started_at AS "startedAt",
      sa.submitted_at AS "submittedAt",
      sa.attempt_status AS "attemptStatus",
      sa.attendance,
      sa.fullscreen_violation_count AS "fullscreenViolationCount",
      sa.violation_count AS "violationCount",
      (sa.cheating_flag = 1) AS "cheatingFlag",
      sa.score,
      sa.percentage
    FROM student_attempts sa
    LEFT JOIN students st ON sa.student_id = st.id OR sa.registration_no = st.registration_no
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
    score: r.score !== null ? parseFloat(r.score) : undefined,
    percentage: r.percentage !== null ? parseFloat(r.percentage) : undefined
  };
}
