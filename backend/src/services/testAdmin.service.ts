import { query, transaction } from '../db/pool';
import { TestMetadataDto } from '../types/read.types';
import { createAuditLog } from './auditLog.service';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface CreateTestInput {
  testNumber: string;
  title: string;
  className?: string;
  testDate: string;
  startTime?: string;
  finishTime?: string;
  durationMinutes: number;
  totalMarks: number;
  status?: 'Upcoming' | 'Current' | 'Completed';
  instructions?: string;
}

export async function getAdminTests(): Promise<TestMetadataDto[]> {
  const sql = `
    SELECT 
      t.id,
      t.test_number AS "testNumber",
      t.test_name AS title,
      'SY' AS "className",
      t.test_date AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.duration_minutes AS "durationMinutes",
      t.total_marks AS "totalMarks",
      t.status,
      (t.is_published = 1) AS "isPublished",
      CASE WHEN t.is_published = 1 THEN 'Published' ELSE 'Unpublished' END AS "resultStatus",
      t.instructions
    FROM tests t
    ORDER BY t.id ASC;
  `;
  const res = await query(sql);
  return res.rows.map((row) => ({
    ...row,
    totalMarks: parseFloat(row.totalMarks) || 50,
    durationMinutes: row.durationMinutes || 60,
    isPublished: Boolean(row.isPublished),
    resultStatus: row.isPublished ? 'Published' : 'Unpublished'
  }));
}

export async function createTestAdmin(input: CreateTestInput): Promise<TestMetadataDto> {
  if (!input.testNumber || !input.title || !input.totalMarks || input.totalMarks <= 0) {
    throw new ValidationError('Valid test number, title, and positive total marks are required');
  }

  // Check unique test_number
  const existing = await query(`SELECT id FROM tests WHERE test_number = $1;`, [input.testNumber]);
  if (existing.rows.length > 0) {
    throw new ValidationError(`Test Number '${input.testNumber}' already exists`);
  }

  const sql = `
    INSERT INTO tests (
      test_number, test_name, test_date, start_time, finish_time,
      duration_minutes, total_marks, status, is_published, instructions
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0, $9)
    RETURNING id;
  `;

  const res = await query(sql, [
    input.testNumber,
    input.title,
    input.testDate || new Date().toISOString().split('T')[0],
    input.startTime || '5:15 PM',
    input.finishTime || '6:15 PM',
    input.durationMinutes || 60,
    input.totalMarks,
    input.status || 'Upcoming',
    input.instructions || ''
  ]);

  const newTestId = res.rows[0].id;

  await createAuditLog({
    action: 'CREATE_TEST',
    testId: newTestId,
    newValue: `Created test ${input.title} (${input.testNumber})`
  });

  return getAdminTestById(newTestId);
}

export async function getAdminTestById(testId: number): Promise<TestMetadataDto> {
  const sql = `
    SELECT 
      t.id,
      t.test_number AS "testNumber",
      t.test_name AS title,
      'SY' AS "className",
      t.test_date AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.duration_minutes AS "durationMinutes",
      t.total_marks AS "totalMarks",
      t.status,
      (t.is_published = 1) AS "isPublished",
      CASE WHEN t.is_published = 1 THEN 'Published' ELSE 'Unpublished' END AS "resultStatus",
      t.instructions
    FROM tests t
    WHERE t.id = $1;
  `;
  const res = await query(sql, [testId]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Test with ID ${testId} not found`);
  }
  const row = res.rows[0];
  return {
    ...row,
    totalMarks: parseFloat(row.totalMarks) || 50,
    durationMinutes: row.durationMinutes || 60,
    isPublished: Boolean(row.isPublished),
    resultStatus: row.isPublished ? 'Published' : 'Unpublished'
  };
}

export async function updateTestAdmin(testId: number, input: Partial<CreateTestInput>): Promise<TestMetadataDto> {
  const current = await getAdminTestById(testId);

  if (input.testNumber && input.testNumber !== current.testNumber) {
    const existing = await query(`SELECT id FROM tests WHERE test_number = $1 AND id != $2;`, [input.testNumber, testId]);
    if (existing.rows.length > 0) {
      throw new ValidationError(`Test Number '${input.testNumber}' is already in use`);
    }
  }

  const sql = `
    UPDATE tests
    SET 
      test_number = COALESCE($1, test_number),
      test_name = COALESCE($2, test_name),
      test_date = COALESCE($3, test_date),
      start_time = COALESCE($4, start_time),
      finish_time = COALESCE($5, finish_time),
      duration_minutes = COALESCE($6, duration_minutes),
      total_marks = COALESCE($7, total_marks),
      status = COALESCE($8, status),
      instructions = COALESCE($9, instructions)
    WHERE id = $10;
  `;

  await query(sql, [
    input.testNumber || null,
    input.title || null,
    input.testDate || null,
    input.startTime || null,
    input.finishTime || null,
    input.durationMinutes || null,
    input.totalMarks || null,
    input.status || null,
    input.instructions !== undefined ? input.instructions : null,
    testId
  ]);

  const updated = await getAdminTestById(testId);

  await createAuditLog({
    action: 'UPDATE_TEST',
    testId,
    previousValue: JSON.stringify(current),
    newValue: JSON.stringify(updated)
  });

  return updated;
}

export async function deleteTestAdmin(testId: number): Promise<void> {
  const test = await getAdminTestById(testId);

  await transaction(async (client) => {
    await client.query(`DELETE FROM test_questions WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM resources WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM tests WHERE id = $1;`, [testId]);

    await createAuditLog(
      {
        action: 'DELETE_TEST',
        testId,
        newValue: `Deleted test ${test.title} (${test.testNumber}) and associated records`
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
  await query(`UPDATE test_results SET published = 1 WHERE test_id = $1;`, [testId]);

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
  await query(`UPDATE test_results SET published = 0 WHERE test_id = $1;`, [testId]);

  await createAuditLog({
    action: 'UNPUBLISH_RESULTS',
    testId,
    newValue: `Unpublished test results for test ${testId}`
  });

  return getAdminTestById(testId);
}
