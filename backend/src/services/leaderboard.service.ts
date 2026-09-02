import { query } from '../db/pool';
import { LeaderboardEntryDto } from '../types/read.types';

export async function getLeaderboard(classCode: string = 'SY'): Promise<LeaderboardEntryDto[]> {
  const sql = `
    SELECT 
      ss.registration_no AS "registrationNumber",
      s.roll_no AS "rollNumber",
      s.name AS "studentName",
      s.class_name AS "className",
      COALESCE(ss.cognify_score, 0.0) AS "cognifyScore",
      COALESCE(ss.rank, 0) AS rank,
      COALESCE(ss.completed_tests_count, 0) AS "completedTestsCount"
    FROM students s
    LEFT JOIN student_scores ss ON s.registration_no = ss.registration_no
    WHERE s.class_name = $1
    ORDER BY ss.cognify_score DESC NULLS LAST, s.name ASC;
  `;

  const res = await query(sql, [classCode]);
  return res.rows.map((r, idx) => ({
    rank: r.rank || (idx + 1),
    registrationNo: r.registrationNumber,
    registrationNumber: r.registrationNumber,
    rollNo: r.rollNumber,
    rollNumber: r.rollNumber,
    name: r.studentName,
    studentName: r.studentName,
    className: r.className,
    cognifyScore: parseFloat(r.cognifyScore) || 0.0,
    overallPercentage: parseFloat(r.cognifyScore) || 0.0,
    completedTestsCount: r.completedTestsCount || 0
  }));
}

export async function getTopLeaderboard(): Promise<{ [key: string]: LeaderboardEntryDto[] }> {
  const classes = ['SY', 'TY', 'Final Year'];
  const result: { [key: string]: LeaderboardEntryDto[] } = {};

  for (const c of classes) {
    const list = await getLeaderboard(c);
    result[c] = list.slice(0, 10);
  }

  return result;
}
