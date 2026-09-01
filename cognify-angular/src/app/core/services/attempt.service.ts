import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Attempt {
  id?: number;
  test_id: number;
  student_id?: number;
  registration_no: string;
  attempt_status: 'Not Started' | 'In Progress' | 'Submitted' | 'Terminated';
  attendance: 'Present' | 'Absent';
  fullscreen_violation_count: number;
  cheating_flag: number;
  score?: number;
  percentage?: number;
}

@Injectable({
  providedIn: 'root'
})
export class AttemptService {
  constructor(private supabaseService: SupabaseService) {}

  async getAttempt(testId: number, regNo: string): Promise<Attempt | null> {
    const { data, error } = await this.supabaseService.supabase
      .from('student_attempts')
      .select('*')
      .eq('test_id', testId)
      .eq('registration_no', regNo)
      .maybeSingle();

    if (error) return null;
    return data;
  }

  async saveAnswer(attemptId: number, questionId: number, selectedAnswer: string): Promise<void> {
    const { error } = await this.supabaseService.supabase
      .from('student_answers')
      .upsert({
        attempt_id: attemptId,
        question_id: questionId,
        selected_answer: selectedAnswer
      }, { onConflict: 'attempt_id,question_id' });

    if (error) throw error;
  }
}
