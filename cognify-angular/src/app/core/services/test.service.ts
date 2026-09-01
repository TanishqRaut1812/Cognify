import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Test } from '../models/cognify.models';

@Injectable({
  providedIn: 'root'
})
export class TestService {
  constructor(private api: ApiService) {}

  async getAllTests(): Promise<Test[]> {
    try {
      const tests = await firstValueFrom(this.api.get<any[]>('/tests'));
      if (tests && Array.isArray(tests)) {
        return tests.map((t) => ({
          id: t.id,
          test_number: t.testNumber || t.test_number || `TEST-${t.id}`,
          testNumber: t.testNumber || t.test_number,
          title: t.title,
          test_name: t.title,
          test_date: t.testDate || t.test_date || '',
          start_time: t.startTime || t.start_time || '',
          finish_time: t.finishTime || t.finish_time || '',
          duration_minutes: t.durationMinutes || t.duration_minutes || 60,
          total_marks: t.totalMarks || t.total_marks || 100,
          status: t.status,
          result_status: t.resultStatus || (t.isPublished ? 'Published' : 'Unpublished'),
          is_published: t.isPublished || t.is_published ? 1 : 0,
          instructions: t.instructions || ''
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch tests from REST API:', e);
    }
    return [];
  }

  async getCurrentTest(): Promise<Test | null> {
    const tests = await this.getAllTests();
    return tests.find((t) => t.status === 'Current') || tests[0] || null;
  }
}
