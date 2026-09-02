import { query, transaction } from '../db/pool';
import { NotFoundError, ValidationError } from '../types/api.types';
import { createAuditLog } from './auditLog.service';

export interface TestMetadataDto {
  id: number;
  testNumber: number;
  title: string;
  testDate: string;
  startTime: string;
  finishTime: string;
  totalMarks: number;
  durationMinutes: number;
  status: 'Upcoming' | 'Current' | 'Completed';
  isPublished: boolean;
  is_published?: number;
  questionCount?: number;
  attemptCount?: number;
}

export async function getAdminTests(): Promise<TestMetadataDto[]> {
  const sql = `
    SELECT 
      t.id,
      t.test_number AS "testNumber",
      t.test_name AS title,
      COALESCE(t.test_date, '2026-08-25') AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.total_marks AS "totalMarks",
      t.duration_minutes AS "durationMinutes",
      t.status,
      (t.is_published = 1) AS "isPublished",
      t.is_published,
      (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS "questionCount",
      (SELECT COUNT(*) FROM student_attempts sa WHERE sa.test_id = t.id) AS "attemptCount"
    FROM tests t
    ORDER BY t.id ASC;
  `;

  const res = await query(sql);
  return res.rows;
}

export async function getAdminTestById(id: number): Promise<TestMetadataDto> {
  const sql = `
    SELECT 
      t.id,
      t.test_number AS "testNumber",
      t.test_name AS title,
      COALESCE(t.test_date, '2026-08-25') AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.total_marks AS "totalMarks",
      t.duration_minutes AS "durationMinutes",
      t.status,
      (t.is_published = 1) AS "isPublished",
      t.is_published,
      (SELECT COUNT(*) FROM questions q WHERE q.test_id = t.id) AS "questionCount",
      (SELECT COUNT(*) FROM student_attempts sa WHERE sa.test_id = t.id) AS "attemptCount"
    FROM tests t
    WHERE t.id = $1;
  `;

  const res = await query(sql, [id]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Test ID ${id} not found`);
  }
  return res.rows[0];
}

export async function createTestAdmin(data: {
  testNumber: number;
  title: string;
  testDate?: string;
  startTime?: string;
  finishTime?: string;
  totalMarks?: number;
  durationMinutes?: number;
}): Promise<TestMetadataDto> {
  if (!data.testNumber || !data.title) {
    throw new ValidationError('Test number and title are required');
  }

  const sql = `
    INSERT INTO tests (test_number, test_name, test_date, start_time, finish_time, total_marks, duration_minutes, status, is_published)
    VALUES ($1, $2, COALESCE($3, '2026-08-25'), COALESCE($4, '10:00:00'), COALESCE($5, '11:00:00'), COALESCE($6, 50.0), COALESCE($7, 60), 'Upcoming', 0)
    RETURNING id;
  `;

  const res = await query(sql, [
    data.testNumber,
    data.title.trim(),
    data.testDate,
    data.startTime,
    data.finishTime,
    data.totalMarks,
    data.durationMinutes
  ]);

  const newId = res.rows[0].id;

  await createAuditLog({
    action: 'CREATE_TEST',
    testId: newId,
    newValue: `Created test #${data.testNumber} "${data.title}"`
  });

  return getAdminTestById(newId);
}

export async function updateTestAdmin(
  id: number,
  data: {
    testNumber?: number;
    title?: string;
    testDate?: string;
    startTime?: string;
    finishTime?: string;
    totalMarks?: number;
    durationMinutes?: number;
    status?: 'Upcoming' | 'Current' | 'Completed';
    isPublished?: boolean;
  }
): Promise<TestMetadataDto> {
  const current = await getAdminTestById(id);

  const testNumber = data.testNumber !== undefined ? data.testNumber : current.testNumber;
  const title = data.title !== undefined ? data.title.trim() : current.title;
  const testDate = data.testDate !== undefined ? data.testDate : current.testDate;
  const startTime = data.startTime !== undefined ? data.startTime : current.startTime;
  const finishTime = data.finishTime !== undefined ? data.finishTime : current.finishTime;
  const totalMarks = data.totalMarks !== undefined ? data.totalMarks : current.totalMarks;
  const durationMinutes = data.durationMinutes !== undefined ? data.durationMinutes : current.durationMinutes;
  const status = data.status !== undefined ? data.status : current.status;
  const isPublished = data.isPublished !== undefined ? (data.isPublished ? 1 : 0) : current.is_published;

  const sql = `
    UPDATE tests
    SET test_number = $1, test_name = $2, test_date = $3, start_time = $4, finish_time = $5,
        total_marks = $6, duration_minutes = $7, status = $8, is_published = $9
    WHERE id = $10;
  `;

  await query(sql, [
    testNumber,
    title,
    testDate,
    startTime,
    finishTime,
    totalMarks,
    durationMinutes,
    status,
    isPublished,
    id
  ]);

  await createAuditLog({
    action: 'UPDATE_TEST',
    testId: id,
    newValue: `Updated test #${testNumber} "${title}"`
  });

  return getAdminTestById(id);
}

export async function deleteTestAdmin(id: number): Promise<void> {
  await getAdminTestById(id);

  await transaction(async (client) => {
    await client.query('DELETE FROM student_answers WHERE attempt_id IN (SELECT id FROM student_attempts WHERE test_id = $1);', [id]);
    await client.query('DELETE FROM student_attempts WHERE test_id = $1;', [id]);
    await client.query('DELETE FROM test_results WHERE test_id = $1;', [id]);
    await client.query('DELETE FROM attendance WHERE test_id = $1;', [id]);
    await client.query('DELETE FROM questions WHERE test_id = $1;', [id]);
    await client.query('DELETE FROM tests WHERE id = $1;', [id]);

    await createAuditLog(
      {
        action: 'DELETE_TEST',
        testId: id,
        newValue: `Deleted test ID ${id} and all related questions, attempts, and results`
      },
      client
    );
  });
}

export async function completeTestAdmin(testId: number): Promise<TestMetadataDto> {
  await query(`UPDATE tests SET status = 'Completed' WHERE id = $1;`, [testId]);

  await createAuditLog({
    action: 'COMPLETE_TEST',
    testId,
    newValue: `Marked test ${testId} as COMPLETED`
  });

  return getAdminTestById(testId);
}

export async function recalculateStudentScoresAndRanks(client: any): Promise<void> {
  const sql = `
    SELECT 
      s.registration_no,
      s.class_name,
      COUNT(tr.id) FILTER (WHERE tr.attendance = 'Present' AND t.is_published = 1) AS completed_tests_count,
      COALESCE(ROUND(AVG(tr.percentage) FILTER (WHERE t.is_published = 1), 2), 0.0) AS cognify_score
    FROM students s
    LEFT JOIN test_results tr ON s.registration_no = tr.registration_no
    LEFT JOIN tests t ON tr.test_id = t.id AND t.is_published = 1
    GROUP BY s.registration_no, s.class_name, s.roll_no
    ORDER BY s.class_name ASC, 
             COALESCE(ROUND(AVG(tr.percentage) FILTER (WHERE t.is_published = 1), 2), 0.0) DESC,
             CASE WHEN s.roll_no ~ '^[0-9]+$' THEN s.roll_no::int ELSE 99999 END ASC, 
             s.roll_no ASC, 
             s.registration_no ASC;
  `;

  const res = await client.query(sql);

  const classGroups = new Map<string, any[]>();
  for (const row of res.rows) {
    const className = row.class_name || 'SY';
    if (!classGroups.has(className)) {
      classGroups.set(className, []);
    }
    classGroups.get(className)!.push({
      registrationNo: row.registration_no,
      className,
      completedTestsCount: parseInt(row.completed_tests_count, 10) || 0,
      cognifyScore: parseFloat(row.cognify_score) || 0.0
    });
  }

  const regArray: string[] = [];
  const scoreArray: number[] = [];
  const countArray: number[] = [];
  const rankArray: number[] = [];
  const classArray: string[] = [];

  for (const [className, rows] of classGroups.entries()) {
    let currentRank = 1;
    for (let i = 0; i < rows.length; i++) {
      const entry = rows[i];
      if (i === 0) {
        currentRank = 1;
      } else if (entry.cognifyScore < rows[i - 1].cognifyScore) {
        currentRank = i + 1;
      }

      regArray.push(entry.registrationNo);
      scoreArray.push(entry.cognifyScore);
      countArray.push(entry.completedTestsCount);
      rankArray.push(currentRank);
      classArray.push(className);
    }
  }

  if (regArray.length > 0) {
    await client.query(
      `INSERT INTO student_scores (registration_no, cognify_score, completed_tests_count, rank, class_name, last_updated)
       SELECT unnest($1::text[]), unnest($2::numeric[]), unnest($3::int[]), unnest($4::int[]), unnest($5::text[]), CURRENT_TIMESTAMP
       ON CONFLICT (registration_no) DO UPDATE
       SET cognify_score = EXCLUDED.cognify_score,
           completed_tests_count = EXCLUDED.completed_tests_count,
           rank = EXCLUDED.rank,
           class_name = EXCLUDED.class_name,
           last_updated = CURRENT_TIMESTAMP;`,
      [regArray, scoreArray, countArray, rankArray, classArray]
    );
  }
}

export async function publishResultsAdmin(testId: number): Promise<TestMetadataDto> {
  const test = await getAdminTestById(testId);

  await transaction(async (client) => {
    const studentsRes = await client.query(`SELECT registration_no, class_name FROM students ORDER BY registration_no;`);
    const students = studentsRes.rows;

    const existingResultsRes = await client.query(
      `SELECT registration_no, marks_obtained, percentage FROM test_results WHERE test_id = $1;`,
      [testId]
    );
    const existingResultsMap = new Map<string, { marksObtained: number; percentage: number }>();
    for (const r of existingResultsRes.rows) {
      existingResultsMap.set(r.registration_no, {
        marksObtained: parseFloat(r.marks_obtained),
        percentage: parseFloat(r.percentage)
      });
    }

    const overrideAuditRes = await client.query(
      `SELECT registration_no FROM audit_logs WHERE action = 'SCORE_OVERRIDE' AND test_id = $1;`,
      [testId]
    );
    const overriddenRegs = new Set<string>(overrideAuditRes.rows.map((r) => r.registration_no));

    const attRes = await client.query(
      `SELECT registration_no, status FROM attendance WHERE test_id = $1;`,
      [testId]
    );
    const attMap = new Map<string, string>();
    for (const a of attRes.rows) {
      attMap.set(a.registration_no, a.status);
    }

    const attemptsRes = await client.query(
      `SELECT registration_no, attempt_status, attendance, score, calculated_score 
       FROM student_attempts WHERE test_id = $1;`,
      [testId]
    );
    const attemptsMap = new Map<string, any>();
    for (const att of attemptsRes.rows) {
      attemptsMap.set(att.registration_no, att);
    }

    const regArray: string[] = [];
    const attArray: string[] = [];
    const marksArray: number[] = [];
    const pctArray: number[] = [];

    for (const student of students) {
      const regNo = student.registration_no;
      const attRecord = attemptsMap.get(regNo);
      const attendanceStatus = attMap.get(regNo) || (attRecord ? attRecord.attendance : 'Absent');

      let marksObtained = 0.0;
      let percentage = 0.0;
      let attendance = 'Absent';

      if (attendanceStatus === 'Present') {
        attendance = 'Present';

        if (overriddenRegs.has(regNo) && existingResultsMap.has(regNo)) {
          const overrideVal = existingResultsMap.get(regNo)!;
          marksObtained = overrideVal.marksObtained;
          percentage = overrideVal.percentage;
        } else if (attRecord) {
          const rawScore = attRecord.score !== null ? parseFloat(attRecord.score) : parseFloat(attRecord.calculated_score);
          marksObtained = !isNaN(rawScore) ? rawScore : 0.0;
          percentage = test.totalMarks > 0 ? Math.round((marksObtained / test.totalMarks) * 10000) / 100 : 0.0;
        } else if (existingResultsMap.has(regNo)) {
          marksObtained = existingResultsMap.get(regNo)!.marksObtained;
          percentage = existingResultsMap.get(regNo)!.percentage;
        }
      } else {
        attendance = 'Absent';
        marksObtained = 0.0;
        percentage = 0.0;
      }

      regArray.push(regNo);
      attArray.push(attendance);
      marksArray.push(marksObtained);
      pctArray.push(percentage);
    }

    if (regArray.length > 0) {
      await client.query(
        `INSERT INTO test_results (test_id, registration_no, attendance, marks_obtained, percentage)
         SELECT $1, unnest($2::text[]), unnest($3::text[]), unnest($4::numeric[]), unnest($5::numeric[])
         ON CONFLICT (test_id, registration_no) DO UPDATE
         SET attendance = EXCLUDED.attendance,
             marks_obtained = EXCLUDED.marks_obtained,
             percentage = EXCLUDED.percentage;`,
        [testId, regArray, attArray, marksArray, pctArray]
      );
    }

    await client.query(`UPDATE tests SET is_published = 1 WHERE id = $1;`, [testId]);

    await recalculateStudentScoresAndRanks(client);

    await createAuditLog(
      {
        action: 'PUBLISH_RESULTS',
        testId,
        newValue: `Published test results for test ${testId}`
      },
      client
    );
  });

  return getAdminTestById(testId);
}

export async function unpublishResultsAdmin(testId: number): Promise<TestMetadataDto> {
  await getAdminTestById(testId);

  await transaction(async (client) => {
    await client.query(`UPDATE tests SET is_published = 0 WHERE id = $1;`, [testId]);

    await recalculateStudentScoresAndRanks(client);

    await createAuditLog(
      {
        action: 'UNPUBLISH_RESULTS',
        testId,
        newValue: `Unpublished test results for test ${testId}`
      },
      client
    );
  });

  return getAdminTestById(testId);
}
