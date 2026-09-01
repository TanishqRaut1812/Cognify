import { query } from '../db/pool';
import { createAuditLog } from './auditLog.service';
import { getAdminTestById } from './testAdmin.service';
import { getStudentByIdAdmin } from './studentAdmin.service';
import { ValidationError } from '../types/api.types';

export interface AttendanceAdminDto {
  id?: number;
  testId: number;
  studentId: number;
  registrationNo: string;
  studentName: string;
  className: string;
  status: 'Present' | 'Absent';
  updatedAt?: string;
  updatedBy?: string;
}

export async function getTestAttendanceAdmin(testId: number): Promise<AttendanceAdminDto[]> {
  const test = await getAdminTestById(testId);

  // Fetch all students for the test's class along with attendance records
  const sql = `
    SELECT 
      st.id AS "studentId",
      st.registration_no AS "registrationNo",
      st.name AS "studentName",
      st.class_name AS "className",
      COALESCE(att.status, 'Absent') AS status,
      att.id AS id,
      att.updated_at AS "updatedAt",
      att.updated_by AS "updatedBy"
    FROM students st
    LEFT JOIN attendance att ON att.student_id = st.id AND att.test_id = $1
    WHERE st.class_id = $2 OR st.class_name = $3
    ORDER BY st.registration_no ASC;
  `;

  const res = await query(sql, [testId, test.classId, test.className]);
  return res.rows.map((r) => ({
    id: r.id || undefined,
    testId,
    studentId: r.studentId,
    registrationNo: r.registrationNo,
    studentName: r.studentName,
    className: r.className,
    status: r.status as 'Present' | 'Absent',
    updatedAt: r.updatedAt,
    updatedBy: r.updatedBy
  }));
}

export async function updateStudentAttendanceAdmin(
  testId: number,
  studentId: number,
  status: 'Present' | 'Absent'
): Promise<AttendanceAdminDto> {
  const newStatus = status === 'Present' ? 'Present' : 'Absent';
  const student = await getStudentByIdAdmin(studentId);

  // Upsert attendance record using unique constraint (test_id, registration_no)
  const sql = `
    INSERT INTO attendance (test_id, student_id, registration_no, status, updated_at, updated_by)
    VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 'Admin')
    ON CONFLICT (test_id, registration_no)
    DO UPDATE SET 
      status = EXCLUDED.status,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = 'Admin'
    RETURNING id, test_id AS "testId", student_id AS "studentId", registration_no AS "registrationNo", status, updated_at AS "updatedAt", updated_by AS "updatedBy";
  `;

  const res = await query(sql, [testId, studentId, student.registrationNo, newStatus]);

  // Sync attendance into test_results if a result record exists for this student & test
  await query(
    `
    UPDATE test_results
    SET attendance = $1, updated_at = CURRENT_TIMESTAMP, updated_by = 'Admin'
    WHERE test_id = $2 AND (student_id = $3 OR registration_no = $4);
  `,
    [newStatus, testId, studentId, student.registrationNo]
  );

  await createAuditLog({
    action: 'UPDATE_ATTENDANCE',
    entityType: 'attendance',
    entityId: res.rows[0].id,
    testId,
    registrationNo: student.registrationNo,
    details: `Admin set attendance for student ${student.registrationNo} to ${newStatus}`
  });

  return {
    id: res.rows[0].id,
    testId,
    studentId,
    registrationNo: student.registrationNo,
    studentName: student.name,
    className: student.className,
    status: newStatus,
    updatedAt: res.rows[0].updatedAt,
    updatedBy: res.rows[0].updatedBy
  };
}
