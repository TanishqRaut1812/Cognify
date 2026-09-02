import { query } from '../db/pool';

export async function addSyllabusCategoryAdmin(
  testId: number,
  categoryName: string,
  topicsInput: string | string[],
  title?: string,
  content?: string,
  displayOrder: number = 0
): Promise<any> {
  let topics: string[] = [];
  if (Array.isArray(topicsInput)) {
    topics = topicsInput.map(t => String(t).trim()).filter(Boolean);
  } else if (typeof topicsInput === 'string') {
    topics = topicsInput
      .split(/[\n,]+/)
      .map(t => t.trim())
      .filter(Boolean);
  }

  const topicsJson = JSON.stringify(topics);

  const sql = `
    INSERT INTO syllabus (test_id, category_name, title, content, topics_json, display_order)
    VALUES ($1, $2, $3, $4, $5, $6)
    RETURNING 
      id,
      test_id AS "testId",
      category_name AS "categoryName",
      title,
      content,
      topics_json AS "topicsJson",
      display_order AS "displayOrder",
      created_at AS "createdAt";
  `;

  const res = await query(sql, [
    testId,
    categoryName.trim(),
    title ? title.trim() : categoryName.trim(),
    content ? content.trim() : '',
    topicsJson,
    displayOrder
  ]);

  return {
    ...res.rows[0],
    topics
  };
}

export async function deleteSyllabusCategoryAdmin(syllabusId: number): Promise<boolean> {
  const sql = `DELETE FROM syllabus WHERE id = $1 RETURNING id;`;
  const res = await query(sql, [syllabusId]);
  return res.rowCount !== null && res.rowCount > 0;
}

export async function updateSyllabusCategoryAdmin(
  syllabusId: number,
  categoryName?: string,
  topicsInput?: string | string[],
  displayOrder?: number
): Promise<any> {
  const fields: string[] = [];
  const params: any[] = [syllabusId];

  if (categoryName !== undefined) {
    params.push(categoryName.trim());
    fields.push(`category_name = $${params.length}`);
    fields.push(`title = $${params.length}`);
  }

  if (topicsInput !== undefined) {
    let topics: string[] = [];
    if (Array.isArray(topicsInput)) {
      topics = topicsInput.map(t => String(t).trim()).filter(Boolean);
    } else if (typeof topicsInput === 'string') {
      topics = topicsInput.split(/[\n,]+/).map(t => t.trim()).filter(Boolean);
    }
    params.push(JSON.stringify(topics));
    fields.push(`topics_json = $${params.length}`);
  }

  if (displayOrder !== undefined) {
    params.push(displayOrder);
    fields.push(`display_order = $${params.length}`);
  }

  fields.push(`updated_at = NOW()`);

  const sql = `
    UPDATE syllabus
    SET ${fields.join(', ')}
    WHERE id = $1
    RETURNING id, test_id AS "testId", category_name AS "categoryName", topics_json AS "topicsJson";
  `;

  const res = await query(sql, params);
  return res.rows[0];
}
