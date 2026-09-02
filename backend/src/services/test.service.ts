import { query } from '../db/pool';
import { TestMetadataDto } from '../types/read.types';
import { NotFoundError } from '../types/api.types';

export async function getTests(classCode?: string, status?: string): Promise<TestMetadataDto[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
    ${whereClause}
    ORDER BY t.id ASC;
  `;

  const res = await query(sql, params);

  return res.rows.map((row) => ({
    ...row,
    totalMarks: parseFloat(row.totalMarks) || 50,
    durationMinutes: row.durationMinutes || 60,
    isPublished: Boolean(row.isPublished),
    resultStatus: row.isPublished ? 'Published' : 'Unpublished'
  }));
}

export async function getTestById(testId: number): Promise<TestMetadataDto> {
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
