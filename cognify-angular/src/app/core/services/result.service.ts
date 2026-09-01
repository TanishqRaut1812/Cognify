import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { StudentResult } from '../models/cognify.models';

@Injectable({
  providedIn: 'root'
})
export class ResultService {
  constructor(private api: ApiService) {}

  async getStudentResults(registrationNumber: string): Promise<StudentResult[]> {
    try {
      const res = await firstValueFrom(
        this.api.get<any[]>('/student/results', { registrationNumber })
      );
      if (res && Array.isArray(res)) {
        return res.map((r) => ({
          test_id: r.testId,
          testId: r.testId,
          testTitle: r.testTitle,
          totalMarks: r.totalMarks,
          attendance: r.attendance,
          published: Boolean(r.published),
          marks_obtained: r.published ? r.marksObtained : null,
          marksObtained: r.published ? r.marksObtained : null,
          percentage: r.published ? r.percentage : null
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch student results for ${registrationNumber}:`, e);
    }
    return [];
  }

  async getStudentResultForTest(testId: number, regNo: string): Promise<StudentResult | null> {
    const results = await this.getStudentResults(regNo);
    return results.find((r) => (r.test_id === testId || r.testId === testId) && r.published) || null;
  }
}
