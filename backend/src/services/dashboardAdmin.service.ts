import { query } from '../db/pool';

export interface AdminDashboardStatsDto {
  totalStudents: number;
  studentsByClass: {
    SY: number;
    TY: number;
    'Final Year': number;
  };
  totalTests: number;
  activeTests: number;
  completedTests: number;
  publishedTests: number;
  cheatingAttemptsCount: number;
  terminatedAttemptsCount: number;
}

export async function getAdminDashboardStats(): Promise<AdminDashboardStatsDto> {
  const studentsRes = await query(`
    SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE class_name = 'SY') AS sy_count,
      COUNT(*) FILTER (WHERE class_name = 'TY') AS ty_count,
      COUNT(*) FILTER (WHERE class_name = 'Final Year') AS fy_count
    FROM students;
  `);

  const testsRes = await query(`
    SELECT 
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE status = 'Current') AS active_count,
      COUNT(*) FILTER (WHERE status = 'Completed') AS completed_count,
      COUNT(*) FILTER (WHERE is_published = 1) AS published_count
    FROM tests;
  `);

  const attemptsRes = await query(`
    SELECT 
      COUNT(*) FILTER (WHERE cheating_flag = 1) AS cheating_count,
      COUNT(*) FILTER (WHERE attempt_status = 'Terminated') AS terminated_count
    FROM student_attempts;
  `);

  const sRow = studentsRes.rows[0] || {};
  const tRow = testsRes.rows[0] || {};
  const aRow = attemptsRes.rows[0] || {};

  return {
    totalStudents: parseInt(sRow.total || '0', 10),
    studentsByClass: {
      SY: parseInt(sRow.sy_count || '0', 10),
      TY: parseInt(sRow.ty_count || '0', 10),
      'Final Year': parseInt(sRow.fy_count || '0', 10)
    },
    totalTests: parseInt(tRow.total || '0', 10),
    activeTests: parseInt(tRow.active_count || '0', 10),
    completedTests: parseInt(tRow.completed_count || '0', 10),
    publishedTests: parseInt(tRow.published_count || '0', 10),
    cheatingAttemptsCount: parseInt(aRow.cheating_count || '0', 10),
    terminatedAttemptsCount: parseInt(aRow.terminated_count || '0', 10)
  };
}

export async function getTestDashboardStats(testId: number): Promise<any> {
  const attemptsRes = await query(
    `SELECT 
       COUNT(*) AS total_attempts,
       COUNT(*) FILTER (WHERE attempt_status = 'In Progress') AS in_progress,
       COUNT(*) FILTER (WHERE attempt_status = 'Submitted') AS submitted,
       COUNT(*) FILTER (WHERE attempt_status = 'Terminated') AS terminated,
       COUNT(*) FILTER (WHERE cheating_flag = 1) AS cheating_count
     FROM student_attempts
     WHERE test_id = $1;`,
    [testId]
  );

  const testRes = await query(
    `SELECT is_published, status FROM tests WHERE id = $1;`,
    [testId]
  );

  const aRow = attemptsRes.rows[0] || {};
  const tRow = testRes.rows[0] || {};

  return {
    testId,
    status: tRow.status || 'Upcoming',
    isPublished: Boolean(tRow.is_published),
    totalAttempts: parseInt(aRow.total_attempts || '0', 10),
    inProgressAttempts: parseInt(aRow.in_progress || '0', 10),
    submittedAttempts: parseInt(aRow.submitted || '0', 10),
    terminatedAttempts: parseInt(aRow.terminated || '0', 10),
    cheatingAttemptsCount: parseInt(aRow.cheating_count || '0', 10)
  };
}
