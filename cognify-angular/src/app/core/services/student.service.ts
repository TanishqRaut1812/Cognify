import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { Student } from '../models/cognify.models';

@Injectable({
  providedIn: 'root'
})
export class StudentService {
  constructor(private api: ApiService) {}

  async getStudentsByClass(className: string): Promise<Student[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>('/admin/students', { class: className }));
      if (res && Array.isArray(res)) {
        return res.map((s) => ({
          id: s.id,
          registration_no: s.registrationNo || s.registration_no,
          registrationNumber: s.registrationNo || s.registration_no,
          roll_no: s.rollNo || s.roll_no,
          rollNumber: s.rollNo || s.roll_no,
          name: s.name,
          class_name: s.className || s.class_name
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch students for class ${className}:`, e);
    }
    return [];
  }

  async getStudentByRegistrationNo(regNo: string): Promise<Student | null> {
    try {
      const res = await firstValueFrom(this.api.post<any>('/student/verify', { registrationNumber: regNo }));
      if (res && res.student) {
        return {
          id: res.student.id,
          registration_no: res.student.registrationNumber,
          registrationNumber: res.student.registrationNumber,
          name: res.student.name,
          class_name: res.student.class
        };
      }
    } catch (e) {}
    return null;
  }

  async addStudent(student: { name: string; registration_number: string; roll_number: string; class_name: string }): Promise<Student> {
    const res = await firstValueFrom(
      this.api.post<any>('/admin/students', {
        name: student.name.trim(),
        registrationNo: student.registration_number.trim(),
        rollNo: student.roll_number.trim(),
        className: student.class_name
      })
    );
    return {
      id: res.id,
      registration_no: res.registrationNo || res.registration_no,
      registrationNumber: res.registrationNo || res.registration_no,
      roll_no: res.rollNo || res.roll_no,
      rollNumber: res.rollNo || res.roll_no,
      name: res.name,
      class_name: res.className || res.class_name
    };
  }
}
