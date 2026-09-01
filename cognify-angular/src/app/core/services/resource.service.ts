import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Resource {
  id: number;
  test_id?: number;
  class_id?: number;
  resource_type: 'notes' | 'practice' | 'question_paper' | 'answer_key';
  title: string;
  storage_path: string;
  visibility: 'public' | 'completed_only' | 'admin_only';
}

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(private supabaseService: SupabaseService) {}

  async getPublicResources(testId: number): Promise<Resource[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('resources')
      .select('*')
      .eq('test_id', testId)
      .eq('visibility', 'public');

    if (error) throw error;
    return data || [];
  }
}
