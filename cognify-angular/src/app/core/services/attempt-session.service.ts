import { Injectable, signal } from '@angular/core';
import { Student } from '../models/cognify.models';

export interface StoredAttemptSession {
  attemptId: number;
  testId: number;
  testName?: string;
  testNumber?: string;
  registrationNo: string;
  studentName?: string;
  className?: string;
  student?: Student;
  attemptToken: string;
  studentToken?: string;
  startedAt: string;
  deadline: string;
  status: 'In Progress' | 'Submitted' | 'Terminated';
}

const STORAGE_KEY = 'cognify_active_attempt_session';
const STUDENT_TOKEN_KEY = 'cognify_student_session_token';

@Injectable({
  providedIn: 'root'
})
export class AttemptSessionService {
  currentSession = signal<StoredAttemptSession | null>(this.loadSession());

  saveStudentToken(token: string): void {
    try {
      sessionStorage.setItem(STUDENT_TOKEN_KEY, token);
    } catch (e) {}
  }

  getStudentToken(): string | null {
    try {
      return sessionStorage.getItem(STUDENT_TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  saveSession(session: StoredAttemptSession): void {
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
      this.currentSession.set(session);
    } catch (e) {
      console.warn('Failed to save attempt session to sessionStorage', e);
    }
  }

  loadSession(): StoredAttemptSession | null {
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch (e) {
      console.warn('Failed to parse attempt session from sessionStorage', e);
    }
    return null;
  }

  clearSession(): void {
    try {
      sessionStorage.removeItem(STORAGE_KEY);
      this.currentSession.set(null);
    } catch (e) {}
  }

  getAttemptToken(): string | null {
    const session = this.currentSession();
    return session ? session.attemptToken : null;
  }
}
