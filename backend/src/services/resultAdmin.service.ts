import { query } from '../db/pool';
import { createAuditLog } from './auditLog.service';
import { getAdminTestById } from './testAdmin.service';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface ResultAdminDto {
  id: number;
  testId: number;
  studentId?: number;
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
      tr.student_id AS "studentId",
      tr.registration_no AS "registrationNo",
      st.name AS "studentName",
      tr.attendance,
      tr.marks_obtained AS "marksObtained",
      tr.percentage,
      (tr.published = 1) AS published,
      tr.updated_at AS "updatedAt",
      tr.updated_by AS "updatedBy"
    FROM test_results tr
    LEFT JOIN students st ON tr.student_id = st.id OR tr.registration_no = st.registration_no
    WHERE tr.test_id = $1
    ORDER BY tr.registration_no ASC;
  `;

  const res = await query(sql, [testId]);
  return res.rows.map((r) => ({
    ...r,
    marksObtained: parseFloat(r.marksObtained),
    percentage: parseFloat(r.percentage)
  }));
}

export async function getResultByIdAdmin(id: number): Promise<ResultAdminDto> {
  const sql = `
    SELECT 
      tr.id,
      tr.test_id AS "testId",
      tr.student_id AS "studentId",
      tr.registration_no AS "registrationNo",
      st.name AS "studentName",
      tr.attendance,
      tr.marks_obtained AS "marksObtained",
      tr.percentage,
      (tr.published = 1) AS published,
      tr.updated_at AS "updatedAt",
      tr.updated_by AS "updatedBy"
    FROM test_results tr
    LEFT JOIN students st ON tr.student_id = st.id OR tr.registration_no = st.registration_no
    WHERE tr.id = $1;
  `;

  const res = await query(sql, [id]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Result with ID ${id} not found`);
  }
  return {
    ...res.rows[0],
    marksObtained: parseFloat(res.rows[0].marksObtained),
    percentage: parseFloat(res.rows[0].percentage)
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
      percentage = $2,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = 'Admin'
    WHERE id = $3
    RETURNING id;
  `;

  await query(sql, [marksObtained, newPercentage, resultId]);

  // Sync to student_attempts if attempt exists
  await query(
    `
    UPDATE student_attempts
    SET 
      score = $1,
      calculated_score = $1,
      percentage = $2,
      calculated_percentage = $2,
      updated_at = CURRENT_TIMESTAMP
    WHERE test_id = $3 AND (student_id = $4 OR registration_no = $5);
  `,
    [marksObtained, newPercentage, current.testId, current.studentId, current.registrationNo]
  );

  const updated = await getResultByIdAdmin(resultId);

  await createAuditLog({
    action: 'OVERRIDE_SCORE',
    entityType: 'test_result',
    entityId: resultId,
    testId: current.testId,
    registrationNo: current.registrationNo,
    previousValue: `${current.marksObtained} (${current.percentage}%)`,
    newValue: `${marksObtained} (${newPercentage}%)`,
    details: `Admin overridden score for ${current.registrationNo} to ${marksObtained}/${test.totalMarks}`
  });

  return updated;
}
