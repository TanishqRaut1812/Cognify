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

  async recoverSession(session?: StoredAttemptSession | null, targetTestId?: number): Promise<ActiveExamState | null> {
    const s = session || this.attemptSession.loadSession();
    if (!s || !s.attemptId || !s.attemptToken) {
      this.attemptSession.clearSession();
      this.activeExam.set(null);
      return null;
    }

    // Validate matching testId if targetTestId is specified
    if (targetTestId && targetTestId > 0 && Number(s.testId) !== Number(targetTestId)) {
      console.info(`Stored session testId (${s.testId}) does not match targetTestId (${targetTestId}). Clearing stale session.`);
      this.attemptSession.clearSession();
      this.activeExam.set(null);
      return null;
    }

    try {
      // 1. Fetch server-authoritative attempt details using attemptId
      const attempt = await firstValueFrom(
        this.api.get<StudentAttemptDetails>(`/student/attempts/${s.attemptId}`)
      );

      // Validate server attempt testId matches session testId
      if (attempt.testId && s.testId && Number(attempt.testId) !== Number(s.testId)) {
        this.attemptSession.clearSession();
        this.activeExam.set(null);
        return null;
      }

      // Validate server registrationNo matches session registrationNo if present
      if (attempt.registrationNo && s.registrationNo && attempt.registrationNo.trim().toUpperCase() !== s.registrationNo.trim().toUpperCase()) {
        this.attemptSession.clearSession();
        this.activeExam.set(null);
        return null;
      }

      const isTerminated = attempt.attemptStatus === 'Terminated' || Boolean(attempt.cheatingFlag);
      const isSubmitted = attempt.attemptStatus === 'Submitted';

      // Rule 3: If attempt is SUBMITTED/COMPLETED on server, do not reopen exam workspace. Clear session.
      if (isSubmitted) {
        console.info(`Attempt ${s.attemptId} is already Submitted. Clearing session.`);
        this.attemptSession.clearSession();
        this.activeExam.set(null);
        return null;
      }

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
        marks: parseFloat(q.marks) || 1.0
      }));

      // 3. Fetch saved answers from server
      let initialAnswers: { [qId: number]: 'A' | 'B' | 'C' | 'D' | '' } = {};
      questions.forEach((q) => (initialAnswers[q.id] = ''));
      try {
        const savedAnswersList = await firstValueFrom(
          this.api.get<any>(`/student/attempts/${s.attemptId}/answers`)
        );
        const answersList = savedAnswersList?.answers || (savedAnswersList as any)?.data?.answers || (Array.isArray(savedAnswersList) ? savedAnswersList : []);
        if (Array.isArray(answersList)) {
          answersList.forEach((ans: any) => {
            if (ans.questionId && ans.selectedOption) {
              initialAnswers[ans.questionId] = ans.selectedOption as any;
            }
          });
        }
      } catch (ansErr) {
        console.warn('Failed to fetch saved answers during recovery:', ansErr);
      }

      // Calculate server-authoritative remaining seconds
      const deadlineMs = new Date(attempt.deadline).getTime();
      const serverNowMs = new Date(attempt.currentServerTime || Date.now()).getTime();
      const remainingSeconds = Math.max(0, Math.floor((deadlineMs - serverNowMs) / 1000));

      const studentProfile: Student = s.student || {
        registration_no: s.registrationNo || attempt.registrationNo,
        name: s.studentName || 'Student',
        class_name: (s.className as any) || 'SY'
      };

      const newState: ActiveExamState = {
        student: studentProfile,
        attemptId: attempt.id,
        testId: attempt.testId || s.testId,
        testName: s.testName || `Test ${attempt.testId}`,
        testNumber: s.testNumber || `Test ${attempt.testId}`,
        durationMinutes: Math.round(remainingSeconds / 60),
        questions,
        answers: initialAnswers,
        currentQuestionIndex: 0,
        remainingSeconds,
        violationCount: attempt.fullscreenViolationCount || 0,
        isLateAttempt: false,
        isSubmitted: isSubmitted || isTerminated,
        isTerminated,
        showReviewModal: false
      };

      this.activeExam.set(newState);
      if (!isSubmitted && !isTerminated) {
        this.startTimer();
      }
      return newState;
    } catch (e) {
      console.warn('Attempt session recovery failed:', e);
      this.attemptSession.clearSession();
      this.activeExam.set(null);
      return null;
    }
  }

  async getActiveTestId(): Promise<number> {
    try {
      const tests = await firstValueFrom(this.api.get<any[]>('/tests'));
      if (Array.isArray(tests) && tests.length > 0) {
        const current = tests.find((t: any) => t.status === 'Current');
        if (current) return current.id;
        return tests[0].id;
      }
    } catch (e) {
      console.warn('Failed to fetch active test list:', e);
    }
    return 1;
  }

  async startExam(student: Student, testId?: number): Promise<ActiveExamState> {
    try {
      let targetId = testId;
      if (!targetId || targetId <= 0) {
        targetId = await this.getActiveTestId();
      }

      // ALWAYS clear any previous session when starting a new exam flow!
      this.attemptSession.clearSession();
      this.activeExam.set(null);

      const regNo = student.registration_no || student.registrationNumber || '';

      const startRes = await firstValueFrom(
        this.api.post<any>(
          `/student/tests/${targetId}/start`,
          { registrationNumber: regNo }
        )
      );

      const attemptId = startRes.attemptId || (startRes.attempt && startRes.attempt.id);
      const token = startRes.attemptToken;
      const startedAt = startRes.startedAt || (startRes.attempt && startRes.attempt.startedAt) || new Date().toISOString();
      const deadline = startRes.deadline || (startRes.attempt && startRes.attempt.deadline);
      const status = startRes.attemptStatus || (startRes.attempt && startRes.attempt.attemptStatus) || 'In Progress';
      const testName = (startRes.test && startRes.test.title) || `Test ${targetId}`;
      const testNumber = (startRes.test && startRes.test.testNumber) || `Test ${targetId}`;

      const session: StoredAttemptSession = {
        attemptId,
        testId: targetId,
        registrationNo: regNo,
        studentName: student.name || 'Student',
        className: (student.class_name || student.class || 'SY') as any,
        student,
        attemptToken: token,
        testName,
        testNumber,
        startedAt,
        deadline,
        status
      };
      this.attemptSession.saveSession(session);

      return (await this.recoverSession(session, targetId))!;
    } catch (e: any) {
      this.attemptSession.clearSession();
      this.activeExam.set(null);
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
