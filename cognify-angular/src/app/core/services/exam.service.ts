import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { AttemptSessionService, StoredAttemptSession } from './attempt-session.service';
import {
  Student,
  StudentExamQuestion,
  StudentAttemptDetails,
  StudentProfile,
  Test
} from '../models/cognify.models';

export interface ActiveExamState {
  student: Student;
  attemptId: number;
  testId: number;
  testName: string;
  testNumber: string;
  durationMinutes: number;
  questions: StudentExamQuestion[];
  answers: { [questionId: number]: 'A' | 'B' | 'C' | 'D' | '' };
  currentQuestionIndex: number;
  remainingSeconds: number;
  violationCount: number;
  isLateAttempt: boolean;
  isSubmitted: boolean;
  isTerminated?: boolean;
  score?: number;
  percentage?: number;
  showReviewModal?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ExamService {
  activeExam = signal<ActiveExamState | null>(null);
  private timerInterval: any;
  private syncQueue: Map<number, 'A' | 'B' | 'C' | 'D' | ''> = new Map();
  private isSyncing = false;

  constructor(
    private api: ApiService,
    private attemptSession: AttemptSessionService
  ) {}

  async verifyStudent(regNo: string): Promise<{ success: boolean; student?: Student; message?: string }> {
    try {
      const res = await firstValueFrom(
        this.api.post<{ student: StudentProfile; studentToken?: string }>('/student/verify', { registrationNumber: regNo })
      );
      if (res && res.student) {
        if (res.studentToken) {
          this.attemptSession.saveStudentToken(res.studentToken);
        }
        return {
          success: true,
          student: {
            registration_no: res.student.registrationNumber,
            registrationNumber: res.student.registrationNumber,
            name: res.student.name,
            class_name: res.student.class as any,
            class: res.student.class
          }
        };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Registration Number not found in master roster.' };
    }
    return { success: false, message: 'Registration Number verification failed.' };
  }

  async getAvailableTests(regNo: string): Promise<Test[]> {
    try {
      return await firstValueFrom(this.api.get<Test[]>('/student/tests', { registrationNumber: regNo }));
    } catch (e) {
      return [];
    }
  }

  async recoverSession(session?: StoredAttemptSession | null): Promise<ActiveExamState | null> {
    const s = session || this.attemptSession.loadSession();
    if (!s || !s.attemptId || !s.attemptToken) {
      return null;
    }

    try {
      // 1. Fetch attempt details from server
      const attempt = await firstValueFrom(
        this.api.get<StudentAttemptDetails>(`/student/attempts/${s.attemptId}`)
      );

      // 2. Fetch questions from server
      const rawQuestions = await firstValueFrom(
        this.api.get<any[]>(`/student/attempts/${s.attemptId}/questions`)
      );

      const questions: StudentExamQuestion[] = (rawQuestions || []).map((q) => ({
        id: q.id,
        test_id: q.testId || s.testId,
        testId: q.testId || s.testId,
        question_number: q.questionNumber || q.question_number,
        questionNumber: q.questionNumber || q.question_number,
        question_text: q.questionText || q.question_text,
        questionText: q.questionText || q.question_text,
        option_a: q.optionA || q.option_a,
        optionA: q.optionA || q.option_a,
        option_b: q.optionB || q.option_b,
        optionB: q.optionB || q.option_b,
        option_c: q.optionC || q.option_c,
        optionC: q.optionC || q.option_c,
        option_d: q.optionD || q.option_d,
        optionD: q.optionD || q.option_d,
        marks: parseFloat(q.marks)
      }));

      // 3. Fetch saved answers from server
      const savedAnswersList = await firstValueFrom(
        this.api.get<{ answers: Array<{ questionId: number; selectedOption: string }> }>(
          `/student/attempts/${s.attemptId}/answers`
        )
      );

      const initialAnswers: { [qId: number]: 'A' | 'B' | 'C' | 'D' | '' } = {};
      questions.forEach((q) => (initialAnswers[q.id] = ''));
      if (savedAnswersList && savedAnswersList.answers) {
        savedAnswersList.answers.forEach((ans) => {
          initialAnswers[ans.questionId] = (ans.selectedOption as any) || '';
        });
      }

      // Calculate server-authoritative remaining seconds
      const deadlineMs = new Date(attempt.deadline).getTime();
      const serverNowMs = new Date(attempt.currentServerTime || Date.now()).getTime();
      const remainingSeconds = Math.max(0, Math.floor((deadlineMs - serverNowMs) / 1000));

      const isTerminated = attempt.attemptStatus === 'Terminated' || attempt.cheatingFlag;
      const isSubmitted = attempt.attemptStatus === 'Submitted' || isTerminated;

      const studentProfile: Student = s.student || {
        registration_no: s.registrationNo,
        name: s.studentName || 'Student',
        class_name: (s.className as any) || 'SY'
      };

      const newState: ActiveExamState = {
        student: studentProfile,
        attemptId: attempt.id,
        testId: attempt.testId,
        testName: s.testName || 'Cognify Online Examination',
        testNumber: s.testNumber || `Test ${attempt.testId}`,
        durationMinutes: Math.round(remainingSeconds / 60),
        questions,
        answers: initialAnswers,
        currentQuestionIndex: 0,
        remainingSeconds,
        violationCount: attempt.fullscreenViolationCount || 0,
        isLateAttempt: false,
        isSubmitted,
        isTerminated,
        showReviewModal: false
      };

      this.activeExam.set(newState);
      if (!isSubmitted) {
        this.startTimer();
      }
      return newState;
    } catch (e) {
      console.warn('Attempt session recovery failed:', e);
      this.attemptSession.clearSession();
      return null;
    }
  }

  async startExam(student: Student, testId: number = 3): Promise<ActiveExamState> {
    try {
      const startRes = await firstValueFrom(
        this.api.post<{ attempt: StudentAttemptDetails; attemptToken: string }>(
          `/student/tests/${testId}/start`,
          { registrationNumber: student.registration_no }
        )
      );

      const attempt = startRes.attempt;
      const token = startRes.attemptToken;

      const session: StoredAttemptSession = {
        attemptId: attempt.id,
        testId: attempt.testId,
        registrationNo: student.registration_no,
        studentName: student.name,
        className: student.class_name,
        student,
        attemptToken: token,
        startedAt: attempt.startedAt,
        deadline: attempt.deadline,
        status: attempt.attemptStatus
      };
      this.attemptSession.saveSession(session);

      return (await this.recoverSession(session))!;
    } catch (e: any) {
      throw new Error(e.message || 'Failed to start exam session');
    }
  }

  startTimer(): void {
    if (this.timerInterval) clearInterval(this.timerInterval);

    this.timerInterval = setInterval(() => {
      const current = this.activeExam();
      if (!current || current.isSubmitted) {
        clearInterval(this.timerInterval);
        return;
      }

      if (current.remainingSeconds <= 1) {
        this.submitExam('Timer Expiry');
      } else {
        this.activeExam.set({
          ...current,
          remainingSeconds: current.remainingSeconds - 1
        });
      }
    }, 1000);
  }

  selectOption(questionId: number, option: 'A' | 'B' | 'C' | 'D'): void {
    const current = this.activeExam();
    if (!current || current.isSubmitted) return;

    // 1. Update Angular local signal UI state immediately
    const newAnswers = { ...current.answers, [questionId]: option };
    this.activeExam.set({ ...current, answers: newAnswers });

    // 2. Queue write request to prevent race conditions
    this.syncQueue.set(questionId, option);
    this.processSyncQueue(current.attemptId);
  }

  private async processSyncQueue(attemptId: number): Promise<void> {
    if (this.isSyncing || this.syncQueue.size === 0) return;
    this.isSyncing = true;

    while (this.syncQueue.size > 0) {
      const [questionId, selectedOption] = Array.from(this.syncQueue.entries())[0];
      this.syncQueue.delete(questionId);

      try {
        await firstValueFrom(
          this.api.put(`/student/attempts/${attemptId}/answers/${questionId}`, { selectedOption })
        );
      } catch (e) {
        console.warn(`Failed to sync answer for question ${questionId}:`, e);
      }
    }

    this.isSyncing = false;
  }

  async logViolation(reason: string): Promise<number> {
    const current = this.activeExam();
    if (!current || current.isSubmitted) return current?.violationCount || 0;

    try {
      const res = await firstValueFrom(
        this.api.post<{ violationCount: number; terminated: boolean; cheating: boolean }>(
          `/student/attempts/${current.attemptId}/fullscreen-violation`,
          { event: reason }
        )
      );

      const newCount = res.violationCount;
      this.activeExam.set({ ...current, violationCount: newCount });

      if (res.terminated) {
        const submittedState: ActiveExamState = {
          ...current,
          violationCount: newCount,
          isSubmitted: true,
          isTerminated: true,
          showReviewModal: false
        };
        this.activeExam.set(submittedState);
        this.attemptSession.clearSession();
      }
      return newCount;
    } catch (e) {
      return current.violationCount;
    }
  }

  async submitExam(reason: string = 'User Submitted'): Promise<ActiveExamState | null> {
    if (this.timerInterval) clearInterval(this.timerInterval);
    const current = this.activeExam();
    if (!current) return null;

    // Flush any pending answer syncs before final submission
    if (this.syncQueue.size > 0) {
      await this.processSyncQueue(current.attemptId);
    }

    try {
      await firstValueFrom(
        this.api.post<{ success: boolean; status: string; submittedAt: string; message: string }>(
          `/student/attempts/${current.attemptId}/submit`
        )
      );

      const submittedState: ActiveExamState = {
        ...current,
        isSubmitted: true,
        showReviewModal: false
      };

      this.activeExam.set(submittedState);
      this.attemptSession.clearSession();
      return submittedState;
    } catch (e: any) {
      console.error('Exam submission failed:', e.message);
      return null;
    }
  }
}
