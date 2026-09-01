import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { StudentExamQuestion } from '../models/cognify.models';

export interface StudentQuestion {
  id: number;
  test_id: number;
  question_number: number;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  marks: number;
}

@Injectable({
  providedIn: 'root'
})
export class QuestionService {
  constructor(private api: ApiService) {}

  async getQuestionsForStudent(testId: number): Promise<StudentQuestion[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/tests/${testId}/questions`));
      if (res && Array.isArray(res)) {
        return res.map((q) => ({
          id: q.id,
          test_id: q.testId || testId,
          question_number: q.questionNumber || q.question_number,
          question_text: q.questionText || q.question_text,
          option_a: q.optionA || q.option_a,
          option_b: q.optionB || q.option_b,
          option_c: q.optionC || q.option_c,
          option_d: q.optionD || q.option_d,
          marks: q.marks
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch questions for test ${testId}:`, e);
    }
    return [];
  }
}
