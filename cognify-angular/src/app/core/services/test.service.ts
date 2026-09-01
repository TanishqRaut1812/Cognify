import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Test {
  id: number;
  test_number: string;
  title: string;
  test_date: string;
  start_time: string;
  finish_time: string;
  duration_minutes: number;
  total_marks: number;
  status: 'Upcoming' | 'Current' | 'Completed';
  result_status: 'Unpublished' | 'Published';
  is_published: number;
}

@Injectable({
  providedIn: 'root'
})
export class TestService {
  constructor(private supabaseService: SupabaseService) {}

  async getAllTests(): Promise<Test[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('tests')
      .select('*')
      .order('test_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getCurrentTest(): Promise<Test | null> {
    const { data, error } = await this.supabaseService.supabase
      .from('tests')
      .select('*')
      .eq('status', 'Current')
      .order('test_date', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) return null;
    return data;
  }
}
