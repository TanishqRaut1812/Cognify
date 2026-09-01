import { Injectable } from '@angular/core';
import * as XLSX from 'xlsx';

export interface StudentRow {
  registration_no: string;
  roll_no: string;
  name: string;
}

export interface QuestionRow {
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
  marks: number;
}

export interface ResultRow {
  registration_no: string;
  roll_no: string;
  name: string;
  class_name: string;
  attendance: 'Present' | 'Absent';
  marks_obtained: number;
}

@Injectable({
  providedIn: 'root'
})
export class ExcelService {

  async parseExcel(file: File): Promise<any[]> {
    const arrayBuffer = await file.arrayBuffer();
    const workbook = XLSX.read(arrayBuffer, { type: 'array' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    return XLSX.utils.sheet_to_json(worksheet);
  }

  async validateAndParseStudents(file: File): Promise<{ valid: boolean; data: StudentRow[]; errors: string[] }> {
    const rows = await this.parseExcel(file);
    const errors: string[] = [];
    const data: StudentRow[] = [];

    rows.forEach((row, idx) => {
      const reg = row['Registration Number'] || row['registration_no'] || row['Reg No'] || '';
      const roll = row['Roll Number'] || row['roll_no'] || row['Roll No'] || '';
      const name = row['Name'] || row['name'] || row['Student Name'] || '';

      if (!reg || !roll || !name) {
        errors.push(`Row ${idx + 2}: Missing required fields (Registration Number, Roll Number, Name)`);
      } else {
        data.push({
          registration_no: String(reg).trim(),
          roll_no: String(roll).trim(),
          name: String(name).trim()
        });
      }
    });

    return { valid: errors.length === 0, data, errors };
  }

  async validateAndParseQuestions(file: File): Promise<{ valid: boolean; data: QuestionRow[]; errors: string[] }> {
    const rows = await this.parseExcel(file);
    const errors: string[] = [];
    const data: QuestionRow[] = [];

    rows.forEach((row, idx) => {
      const qNum = parseInt(row['Question Number'] || row['q_no'] || (idx + 1));
      const qText = row['Question Text'] || row['question'] || '';
      const optA = row['Option A'] || row['option_a'] || '';
      const optB = row['Option B'] || row['option_b'] || '';
      const optC = row['Option C'] || row['option_c'] || '';
      const optD = row['Option D'] || row['option_d'] || '';
      let correct = String(row['Correct Option'] || row['correct'] || '').trim().toUpperCase();
      const marks = parseFloat(row['Marks'] || row['marks'] || '1.0');

      if (!['A', 'B', 'C', 'D'].includes(correct)) {
        errors.push(`Row ${idx + 2}: Correct option must be A, B, C, or D`);
      }

      if (!qText || !optA || !optB || !optC || !optD) {
        errors.push(`Row ${idx + 2}: Missing question text or options`);
      }

      if (errors.length === 0) {
        data.push({
          question_number: qNum,
          question_text: String(qText).trim(),
          option_a: String(optA).trim(),
          option_b: String(optB).trim(),
          option_c: String(optC).trim(),
          option_d: String(optD).trim(),
          correct_option: correct as 'A' | 'B' | 'C' | 'D',
          marks: isNaN(marks) ? 1.0 : marks
        });
      }
    });

    return { valid: errors.length === 0, data, errors };
  }

  async validateAndParseResults(file: File): Promise<{ valid: boolean; data: ResultRow[]; errors: string[] }> {
    const rows = await this.parseExcel(file);
    const errors: string[] = [];
    const data: ResultRow[] = [];

    rows.forEach((row, idx) => {
      const reg = row['Registration Number'] || row['registration_no'] || '';
      const roll = row['Roll Number'] || row['roll_no'] || '';
      const name = row['Name'] || row['name'] || '';
      const className = row['Class'] || row['class_name'] || '';
      const att = String(row['Attendance'] || row['attendance'] || 'Present').trim();
      const score = parseFloat(row['Score'] || row['marks_obtained'] || '0');

      if (!reg) {
        errors.push(`Row ${idx + 2}: Missing Registration Number`);
      }

      data.push({
        registration_no: String(reg).trim(),
        roll_no: String(roll).trim(),
        name: String(name).trim(),
        class_name: String(className).trim(),
        attendance: att.toLowerCase() === 'present' ? 'Present' : 'Absent',
        marks_obtained: isNaN(score) ? 0 : score
      });
    });

    return { valid: errors.length === 0, data, errors };
  }
}
