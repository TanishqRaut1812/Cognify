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

    if (!rows || rows.length === 0) {
      return { valid: false, data: [], errors: ['Excel file contains no rows'] };
    }

    const rawKeys = Object.keys(rows[0] || {});
    const normalizeHeader = (h: string) =>
      String(h || '').trim().toLowerCase().replace(/_/g, ' ').replace(/\s+/g, ' ');

    const normalizedMap = new Map<string, string>();
    for (const key of rawKeys) {
      normalizedMap.set(normalizeHeader(key), key);
    }

    const findKey = (matchers: ((norm: string) => boolean)[]): string | undefined => {
      for (const [norm, raw] of normalizedMap.entries()) {
        if (matchers.some((m) => m(norm))) {
          return raw;
        }
      }
      return undefined;
    };

    const qTextKey = findKey([
      (k) => k === 'question text' || k === 'qtext' || k === 'question',
      (k) => (k.includes('question') || k.includes('qtext')) && !k.includes('number') && !k.includes('num') && !k.includes('no') && !k.includes('#')
    ]);

    const optAKey = findKey([
      (k) => k === 'option a' || k === 'opt a' || k === 'a',
      (k) => k.includes('option a') || k.includes('opt a')
    ]);

    const optBKey = findKey([
      (k) => k === 'option b' || k === 'opt b' || k === 'b',
      (k) => k.includes('option b') || k.includes('opt b')
    ]);

    const optCKey = findKey([
      (k) => k === 'option c' || k === 'opt c' || k === 'c',
      (k) => k.includes('option c') || k.includes('opt c')
    ]);

    const optDKey = findKey([
      (k) => k === 'option d' || k === 'opt d' || k === 'd',
      (k) => k.includes('option d') || k.includes('opt d')
    ]);

    const correctKey = findKey([
      (k) => k === 'correct option' || k === 'correct answer' || k === 'correct' || k === 'answer' || k === 'ans',
      (k) => k.includes('correct') || k.includes('answer')
    ]);

    const marksKey = findKey([
      (k) => k === 'marks' || k === 'mark',
      (k) => k.includes('mark')
    ]);

    const qNumKey = findKey([
      (k) => k === 'question number' || k === 'q no' || k === 'qno' || k === 'q num' || k === 'qnum',
      (k) => k.includes('question') && (k.includes('number') || k.includes('num') || k.includes('no') || k.includes('#'))
    ]);

    if (!qTextKey || !optAKey || !optBKey || !optCKey || !optDKey || !correctKey) {
      return {
        valid: false,
        data: [],
        errors: ['Excel missing required columns: Question, Option A, Option B, Option C, Option D, Correct Answer']
      };
    }

    rows.forEach((row, idx) => {
      const qNumRaw = qNumKey ? parseInt(String(row[qNumKey] || ''), 10) : NaN;
      const qNum = !isNaN(qNumRaw) ? qNumRaw : idx + 1;
      const qText = String(row[qTextKey] || '').trim();
      const optA = String(row[optAKey] || '').trim();
      const optB = String(row[optBKey] || '').trim();
      const optC = String(row[optCKey] || '').trim();
      const optD = String(row[optDKey] || '').trim();

      let correct = String(row[correctKey] || '').trim().toUpperCase();
      if (correct.length > 1) {
        const startMatch = correct.match(/^[A-D]\b/i) || correct.match(/^[A-D][\s.\-_)]/i);
        if (startMatch) {
          correct = startMatch[0][0].toUpperCase();
        } else {
          const optMatch = correct.match(/(?:OPTION|OPT)[\s_]*([A-D])\b/i) || correct.match(/\b([A-D])\b/i);
          if (optMatch) correct = optMatch[1].toUpperCase();
        }
      }

      const rawMarks = marksKey ? row[marksKey] : undefined;
      const parsedMarks = rawMarks !== undefined && rawMarks !== null && String(rawMarks).trim() !== '' ? parseFloat(String(rawMarks)) : 1.0;
      const marks = isNaN(parsedMarks) ? 1.0 : parsedMarks;

      let rowValid = true;

      if (!['A', 'B', 'C', 'D'].includes(correct)) {
        errors.push(`Row ${idx + 2}: Correct option must be A, B, C, or D`);
        rowValid = false;
      }

      if (!qText || !optA || !optB || !optC || !optD) {
        errors.push(`Row ${idx + 2}: Missing question text or options`);
        rowValid = false;
      }

      if (rowValid) {
        data.push({
          question_number: qNum,
          question_text: qText,
          option_a: optA,
          option_b: optB,
          option_c: optC,
          option_d: optD,
          correct_option: correct as 'A' | 'B' | 'C' | 'D',
          marks
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
