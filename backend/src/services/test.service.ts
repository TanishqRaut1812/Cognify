import { query } from '../db/pool';
import { TestMetadataDto } from '../types/read.types';
import { NotFoundError } from '../types/api.types';

function formatDateDisplay(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  const year = String(d.getUTCFullYear()).slice(-2);
  return `${day}/${month}/${year}`;
}

export async function getTests(classCode?: string, status?: string): Promise<TestMetadataDto[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (classCode) {
    params.push(classCode);
    conditions.push(`c.code = $${params.length}`);
  }

  if (status) {
    params.push(status);
    conditions.push(`t.status = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

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
    ${whereClause}
    ORDER BY t.test_date DESC, t.id DESC;
  `;

  const res = await query(sql, params);

  return res.rows.map((row) => ({
    ...row,
    formattedTestDate: formatDateDisplay(row.testDate)
  }));
}

export async function getTestById(testId: number): Promise<TestMetadataDto> {
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

  const row = res.rows[0];
  return {
    ...row,
    formattedTestDate: formatDateDisplay(row.testDate)
  };
}
