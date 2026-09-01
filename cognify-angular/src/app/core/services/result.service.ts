import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface TestResult {
  id?: number;
  test_id: number;
  student_id?: number;
  registration_no: string;
  attendance: 'Present' | 'Absent';
  marks_obtained: number;
  percentage: number;
  published: number;
}

@Injectable({
  providedIn: 'root'
})
export class ResultService {
  constructor(private supabaseService: SupabaseService) {}

  async getPublishedResults(testId: number): Promise<TestResult[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('test_results')
      .select('*')
      .eq('test_id', testId)
      .eq('published', 1);

    if (error) throw error;
    return data || [];
  }

  async getStudentResult(testId: number, regNo: string): Promise<TestResult | null> {
    const { data, error } = await this.supabaseService.supabase
      .from('test_results')
      .select('*')
      .eq('test_id', testId)
      .eq('registration_no', regNo)
      .eq('published', 1)
      .maybeSingle();

    if (error) return null;
    return data;
  }
}
