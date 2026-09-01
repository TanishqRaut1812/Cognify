import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface AttendanceRecord {
  id?: number;
  test_id: number;
  student_id?: number;
  registration_no: string;
  status: 'Present' | 'Absent';
  updated_by?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  constructor(private supabaseService: SupabaseService) {}

  async getAttendanceForTest(testId: number): Promise<AttendanceRecord[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('attendance')
      .select('*')
      .eq('test_id', testId);

    if (error) throw error;
    return data || [];
  }
}
