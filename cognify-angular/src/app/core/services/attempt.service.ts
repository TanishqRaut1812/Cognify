import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { StudentAttemptDetails } from '../models/cognify.models';

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
  constructor(private api: ApiService) {}

  async getAttemptDetails(attemptId: number): Promise<StudentAttemptDetails | null> {
    try {
      return await firstValueFrom(this.api.get<StudentAttemptDetails>(`/student/attempts/${attemptId}`));
    } catch (e) {
      return null;
    }
  }

  async saveAnswer(attemptId: number, questionId: number, selectedAnswer: string): Promise<void> {
    await firstValueFrom(
      this.api.put(`/student/attempts/${attemptId}/answers/${questionId}`, { selectedOption: selectedAnswer })
    );
  }
}
