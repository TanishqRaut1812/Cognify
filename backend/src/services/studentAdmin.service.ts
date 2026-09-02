import { query } from '../db/pool';
import { NotFoundError, ValidationError } from '../types/api.types';
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
  await query('DELETE FROM students WHERE registration_no = $1', [regNo]);
}

export async function importStudentsFromExcel(fileBuffer: Buffer, filename: string): Promise<{ importedCount: number; message: string }> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(fileBuffer as any);
  const worksheet = workbook.worksheets[0];

  let count = 0;
  if (worksheet) {
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const regNo = row.getCell(1).text || String(row.getCell(1).value || '');
        const rollNo = row.getCell(2).text || String(row.getCell(2).value || '');
        const name = row.getCell(3).text || String(row.getCell(3).value || '');
        const className = row.getCell(4).text || String(row.getCell(4).value || 'SY');

        if (regNo && name) {
          createStudentAdmin({
            registrationNo: regNo,
            rollNo,
            name,
            className
          });
          count++;
        }
      }
    });
  }

  return { importedCount: count, message: `Successfully imported ${count} students` };
}

export { importStudentsFromExcel as importStudentsExcelAdmin };
