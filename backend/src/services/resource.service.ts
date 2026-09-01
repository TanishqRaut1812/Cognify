import { query } from '../db/pool';
import { ResourceDto } from '../types/read.types';

export async function getResources(
  classCode?: string,
  testId?: number,
  resourceType?: string
): Promise<ResourceDto[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (classCode) {
    params.push(classCode);
    conditions.push(`c.code = $${params.length}`);
  }

  if (testId) {
    params.push(testId);
    conditions.push(`r.test_id = $${params.length}`);
  }

  if (resourceType) {
    params.push(resourceType);
    conditions.push(`r.resource_type = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      r.id,
      r.test_id AS "testId",
      r.class_id AS "classId",
      c.code AS "className",
      r.resource_type AS "resourceType",
      r.title,
      r.visibility,
      r.created_at AS "createdAt"
    FROM resources r
    LEFT JOIN classes c ON r.class_id = c.id
    ${whereClause}
    ORDER BY r.created_at DESC, r.id DESC;
  `;

  const res = await query(sql, params);

  return res.rows.map((row) => ({
    id: row.id,
    testId: row.testId,
    classId: row.classId,
    className: row.className,
    resourceType: row.resourceType,
    title: row.title,
    visibility: row.visibility,
    createdAt: row.createdAt
  }));
}
