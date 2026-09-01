import ExcelJS from 'exceljs';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { query, transaction } from '../db/pool';
import { s3Client } from './storage.service';
import { createAuditLog } from './auditLog.service';
import { NotFoundError, ValidationError } from '../types/api.types';

export interface StudentAdminDto {
  id: number;
  registrationNo: string;
  registrationNumber?: string;
  rollNo: string;
  rollNumber?: string;
  name: string;
  classId: number;
  className: string;
  createdAt?: string;
  updatedAt?: string;
}

export async function getStudentsAdmin(
  classCode?: string,
  search?: string
): Promise<StudentAdminDto[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (classCode) {
    params.push(classCode);
    conditions.push(`(c.code = $${params.length} OR s.class_name = $${params.length})`);
  }

  if (search) {
    params.push(`%${search}%`);
    conditions.push(
      `(s.name ILIKE $${params.length} OR s.registration_no ILIKE $${params.length} OR s.roll_no ILIKE $${params.length})`
    );
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      s.id,
      s.registration_no AS "registrationNo",
      s.registration_number AS "registrationNumber",
      s.roll_no AS "rollNo",
      s.roll_number AS "rollNumber",
      s.name,
      s.class_id AS "classId",
      s.class_name AS "className",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt"
    FROM students s
    LEFT JOIN classes c ON s.class_id = c.id
    ${whereClause}
    ORDER BY s.class_name ASC, s.registration_no ASC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

export async function getStudentByIdAdmin(id: number): Promise<StudentAdminDto> {
  const sql = `
    SELECT 
      s.id,
      s.registration_no AS "registrationNo",
      s.registration_number AS "registrationNumber",
      s.roll_no AS "rollNo",
      s.roll_number AS "rollNumber",
      s.name,
      s.class_id AS "classId",
      s.class_name AS "className",
      s.created_at AS "createdAt",
      s.updated_at AS "updatedAt"
    FROM students s
    WHERE s.id = $1;
  `;

  const res = await query(sql, [id]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Student with ID ${id} not found`);
  }
  return res.rows[0];
}

export async function createStudentAdmin(data: {
  registrationNo: string;
  rollNo?: string;
  name: string;
  className: 'SY' | 'TY' | 'Final Year';
}): Promise<StudentAdminDto> {
  if (!data.registrationNo || !data.name || !data.className) {
    throw new ValidationError('Registration number, name, and class are required');
  }

  const existing = await query(`SELECT id FROM students WHERE registration_no = $1;`, [data.registrationNo]);
  if (existing.rows.length > 0) {
    throw new ValidationError(`Student with Registration No '${data.registrationNo}' already exists`);
  }

  const classRes = await query(`SELECT id FROM classes WHERE code = $1;`, [data.className]);
  const classId = classRes.rows[0]?.id || 1;

  const sql = `
    INSERT INTO students (registration_no, registration_number, roll_no, roll_number, name, class_id, class_name)
    VALUES ($1, $1, $2, $2, $3, $4, $5)
    RETURNING 
      id,
      registration_no AS "registrationNo",
      roll_no AS "rollNo",
      name,
      class_id AS "classId",
      class_name AS "className";
  `;

  const res = await query(sql, [
    data.registrationNo,
    data.rollNo || '',
    data.name,
    classId,
    data.className
  ]);

  const newStudent = res.rows[0];
  await createAuditLog({
    action: 'CREATE_STUDENT',
    entityType: 'student',
    entityId: newStudent.id,
    registrationNo: newStudent.registrationNo,
    details: `Created student ${newStudent.name} (${newStudent.registrationNo}) in ${newStudent.className}`
  });

  return newStudent;
}

export async function updateStudentAdmin(
  id: number,
  data: {
    registrationNo?: string;
    rollNo?: string;
    name?: string;
    className?: string;
  }
): Promise<StudentAdminDto> {
  const current = await getStudentByIdAdmin(id);

  if (data.registrationNo && data.registrationNo !== current.registrationNo) {
    const existing = await query(`SELECT id FROM students WHERE registration_no = $1 AND id != $2;`, [
      data.registrationNo,
      id
    ]);
    if (existing.rows.length > 0) {
      throw new ValidationError(`Registration No '${data.registrationNo}' is already taken by another student`);
    }
  }

  const newRegNo = data.registrationNo || current.registrationNo;
  const newRollNo = data.rollNo !== undefined ? data.rollNo : current.rollNo;
  const newName = data.name || current.name;
  const newClassName = data.className || current.className;

  let classId = current.classId;
  if (data.className) {
    const classRes = await query(`SELECT id FROM classes WHERE code = $1;`, [data.className]);
    if (classRes.rows.length > 0) {
      classId = classRes.rows[0].id;
    }
  }

  const sql = `
    UPDATE students
    SET 
      registration_no = $1,
      registration_number = $1,
      roll_no = $2,
      roll_number = $2,
      name = $3,
      class_name = $4,
      class_id = $5,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $6
    RETURNING 
      id,
      registration_no AS "registrationNo",
      roll_no AS "rollNo",
      name,
      class_id AS "classId",
      class_name AS "className";
  `;

  const res = await query(sql, [newRegNo, newRollNo, newName, newClassName, classId, id]);
  const updated = res.rows[0];

  await createAuditLog({
    action: 'UPDATE_STUDENT',
    entityType: 'student',
    entityId: id,
    registrationNo: updated.registrationNo,
    previousValue: JSON.stringify(current),
    newValue: JSON.stringify(updated)
  });

  return updated;
}

export async function deleteStudentAdmin(id: number): Promise<void> {
  const student = await getStudentByIdAdmin(id);

  await query(`DELETE FROM students WHERE id = $1;`, [id]);

  await createAuditLog({
    action: 'DELETE_STUDENT',
    entityType: 'student',
    entityId: id,
    registrationNo: student.registrationNo,
    details: `Deleted student ${student.name} (${student.registrationNo})`
  });
}

export async function importStudentsFromExcel(
  fileBuffer: Buffer,
  originalFilename: string
): Promise<{
  totalRows: number;
  inserted: number;
  duplicates: number;
  invalid: number;
  storageKey?: string;
  errors: string[];
}> {
  const timestamp = Date.now();
  const s3Key = `student-lists/students_import_${timestamp}_${originalFilename.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

  try {
    await s3Client.send(
      new PutObjectCommand({
        Bucket: 'student-lists',
        Key: s3Key,
        Body: fileBuffer,
        ContentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      })
    );
  } catch (err: any) {
    console.warn(`S3 upload warning during student Excel import: ${err.message}`);
  }

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new ValidationError('Excel file contains no readable worksheets');
  }

  const headerRow = worksheet.getRow(1);
  const headers: string[] = [];
  headerRow.eachCell((cell, colNumber) => {
    headers[colNumber] = String(cell.value || '').trim().toLowerCase();
  });

  const regCol = headers.findIndex((h) => h && (h.includes('reg') || h.includes('registration')));
  const rollCol = headers.findIndex((h) => h && h.includes('roll'));
  const nameCol = headers.findIndex((h) => h && h.includes('name'));
  const classCol = headers.findIndex((h) => h && h.includes('class'));

  if (regCol === -1 || nameCol === -1) {
    throw new ValidationError('Excel missing required columns: Registration No and Name');
  }

  const rowsToInsert: Array<{ regNo: string; rollNo: string; name: string; className: string }> = [];
  const errors: string[] = [];
  const seenRegNos = new Set<string>();
  let duplicateCount = 0;
  let invalidCount = 0;

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;

    const regNo = String(row.getCell(regCol).value || '').trim();
    const rollNo = rollCol !== -1 ? String(row.getCell(rollCol).value || '').trim() : '';
    const name = String(row.getCell(nameCol).value || '').trim();
    let className = classCol !== -1 ? String(row.getCell(classCol).value || '').trim() : 'SY';

    if (!regNo || !name) {
      invalidCount++;
      errors.push(`Row ${rowNumber}: Missing registration number or name`);
      return;
    }

    if (seenRegNos.has(regNo.toUpperCase())) {
      duplicateCount++;
      errors.push(`Row ${rowNumber}: Duplicate registration number '${regNo}' in Excel file`);
      return;
    }
    seenRegNos.add(regNo.toUpperCase());

    if (className.toUpperCase().includes('TY') || className.toUpperCase().includes('THIRD')) {
      className = 'TY';
    } else if (className.toUpperCase().includes('FINAL')) {
      className = 'Final Year';
    } else {
      className = 'SY';
    }

    rowsToInsert.push({ regNo, rollNo, name, className });
  });

  let insertedCount = 0;

  await transaction(async (client) => {
    const classesRes = await client.query(`SELECT id, code FROM classes;`);
    const classIdMap = new Map<string, number>();
    classesRes.rows.forEach((c) => classIdMap.set(c.code, c.id));

    const existingRes = await client.query(`SELECT registration_no FROM students;`);
    const existingDbSet = new Set(existingRes.rows.map((r) => r.registration_no.toUpperCase()));

    for (const item of rowsToInsert) {
      if (existingDbSet.has(item.regNo.toUpperCase())) {
        duplicateCount++;
        errors.push(`Registration number '${item.regNo}' already exists in database`);
        continue;
      }

      const classId = classIdMap.get(item.className) || 1;

      await client.query(
        `
        INSERT INTO students (registration_no, registration_number, roll_no, roll_number, name, class_id, class_name)
        VALUES ($1, $1, $2, $2, $3, $4, $5);
      `,
        [item.regNo, item.rollNo, item.name, classId, item.className]
      );

      insertedCount++;
    }

    await createAuditLog(
      {
        action: 'EXCEL_IMPORT_STUDENTS',
        entityType: 'student',
        details: `Imported ${insertedCount} students from Excel file ${originalFilename}`
      },
      client
    );
  });

  return {
    totalRows: worksheet.rowCount - 1,
    inserted: insertedCount,
    duplicates: duplicateCount,
    invalid: invalidCount,
    storageKey: s3Key,
    errors
  };
}
