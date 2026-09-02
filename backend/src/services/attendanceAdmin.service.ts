import { query, pool } from '../db/pool';
import { createAuditLog } from './auditLog.service';
import { getAdminTestById, recalculateStudentScoresAndRanks } from './testAdmin.service';
import { getStudentByIdAdmin } from './studentAdmin.service';
import { ValidationError } from '../types/api.types';

export interface AttendanceAdminDto {
  id?: number;
  testId: number;
  studentId: string;
  registrationNo: string;
  studentName: string;
  rollNo?: string;
  className: string;
  status: 'Present' | 'Absent';
  updatedAt?: string;
  updatedBy?: string;
}

export async function getTestAttendanceAdmin(testId: number): Promise<AttendanceAdminDto[]> {
  await getAdminTestById(testId);

  const sql = `
    SELECT 
      st.registration_no AS "registrationNo",
      st.name AS "studentName",
      st.roll_no AS "rollNo",
      st.class_name AS "className",
      COALESCE(att.status, sa.attendance, 'Absent') AS status,
      att.id AS id,
      att.updated_at AS "updatedAt",
      att.updated_by AS "updatedBy"
    FROM students st
    LEFT JOIN attendance att ON att.registration_no = st.registration_no AND att.test_id = $1
    LEFT JOIN student_attempts sa ON sa.registration_no = st.registration_no AND sa.test_id = $1
    ORDER BY 
      CASE WHEN st.class_name = 'SY' THEN 1 WHEN st.class_name = 'TY' THEN 2 ELSE 3 END,
      st.roll_no ASC,
      st.registration_no ASC;
  `;

  const res = await query(sql, [testId]);
  return res.rows.map((r) => ({
    id: r.id || undefined,
    testId,
    studentId: r.registrationNo,
    registrationNo: r.registrationNo,
    studentName: r.studentName,
    rollNo: r.rollNo || '--',
    className: r.className || 'SY',
    status: r.status as 'Present' | 'Absent',
    updatedAt: r.updatedAt,
    updatedBy: r.updatedBy
  }));
}

export async function updateStudentAttendanceAdmin(
  testId: number,
  registrationNo: string,
  status: 'Present' | 'Absent'
): Promise<AttendanceAdminDto> {
  const newStatus = status === 'Present' ? 'Present' : 'Absent';
  const regNo = String(registrationNo).trim().toUpperCase();
  const student = await getStudentByIdAdmin(regNo);

  const sql = `
    INSERT INTO attendance (test_id, registration_no, status, updated_at, updated_by)
    VALUES ($1, $2, $3, CURRENT_TIMESTAMP, 'Admin')
    ON CONFLICT (test_id, registration_no)
    DO UPDATE SET 
      status = EXCLUDED.status,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = 'Admin'
    RETURNING id, test_id AS "testId", registration_no AS "registrationNo", status, updated_at AS "updatedAt", updated_by AS "updatedBy";
  `;

  const res = await query(sql, [testId, regNo, newStatus]);

  await query(
    `UPDATE student_attempts SET attendance = $1 WHERE test_id = $2 AND registration_no = $3`,
    [newStatus, testId, regNo]
  );

  await query(
    `UPDATE test_results SET attendance = $1 WHERE test_id = $2 AND registration_no = $3`,
    [newStatus, testId, regNo]
  );

  await createAuditLog({
    action: 'UPDATE_ATTENDANCE',
    entityType: 'attendance',
    entityId: res.rows[0].id,
    testId,
    registrationNo: regNo,
    details: `Admin set attendance for candidate ${regNo} to ${newStatus}`
  });

  await recalculateStudentScoresAndRanks(pool);

  return {
    id: res.rows[0].id,
    testId,
    studentId: regNo,
    registrationNo: regNo,
    studentName: student.name,
    className: student.className,
    status: newStatus,
    updatedAt: res.rows[0].updatedAt,
    updatedBy: res.rows[0].updatedBy
  };
}

export async function bulkUpdateAttendanceAdmin(
  testId: number,
  status: 'Present' | 'Absent'
): Promise<{ count: number; status: 'Present' | 'Absent' }> {
  const newStatus = status === 'Present' ? 'Present' : 'Absent';

  const res = await query(
    `INSERT INTO attendance (test_id, registration_no, status, updated_at, updated_by)
     SELECT $1, registration_no, $2, CURRENT_TIMESTAMP, 'Admin' FROM students
     ON CONFLICT (test_id, registration_no)
     DO UPDATE SET status = EXCLUDED.status, updated_at = CURRENT_TIMESTAMP, updated_by = 'Admin'
     RETURNING registration_no;`,
    [testId, newStatus]
  );

  await query(`UPDATE student_attempts SET attendance = $1 WHERE test_id = $2`, [newStatus, testId]);
  await query(`UPDATE test_results SET attendance = $1 WHERE test_id = $2`, [newStatus, testId]);

  await createAuditLog({
    action: 'BULK_UPDATE_ATTENDANCE',
    entityType: 'attendance',
    testId,
    details: `Admin bulk updated all candidate attendance for test ${testId} to ${newStatus}`
  });

  await recalculateStudentScoresAndRanks(pool);

  return { count: res.rows.length, status: newStatus };
}
