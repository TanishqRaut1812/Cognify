import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

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
  constructor(private api: ApiService) {}

  async getAttendanceForTest(testId: number): Promise<AttendanceRecord[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/admin/tests/${testId}/attendance`));
      if (res && Array.isArray(res)) {
        return res.map((r) => ({
          id: r.id,
          test_id: r.testId || testId,
          student_id: r.studentId,
          registration_no: r.registrationNo,
          status: r.status,
          updated_by: r.updatedBy || 'Admin'
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch attendance for test ${testId}:`, e);
    }
    return [];
  }
}
