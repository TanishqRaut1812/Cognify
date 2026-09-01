import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

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
  constructor(private supabaseService: SupabaseService) {}

  async getQuestionsForStudent(testId: number): Promise<StudentQuestion[]> {
    // Queries student_questions view which omits correct_answer column
    const { data, error } = await this.supabaseService.supabase
      .from('student_questions')
      .select('*')
      .eq('test_id', testId)
      .order('question_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
