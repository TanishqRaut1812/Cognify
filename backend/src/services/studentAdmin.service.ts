import { query, transaction } from '../db/pool';
import { NotFoundError, ValidationError } from '../types/api.types';
import { createAuditLog } from './auditLog.service';
import ExcelJS from 'exceljs';

export interface StudentAdminDto {
  registrationNo: string;
  registrationNumber: string;
  rollNo: string;
  name: string;
  className: string;
}

export async function getStudentsAdmin(classCode?: string): Promise<StudentAdminDto[]> {
  const conditions: string[] = [];
  const params: any[] = [];

  if (classCode && classCode !== 'ALL') {
    params.push(classCode);
    conditions.push(`s.class_name = $${params.length}`);
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

  const sql = `
    SELECT 
      s.registration_no AS "registrationNo",
      s.registration_no AS "registrationNumber",
      s.roll_no AS "rollNo",
      s.name,
      s.class_name AS "className"
    FROM students s
    ${whereClause}
    ORDER BY s.class_name ASC, s.registration_no ASC;
  `;

  const res = await query(sql, params);
  return res.rows;
}

export async function getStudentByIdAdmin(id: string | number): Promise<StudentAdminDto> {
  const regNo = String(id).trim().toUpperCase();
  const sql = `
    SELECT 
      s.registration_no AS "registrationNo",
      s.registration_no AS "registrationNumber",
      s.roll_no AS "rollNo",
      s.name,
      s.class_name AS "className"
    FROM students s
    WHERE s.registration_no = $1;
  `;

  const res = await query(sql, [regNo]);
  if (res.rows.length === 0) {
    throw new NotFoundError(`Student '${regNo}' not found`);
  }
  return res.rows[0];
}

export async function createStudentAdmin(data: {
  registrationNo: string;
  rollNo: string;
  name: string;
  className: string;
}): Promise<StudentAdminDto> {
  if (!data.registrationNo || !data.name || !data.className) {
    throw new ValidationError('Registration number, name, and class name are required');
  }

  const regNo = data.registrationNo.trim().toUpperCase();
  const rollNo = (data.rollNo || '').trim();
  const name = data.name.trim();
  const className = data.className.trim();

  await query(
    `INSERT INTO students (registration_no, roll_no, name, class_name)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (registration_no) DO UPDATE 
     SET roll_no = EXCLUDED.roll_no, name = EXCLUDED.name, class_name = EXCLUDED.class_name`,
    [regNo, rollNo, name, className]
  );

  return { registrationNo: regNo, registrationNumber: regNo, rollNo, name, className };
}

export async function updateStudentAdmin(
  id: string | number,
  data: { rollNo?: string; name?: string; className?: string }
): Promise<StudentAdminDto> {
  const regNo = String(id).trim().toUpperCase();
  const current = await getStudentByIdAdmin(regNo);

  const rollNo = data.rollNo !== undefined ? data.rollNo.trim() : current.rollNo;
  const name = data.name !== undefined ? data.name.trim() : current.name;
  const className = data.className !== undefined ? data.className.trim() : current.className;

  await query(
    `UPDATE students
     SET roll_no = $1, name = $2, class_name = $3
     WHERE registration_no = $4`,
    [rollNo, name, className, regNo]
  );

  return { registrationNo: regNo, registrationNumber: regNo, rollNo, name, className };
}

export async function deleteStudentAdmin(id: string | number): Promise<void> {
  const regNo = String(id).trim().toUpperCase();
  const attemptsRes = await query('SELECT COUNT(*) FROM student_attempts WHERE registration_no = $1', [regNo]);
  const resultsRes = await query('SELECT COUNT(*) FROM test_results WHERE registration_no = $1', [regNo]);
  const historyCount = parseInt(attemptsRes.rows[0].count, 10) + parseInt(resultsRes.rows[0].count, 10);

  if (historyCount > 0) {
    throw new ValidationError(`Cannot delete student ${regNo}: ${historyCount} historical exam attempt/result record(s) exist for this student.`);
  }

  await query('DELETE FROM students WHERE registration_no = $1', [regNo]);
}

export async function importStudentsFromExcel(
  fileBuffer: Buffer,
  filename: string,
  targetClass: string = 'SY'
): Promise<{ importedCount: number; message: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);
  const worksheet = workbook.worksheets[0];

  if (!worksheet) {
    throw new ValidationError('Uploaded Excel sheet is empty or contains no worksheets');
  }

  // 1. Locate header row and map column indices
  let headerRowNumber = -1;
  let colReg = -1;
  let colRoll = -1;
  let colName = -1;
  let colClass = -1;

  worksheet.eachRow((row, rowNumber) => {
    if (headerRowNumber !== -1) return;
    const values = row.values as any[];
    if (!values || values.length === 0) return;

    values.forEach((cellVal, cIdx) => {
      if (!cellVal) return;
      const str = String(cellVal).trim().toLowerCase().replace(/[\s_\-\.#]/g, '');
      if (str.includes('reg') && colReg === -1) colReg = cIdx;
      else if (str.includes('roll') && colRoll === -1) colRoll = cIdx;
      else if (str.includes('name') && colName === -1) colName = cIdx;
      else if (str.includes('class') && colClass === -1) colClass = cIdx;
    });

    if (colReg !== -1 && colRoll !== -1 && colName !== -1) {
      headerRowNumber = rowNumber;
    }
  });

  // Fallback if strict header matching was incomplete
  if (headerRowNumber === -1) {
    worksheet.eachRow((row, rowNumber) => {
      if (headerRowNumber !== -1) return;
      const cells = row.values as any[];
      if (cells && cells.filter(Boolean).length >= 3) {
        headerRowNumber = rowNumber;
        if (colReg === -1) colReg = 1;
        if (colRoll === -1) colRoll = 2;
        if (colName === -1) colName = 3;
      }
    });
  }

  if (headerRowNumber === -1) {
    throw new ValidationError('Unable to locate header row in Excel file. Required columns: Registration Number, Roll Number, Name.');
  }

  const parsedStudents: { registrationNo: string; rollNo: string; name: string; className: string }[] = [];
  const errors: string[] = [];
  const seenRegs = new Set<string>();
  const seenRolls = new Set<string>();

  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber <= headerRowNumber) return;

    const values = row.values as any[];
    if (!values || values.every((v) => v === undefined || v === null || String(v).trim() === '')) {
      return;
    }

    const cellText = (cIdx: number) => {
      if (cIdx < 0 || cIdx >= values.length) return '';
      const v = values[cIdx];
      if (v === undefined || v === null) return '';
      if (typeof v === 'object' && v.text) return String(v.text).trim();
      if (typeof v === 'object' && v.result !== undefined) return String(v.result).trim();
      return String(v).trim();
    };

    let valReg = cellText(colReg);
    let valRoll = cellText(colRoll);
    let valName = cellText(colName);
    let valClass = colClass !== -1 ? cellText(colClass) : targetClass;

    // Robust Swap Safeguard:
    // Registration Number is typically longer alphanumeric (e.g., 2025BIT001, REG2026SY001).
    // Roll Number is typically a short numeric/alphanumeric code (e.g., 1, 2, 101).
    if (valReg && valRoll) {
      const regIsShortNum = valReg.length <= 4 && /^\d+$/.test(valReg);
      const rollIsLongReg = valRoll.length >= 6 && /[A-Za-z]/.test(valRoll);
      if (regIsShortNum && rollIsLongReg) {
        const tmp = valReg;
        valReg = valRoll;
        valRoll = tmp;
      }
    }

    const regNorm = valReg.toUpperCase();

    if (!regNorm) {
      errors.push(`Row ${rowNumber}: Missing Registration Number`);
      return;
    }
    if (!valRoll) {
      errors.push(`Row ${rowNumber}: Missing Roll Number`);
      return;
    }
    if (!valName) {
      errors.push(`Row ${rowNumber}: Missing Student Name`);
      return;
    }

    if (seenRegs.has(regNorm)) {
      errors.push(`Row ${rowNumber}: Duplicate Registration Number '${valReg}' in Excel file`);
      return;
    }
    seenRegs.add(regNorm);

    if (seenRolls.has(valRoll)) {
      errors.push(`Row ${rowNumber}: Duplicate Roll Number '${valRoll}' in Excel file`);
      return;
    }
    seenRolls.add(valRoll);

    parsedStudents.push({
      registrationNo: regNorm,
      rollNo: valRoll,
      name: valName,
      className: valClass || targetClass
    });
  });

  if (errors.length > 0) {
    throw new ValidationError(`Excel validation failed with ${errors.length} error(s): ${errors.slice(0, 5).join('; ')}`);
  }

  if (parsedStudents.length === 0) {
    throw new ValidationError('No valid student records discovered in uploaded Excel file');
  }

  // 2. Transactional Replacement Semantics
  await transaction(async (client) => {
    // Preserve historical students with exam attempts or test results
    const reservedRes = await client.query(
      `SELECT DISTINCT registration_no FROM student_attempts
       UNION
       SELECT DISTINCT registration_no FROM test_results`
    );
    const reservedRegs = reservedRes.rows.map((r) => r.registration_no);

    if (reservedRegs.length > 0) {
      await client.query(
        `DELETE FROM students WHERE class_name = $1 AND NOT (registration_no = ANY($2::text[]))`,
        [targetClass, reservedRegs]
      );
    } else {
      await client.query(
        `DELETE FROM students WHERE class_name = $1`,
        [targetClass]
      );
    }

    for (const s of parsedStudents) {
      await client.query(
        `INSERT INTO students (registration_no, roll_no, name, class_name)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (registration_no) DO UPDATE
         SET roll_no = EXCLUDED.roll_no,
             name = EXCLUDED.name,
             class_name = EXCLUDED.class_name`,
        [s.registrationNo, s.rollNo, s.name, s.className]
      );
    }

    await createAuditLog(
      {
        action: 'IMPORT_STUDENT_ROSTER',
        newValue: `Imported replacement student roster of ${parsedStudents.length} students for class ${targetClass}`
      },
      client
    );
  });

  return {
    importedCount: parsedStudents.length,
    message: `Successfully replaced master roster for ${targetClass} with ${parsedStudents.length} students`
  };
}

export { importStudentsFromExcel as importStudentsExcelAdmin };
