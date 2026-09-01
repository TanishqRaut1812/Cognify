import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface SyllabusItem {
  id: number;
  class_id?: number;
  test_id?: number;
  category_name: string;
  title: string;
  content: string;
  topics_json: string;
  display_order: number;
}

@Injectable({
  providedIn: 'root'
})
export class SyllabusService {
  constructor(private supabaseService: SupabaseService) {}

  async getSyllabusForTest(testId: number): Promise<SyllabusItem[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('syllabus')
      .select('*')
      .eq('test_id', testId)
      .order('display_order', { ascending: true });

    if (error) throw error;
    return data || [];
  }
}
