import { Injectable } from '@angular/core';
import { SupabaseService } from './supabase.service';

export interface Student {
  id?: number;
  registration_number: string;
  roll_number: string;
  name: string;
  class_id?: number;
  class_name: 'SY' | 'TY' | 'Final Year';
}

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  constructor(private supabaseService: SupabaseService) {}

  async getStudentsByClass(className: string): Promise<Student[]> {
    const { data, error } = await this.supabaseService.supabase
      .from('students')
      .select('*')
      .eq('class_name', className)
      .order('roll_number', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  async getStudentByRegistrationNo(regNo: string): Promise<Student | null> {
    const { data, error } = await this.supabaseService.supabase
      .from('students')
      .select('*')
      .eq('registration_number', regNo)
      .single();

    if (error) return null;
    return data;
  }

  async addStudent(student: { name: string; registration_number: string; roll_number: string; class_name: string }): Promise<Student> {
    const { data, error } = await this.supabaseService.supabase
      .from('students')
      .insert({
        name: student.name.trim(),
        registration_number: student.registration_number.trim(),
        registration_no: student.registration_number.trim(),
        roll_number: student.roll_number.trim(),
        roll_no: student.roll_number.trim(),
        class_name: student.class_name
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }
}
