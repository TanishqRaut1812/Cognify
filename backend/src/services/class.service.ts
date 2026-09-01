import { query } from '../db/pool';
import { ClassDto } from '../types/read.types';

export async function getAllClasses(): Promise<ClassDto[]> {
  const sql = `
    SELECT id, name, code
    FROM classes
    ORDER BY id ASC;
  `;
  const result = await query<ClassDto>(sql);
  return result.rows;
}
