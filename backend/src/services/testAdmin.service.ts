import { query, transaction } from '../db/pool';
import { TestMetadataDto } from '../types/read.types';
import { createAuditLog } from './auditLog.service';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface CreateTestInput {
  testNumber: string;
  title: string;
  className: 'SY' | 'TY' | 'Final Year';
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
      COALESCE(NULLIF(t.title, ''), t.test_name) AS title,
      c.code AS "className",
      t.class_id AS "classId",
      t.test_date AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.duration_minutes AS "durationMinutes",
      t.total_marks AS "totalMarks",
      t.status,
      t.result_status AS "resultStatus",
      (t.is_published = 1) AS "isPublished",
      t.instructions,
      t.updated_at AS "updatedAt"
    FROM tests t
    LEFT JOIN classes c ON t.class_id = c.id
    ORDER BY t.test_date DESC, t.id DESC;
  `;
  const res = await query(sql);
  return res.rows;
}

export async function createTestAdmin(input: CreateTestInput): Promise<TestMetadataDto> {
  if (!input.testNumber || !input.title || !input.className || !input.totalMarks || input.totalMarks <= 0) {
    throw new ValidationError('Valid test number, title, class, and positive total marks are required');
  }

  // Check unique test_number
  const existing = await query(`SELECT id FROM tests WHERE test_number = $1;`, [input.testNumber]);
  if (existing.rows.length > 0) {
    throw new ValidationError(`Test Number '${input.testNumber}' already exists`);
  }

  const classRes = await query(`SELECT id FROM classes WHERE code = $1;`, [input.className]);
  const classId = classRes.rows[0]?.id || 1;

  const sql = `
    INSERT INTO tests (
      test_number, title, test_name, class_id, test_date, start_time, finish_time,
      duration_minutes, total_marks, status, result_status, is_published, instructions
    ) VALUES ($1, $2, $2, $3, $4, $5, $6, $7, $8, $9, 'Unpublished', 0, $10)
    RETURNING id;
  `;

  const res = await query(sql, [
    input.testNumber,
    input.title,
    classId,
    input.testDate || new Date().toISOString().split('T')[0],
    input.startTime || '10:00 AM',
    input.finishTime || '11:00 AM',
    input.durationMinutes || 60,
    input.totalMarks,
    input.status || 'Upcoming',
    input.instructions || ''
  ]);

  const newTestId = res.rows[0].id;

  await createAuditLog({
    action: 'CREATE_TEST',
    entityType: 'test',
    entityId: newTestId,
    testId: newTestId,
    details: `Created test ${input.title} (${input.testNumber}) for class ${input.className}`
  });

  return getAdminTestById(newTestId);
}

export async function getAdminTestById(testId: number): Promise<TestMetadataDto> {
  const sql = `
    SELECT 
      t.id,
      t.test_number AS "testNumber",
      COALESCE(NULLIF(t.title, ''), t.test_name) AS title,
      c.code AS "className",
      t.class_id AS "classId",
      t.test_date AS "testDate",
      t.start_time AS "startTime",
      t.finish_time AS "finishTime",
      t.duration_minutes AS "durationMinutes",
      t.total_marks AS "totalMarks",
      t.status,
      t.result_status AS "resultStatus",
      (t.is_published = 1) AS "isPublished",
      t.instructions,
      t.updated_at AS "updatedAt"
    FROM tests t
    LEFT JOIN classes c ON t.class_id = c.id
    WHERE t.id = $1;
  `;
  const res = await query(sql, [testId]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Test with ID ${testId} not found`);
  }
  return res.rows[0];
}

export async function updateTestAdmin(testId: number, input: Partial<CreateTestInput>): Promise<TestMetadataDto> {
  const current = await getAdminTestById(testId);

  if (input.testNumber && input.testNumber !== current.testNumber) {
    const existing = await query(`SELECT id FROM tests WHERE test_number = $1 AND id != $2;`, [input.testNumber, testId]);
    if (existing.rows.length > 0) {
      throw new ValidationError(`Test Number '${input.testNumber}' is already in use`);
    }
  }

  let classId = current.classId;
  if (input.className) {
    const classRes = await query(`SELECT id FROM classes WHERE code = $1;`, [input.className]);
    if (classRes.rows.length > 0) {
      classId = classRes.rows[0].id;
    }
  }

  const sql = `
    UPDATE tests
    SET 
      test_number = COALESCE($1, test_number),
      title = COALESCE($2, title),
      test_name = COALESCE($2, test_name),
      class_id = COALESCE($3, class_id),
      test_date = COALESCE($4, test_date),
      start_time = COALESCE($5, start_time),
      finish_time = COALESCE($6, finish_time),
      duration_minutes = COALESCE($7, duration_minutes),
      total_marks = COALESCE($8, total_marks),
      status = COALESCE($9, status),
      instructions = COALESCE($10, instructions),
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $11;
  `;

  await query(sql, [
    input.testNumber || null,
    input.title || null,
    classId || null,
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
    entityType: 'test',
    entityId: testId,
    testId,
    previousValue: JSON.stringify(current),
    newValue: JSON.stringify(updated)
  });

  return updated;
}

export async function deleteTestAdmin(testId: number): Promise<void> {
  const test = await getAdminTestById(testId);

  await transaction(async (client) => {
    await client.query(`DELETE FROM questions WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM test_results WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM student_attempts WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM attendance WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM resources WHERE test_id = $1;`, [testId]);
    await client.query(`DELETE FROM tests WHERE id = $1;`, [testId]);

    await createAuditLog(
      {
        action: 'DELETE_TEST',
        entityType: 'test',
        entityId: testId,
        testId,
        details: `Deleted test ${test.title} (${test.testNumber}) and associated records`
      },
      client
    );
  });
}

export async function completeTestAdmin(testId: number): Promise<TestMetadataDto> {
  await query(`UPDATE tests SET status = 'Completed', updated_at = CURRENT_TIMESTAMP WHERE id = $1;`, [testId]);

  await createAuditLog({
    action: 'COMPLETE_TEST',
    entityType: 'test',
    entityId: testId,
    testId,
    details: `Marked test ${testId} as COMPLETED`
  });

  return getAdminTestById(testId);
}

export async function publishResultsAdmin(testId: number): Promise<TestMetadataDto> {
  await query(
    `UPDATE tests SET result_status = 'Published', is_published = 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
    [testId]
  );
  await query(`UPDATE test_results SET published = 1, updated_at = CURRENT_TIMESTAMP WHERE test_id = $1;`, [testId]);

  await createAuditLog({
    action: 'PUBLISH_RESULTS',
    entityType: 'test',
    entityId: testId,
    testId,
    details: `Published test results for test ${testId}`
  });

  return getAdminTestById(testId);
}

export async function unpublishResultsAdmin(testId: number): Promise<TestMetadataDto> {
  await query(
    `UPDATE tests SET result_status = 'Unpublished', is_published = 0, updated_at = CURRENT_TIMESTAMP WHERE id = $1;`,
    [testId]
  );
  await query(`UPDATE test_results SET published = 0, updated_at = CURRENT_TIMESTAMP WHERE test_id = $1;`, [testId]);

  await createAuditLog({
    action: 'UNPUBLISH_RESULTS',
    entityType: 'test',
    entityId: testId,
    testId,
    details: `Unpublished test results for test ${testId}`
  });

  return getAdminTestById(testId);
}
