import { query } from '../db/pool';
import { createAuditLog } from './auditLog.service';
import { getAdminTestById } from './testAdmin.service';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface ResultAdminDto {
  id: number;
  testId: number;
  registrationNo: string;
  studentName?: string;
  attendance: 'Present' | 'Absent';
  marksObtained: number;
  percentage: number;
  published: boolean;
  updatedAt?: string;
  updatedBy?: string;
}

export async function getTestResultsAdmin(testId: number): Promise<ResultAdminDto[]> {
  const sql = `
    SELECT 
      tr.id,
      tr.test_id AS "testId",
      tr.registration_no AS "registrationNo",
      st.name AS "studentName",
      tr.attendance,
      tr.marks_obtained AS "marksObtained",
      tr.percentage,
      (t.is_published = 1) AS published
    FROM test_results tr
    LEFT JOIN students st ON tr.registration_no = st.registration_no
    LEFT JOIN tests t ON tr.test_id = t.id
    WHERE tr.test_id = $1
    ORDER BY tr.registration_no ASC;
  `;

  const res = await query(sql, [testId]);
  return res.rows.map((r) => ({
    ...r,
    marksObtained: parseFloat(r.marksObtained) || 0,
    percentage: parseFloat(r.percentage) || 0
  }));
}

export async function getResultByIdAdmin(id: number): Promise<ResultAdminDto> {
  const sql = `
    SELECT 
      tr.id,
      tr.test_id AS "testId",
      tr.registration_no AS "registrationNo",
      st.name AS "studentName",
      tr.attendance,
      tr.marks_obtained AS "marksObtained",
      tr.percentage,
      (t.is_published = 1) AS published
    FROM test_results tr
    LEFT JOIN students st ON tr.registration_no = st.registration_no
    LEFT JOIN tests t ON tr.test_id = t.id
    WHERE tr.id = $1;
  `;

  const res = await query(sql, [id]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Result with ID ${id} not found`);
  }
  return {
    ...res.rows[0],
    marksObtained: parseFloat(res.rows[0].marksObtained) || 0,
    percentage: parseFloat(res.rows[0].percentage) || 0
  };
}

export async function overrideStudentScoreAdmin(
  resultId: number,
  marksObtained: number
): Promise<ResultAdminDto> {
  if (marksObtained < 0) {
    throw new ValidationError('Marks obtained cannot be negative');
  }

  const current = await getResultByIdAdmin(resultId);
  const test = await getAdminTestById(current.testId);

  // Recalculate percentage based on test total marks
  const newPercentage = Math.round((marksObtained / test.totalMarks) * 10000) / 100;

  const sql = `
    UPDATE test_results
    SET 
      marks_obtained = $1,
      percentage = $2
    WHERE id = $3
    RETURNING id;
  `;

  await query(sql, [marksObtained, newPercentage, resultId]);

  // Update corresponding attempt score/percentage if present
  await query(
    `UPDATE student_attempts 
     SET score = $1, calculated_score = $1, percentage = $2, calculated_percentage = $2
     WHERE test_id = $3 AND registration_no = $4;`,
    [marksObtained, newPercentage, current.testId, current.registrationNo]
  );

  await createAuditLog({
    action: 'SCORE_OVERRIDE',
    testId: current.testId,
    registrationNo: current.registrationNo,
    previousValue: `${current.marksObtained} (${current.percentage}%)`,
    newValue: `${marksObtained} (${newPercentage}%)`
  });

  return getResultByIdAdmin(resultId);
}
