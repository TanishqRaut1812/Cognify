import { query } from '../db/pool';
import { SyllabusDto } from '../types/read.types';

export async function getSyllabus(classCode?: string, testId?: number): Promise<SyllabusDto[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (classCode) {
    params.push(classCode);
    conditions.push(`c.code = $${params.length}`);
  }

  if (testId) {
    params.push(testId);
    conditions.push(`s.test_id = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      s.id,
      s.class_id AS "classId",
      c.code AS "className",
      s.test_id AS "testId",
      s.category_name AS "categoryName",
      s.title,
      s.content,
      s.topics_json,
      s.display_order AS "displayOrder"
    FROM syllabus s
    LEFT JOIN classes c ON s.class_id = c.id
    ${whereClause}
    ORDER BY s.display_order ASC, s.id ASC;
  `;

  const res = await query(sql, params);

  return res.rows.map((row) => {
    let topics: string[] = [];
    try {
      if (row.topics_json) {
        topics = typeof row.topics_json === 'string' ? JSON.parse(row.topics_json) : row.topics_json;
      }
    } catch (e) {
      topics = [];
    }

    return {
      id: row.id,
      classId: row.classId,
      className: row.className,
      testId: row.testId,
      categoryName: row.categoryName,
      title: row.title,
      content: row.content || '',
      topics,
      displayOrder: row.displayOrder
    };
  });
}
