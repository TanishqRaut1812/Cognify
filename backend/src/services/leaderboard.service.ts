import { query } from '../db/pool';
import { LeaderboardEntryDto } from '../types/read.types';

export async function getLeaderboard(classCode: string = 'SY'): Promise<LeaderboardEntryDto[]> {
  const sql = `
    SELECT 
      s.registration_no AS "registrationNumber",
      s.roll_no AS "rollNumber",
      s.name AS "studentName",
      s.class_name AS "className",
      COALESCE(ss.cognify_score, 0.0) AS "cognifyScore",
      COALESCE(ss.completed_tests_count, 0) AS "completedTestsCount"
    FROM students s
    LEFT JOIN student_scores ss ON s.registration_no = ss.registration_no
    WHERE s.class_name = $1
    ORDER BY COALESCE(ss.cognify_score, 0.0) DESC, 
             CASE WHEN s.roll_no ~ '^[0-9]+$' THEN s.roll_no::int ELSE 99999 END ASC, 
             s.roll_no ASC, 
             s.registration_no ASC;
  `;

  const res = await query(sql, [classCode]);
  const rows = res.rows.map((r) => ({
    registrationNo: r.registrationNumber,
    registrationNumber: r.registrationNumber,
    rollNo: r.rollNumber,
    rollNumber: r.rollNumber,
    name: r.studentName,
    studentName: r.studentName,
    className: r.className,
    cognifyScore: parseFloat(r.cognifyScore) || 0.0,
    overallPercentage: parseFloat(r.cognifyScore) || 0.0,
    completedTestsCount: parseInt(r.completedTestsCount, 10) || 0
  }));

  // Calculate Competition Ranks across the complete class before any truncation
  let currentRank = 1;
  const leaderboard: LeaderboardEntryDto[] = [];

  for (let i = 0; i < rows.length; i++) {
    const entry = rows[i];
    if (i === 0) {
      currentRank = 1;
    } else if (entry.cognifyScore < rows[i - 1].cognifyScore) {
      currentRank = i + 1; // Standard competition rank (skips ranks for tied scores)
    } // else equal score -> currentRank remains unchanged

    leaderboard.push({
      ...entry,
      rank: currentRank
    });
  }

  return leaderboard;
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
