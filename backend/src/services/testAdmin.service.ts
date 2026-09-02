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

export async function publishResultsAdmin(testId: number): Promise<TestMetadataDto> {
  await query(
    `UPDATE tests SET is_published = 1 WHERE id = $1;`,
    [testId]
  );

  await createAuditLog({
    action: 'PUBLISH_RESULTS',
    testId,
    newValue: `Published test results for test ${testId}`
  });

  return getAdminTestById(testId);
}

export async function unpublishResultsAdmin(testId: number): Promise<TestMetadataDto> {
  await query(
    `UPDATE tests SET is_published = 0 WHERE id = $1;`,
    [testId]
  );

  await createAuditLog({
    action: 'UNPUBLISH_RESULTS',
    testId,
    newValue: `Unpublished test results for test ${testId}`
  });

  return getAdminTestById(testId);
}
