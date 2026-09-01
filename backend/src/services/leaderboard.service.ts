import { query } from '../db/pool';
import { LeaderboardEntryDto } from '../types/read.types';

export async function getLeaderboard(classCode: string = 'SY'): Promise<LeaderboardEntryDto[]> {
  // 1. Get class ID for classCode
  const classRes = await query(`SELECT id, code FROM classes WHERE code = $1;`, [classCode]);
  if (classRes.rows.length === 0) {
    return [];
  }
  const classId = classRes.rows[0].id;

  // 2. Fetch all published/completed tests for this class
  const testsRes = await query(`
    SELECT id, test_number AS "testNumber", total_marks AS "totalMarks"
    FROM tests
    WHERE (class_id = $1 OR class_id IS NULL)
      AND status = 'Completed'
      AND result_status = 'Published'
    ORDER BY id ASC;
  `, [classId]);

  const classTests = testsRes.rows.map((t) => ({
    id: t.id,
    testNumber: t.testNumber,
    totalMarks: parseFloat(t.totalMarks) || 1.0
  }));

  // 3. Fetch all registered students for this class
  const studentsRes = await query(`
    SELECT id, registration_no, name
    FROM students
    WHERE class_id = $1 OR class_name = $2
    ORDER BY registration_no ASC;
  `, [classId, classCode]);

  if (studentsRes.rows.length === 0) {
    return [];
  }

  // 4. Fetch test results / attempts for this class
  const resultsRes = await query(`
    SELECT 
      r.student_id,
      r.registration_no,
      r.test_id,
      r.marks_obtained,
      r.attendance
    FROM test_results r
    JOIN tests t ON r.test_id = t.id
    WHERE (t.class_id = $1 OR t.class_id IS NULL)
      AND t.status = 'Completed'
      AND t.result_status = 'Published';
  `, [classId]);

  // Index results by student registration_no and test_id
  const resultMap = new Map<string, { marksObtained: number; attendance: string }>();
  resultsRes.rows.forEach((r) => {
    const key = `${r.registration_no}_${r.test_id}`;
    resultMap.set(key, {
      marksObtained: parseFloat(r.marks_obtained) || 0.0,
      attendance: r.attendance || 'Absent'
    });
  });

  // If no published tests exist for this class, check student_scores cached table as fallback or return 0%
  const totalTestsCount = classTests.length;

  const calculatedEntries: Array<{
    registrationNo: string;
    name: string;
    overallPercentage: number;
    completedTestsCount: number;
  }> = [];

  studentsRes.rows.forEach((st) => {
    let sumPercentages = 0.0;
    let completedCount = 0;

    if (totalTestsCount > 0) {
      classTests.forEach((t) => {
        const resKey = `${st.registration_no}_${t.id}`;
        const record = resultMap.get(resKey);

        if (record && record.attendance === 'Present') {
          const testPct = (record.marksObtained / t.totalMarks) * 100.0;
          sumPercentages += Math.min(100.0, Math.max(0.0, testPct));
          completedCount++;
        } else {
          // Absent or missing attempt gets 0%
          sumPercentages += 0.0;
        }
      });
    }

    const overallPercentage = totalTestsCount > 0
      ? Math.round((sumPercentages / totalTestsCount) * 100) / 100
      : 0.0;

    calculatedEntries.push({
      registrationNo: st.registration_no,
      name: st.name,
      overallPercentage,
      completedTestsCount: completedCount
    });
  });

  // Sort descending by overallPercentage, then by registration_no
  calculatedEntries.sort((a, b) => {
    if (b.overallPercentage !== a.overallPercentage) {
      return b.overallPercentage - a.overallPercentage;
    }
    return a.registrationNo.localeCompare(b.registrationNo);
  });

  // Apply Competition Ranking (1, 2, 2, 4)
  const rankedEntries: LeaderboardEntryDto[] = [];
  let currentRank = 1;

  for (let i = 0; i < calculatedEntries.length; i++) {
    const entry = calculatedEntries[i];

    if (i > 0) {
      const prev = calculatedEntries[i - 1];
      if (entry.overallPercentage < prev.overallPercentage) {
        currentRank = i + 1; // 1-indexed competition ranking position
      }
    } else {
      currentRank = 1;
    }

    // Keep all entries with rank <= 10
    if (currentRank <= 10) {
      rankedEntries.push({
        rank: currentRank,
        registrationNo: entry.registrationNo,
        name: entry.name,
        className: classCode,
        overallPercentage: entry.overallPercentage,
        completedTestsCount: entry.completedTestsCount
      });
    }
  }

  return rankedEntries;
}
