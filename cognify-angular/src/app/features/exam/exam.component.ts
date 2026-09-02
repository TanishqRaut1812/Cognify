import { Component, HostListener, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ExamService, ActiveExamState } from '../../core/services/exam.service';
import { AttemptSessionService } from '../../core/services/attempt-session.service';
import { Student } from '../../core/models/cognify.models';
import { SubmissionReviewModalComponent } from './submission-review-modal.component';

@Component({
  selector: 'app-exam',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SubmissionReviewModalComponent],
  template: `
    <!-- 1. REGISTRATION VERIFICATION MODAL (Show only when no active attempt session) -->
    @if (!activeExamState()) {
      <div class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <h3 class="modal-title">Cognify Candidate Verification</h3>
              <p class="modal-subtitle">Enter your Registration Number to launch your examination</p>
            </div>
          </div>

          <div class="modal-body">
            <form (ngSubmit)="verifyAndStart()">
              <div class="form-group">
                <label>Registration Number</label>
                <input type="text" [(ngModel)]="regNoInput" name="regNoInput" placeholder="e.g. REG2026SY001 or REG2026TY005" required style="font-family: monospace;" autofocus>
              </div>

              @if (errorMessage()) {
                <div class="form-error">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  <span>{{ errorMessage() }}</span>
                </div>
              }

              <div class="modal-actions">
                <a routerLink="/" class="btn btn-secondary">Cancel</a>
                <button type="submit" class="btn btn-primary" [disabled]="isLoading()">
                  {{ isLoading() ? 'Launching...' : 'Verify Identity & Launch Exam' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- 2. ACTIVE EXAM WORKSPACE -->
    @if (activeExamState(); as exam) {
      @if (!exam.isSubmitted && !exam.isTerminated) {
        <!-- 2.5 FULLSCREEN WARNING MODAL -->
        @if (showFullscreenWarning()) {
          <div class="modal-overlay" style="z-index: 10000; background: rgba(0, 0, 0, 0.85); backdrop-filter: blur(8px);">
            <div class="modal-card" style="border: 2px solid var(--accent-rose); max-width: 500px; text-align: center;">
              <div style="width: 56px; height: 56px; border-radius: 50%; background: rgba(239, 68, 68, 0.15); color: var(--accent-rose); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              </div>
              <h3 style="font-size: 22px; color: var(--accent-rose); margin-bottom: 8px;">Anti-Cheat Warning: Fullscreen Exited!</h3>
              <p style="color: var(--text-primary); font-size: 14px; margin-bottom: 16px;">
                You have exited browser fullscreen mode.
                <br>
                <strong style="color: var(--accent-rose);">Violation {{ currentViolationCount() }} of 4 recorded.</strong>
              </p>
              <div style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.25); padding: 12px; border-radius: var(--radius-sm); font-size: 13px; color: var(--text-secondary); margin-bottom: 20px;">
                Cognify anti-cheat security policy: 4th fullscreen exit will immediately terminate your exam attempt and record a cheating violation.
              </div>
              <button type="button" class="btn btn-danger btn-lg" (click)="reenterFullscreen()" style="width: 100%; font-weight: 700;">
                Re-enter Fullscreen Mode
              </button>
            </div>
          </div>
        }

        <div class="exam-container">
          <div class="exam-top-bar">
            <div class="exam-brand">
              <span class="timeline-tag tag-current">{{ exam.testNumber }}</span>
              <h3 style="font-size: 16px;">{{ exam.testName }}</h3>
            </div>

            <div class="exam-timer-box" [class.warning-timer]="exam.remainingSeconds <= 300 && exam.remainingSeconds > 60" [class.critical-timer]="exam.remainingSeconds <= 60">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{{ formatTimer(exam.remainingSeconds) }}</span>
            </div>

            <div style="display: flex; gap: 8px; align-items: center;">
              <button type="button" class="btn btn-secondary btn-sm" (click)="requestBrowserFullscreen()">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>
                Fullscreen
              </button>
              <button type="button" class="btn btn-primary btn-sm" (click)="showReviewModal.set(true)">Review & Submit</button>
            </div>
          </div>

          <div class="container main-content" style="padding-top: 20px;">
            <div class="exam-body-grid">
              <!-- QUESTION CONTAINER -->
              @if (getCurrentQuestion(); as q) {
                <div class="card-box">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                    <span style="font-weight: 700; color: var(--accent-sky);">Question {{ exam.currentQuestionIndex + 1 }} of {{ exam.questions.length }}</span>
                    <span style="font-size: 13px; color: var(--accent-emerald); font-weight: 600;">+{{ q.marks }} Marks</span>
                  </div>

                  <h3 style="font-size: 18px; margin-bottom: 20px; line-height: 1.5;">{{ q.question_text || q.questionText }}</h3>

                  <div class="exam-options-list">
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'A'" (click)="selectOpt('A')">
                      <span class="opt-letter-pill">A</span>
                      <span>{{ q.option_a || q.optionA }}</span>
                    </div>
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'B'" (click)="selectOpt('B')">
                      <span class="opt-letter-pill">B</span>
                      <span>{{ q.option_b || q.optionB }}</span>
                    </div>
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'C'" (click)="selectOpt('C')">
                      <span class="opt-letter-pill">C</span>
                      <span>{{ q.option_c || q.optionC }}</span>
                    </div>
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'D'" (click)="selectOpt('D')">
                      <span class="opt-letter-pill">D</span>
                      <span>{{ q.option_d || q.optionD }}</span>
                    </div>
                  </div>

                  <div style="display: flex; justify-content: space-between; margin-top: 24px;">
                    <button type="button" class="btn btn-secondary btn-sm" [disabled]="exam.currentQuestionIndex === 0" (click)="prevQ()">Previous</button>
                    <button type="button" class="btn btn-primary btn-sm" [disabled]="exam.currentQuestionIndex === exam.questions.length - 1" (click)="nextQ()">Next Question</button>
                  </div>
                </div>
              }

              <!-- SIDEBAR NAVIGATOR -->
              <div class="card-box" style="height: fit-content;">
                <h4 style="font-size: 15px; margin-bottom: 14px;">Question Navigator</h4>
                <div class="question-navigator-grid">
                  @for (q of exam.questions; track q.id; let idx = $index) {
                    <button type="button" class="q-nav-btn"
                            [class.answered]="exam.answers[q.id] !== ''"
                            [class.current]="idx === exam.currentQuestionIndex"
                            (click)="jumpTo(idx)">
                      {{ idx + 1 }}
                    </button>
                  }
                </div>

                <div style="margin-top: 20px; font-size: 12px; display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="nav-legend-dot answered"></span>
                    <span style="color: var(--text-secondary);">Answered</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 8px;">
                    <span class="nav-legend-dot unanswered"></span>
                    <span style="color: var(--text-secondary);">Unanswered</span>
                  </div>
                  @if (exam.violationCount > 0) {
                    <div style="color: var(--accent-rose); font-weight: 700; margin-top: 8px;">
                      Anti-Cheat Warning: Exits {{ exam.violationCount }}/4
                    </div>
                  }
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- REVIEW SUBMISSION MODAL -->
        @if (showReviewModal()) {
          <app-submission-review-modal
            [questions]="exam.questions"
            [answers]="exam.answers"
            (closeModal)="showReviewModal.set(false)"
            (selectQuestion)="jumpTo($event)"
            (confirmSubmit)="finalSubmit()">
          </app-submission-review-modal>
        }
      } @else if (exam.isTerminated) {
        <!-- 3. CHEATING TERMINATED SCREEN -->
        <div class="container main-content">
          <div class="card-box" style="text-align: center; max-width: 600px; margin: 40px auto; border: 2px solid var(--accent-rose);">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(244, 63, 94, 0.15); color: var(--accent-rose); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
            </div>
            <h2 style="font-size: 24px; color: var(--accent-rose);">Test Terminated for Cheating</h2>
            <p style="color: var(--text-secondary); margin-top: 8px;">
              Your attempt for <strong>{{ exam.testName }}</strong> was automatically terminated by the server due to excessive browser fullscreen exits (>3 violations).
            </p>

            <div style="background: rgba(244, 63, 94, 0.1); padding: 16px; border-radius: var(--radius-md); margin: 24px 0; font-size: 13px; color: var(--accent-rose); font-weight: 600;">
              This event has been logged to the administration audit trail. Further answer modifications and normal submissions are permanently disabled.
            </div>

            <a routerLink="/" class="btn btn-secondary">Return to Home</a>
          </div>
        </div>
      } @else {
        <!-- 4. SUBMITTED SUCCESS SCREEN -->
        <div class="container main-content">
          <div class="card-box" style="text-align: center; max-width: 600px; margin: 40px auto;">
            <div style="width: 64px; height: 64px; border-radius: 50%; background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
              <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <h2 style="font-size: 24px;">Test Submitted Successfully</h2>
            <p style="color: var(--text-secondary); margin-top: 8px;">
              Your answers have been recorded for <strong>{{ exam.testName }}</strong>.
            </p>

            <div style="background: rgba(0,0,0,0.3); padding: 20px; border-radius: var(--radius-md); margin: 24px 0; font-size: 14px; color: var(--text-secondary);">
              Per Cognify security policy, scores, percentages, and official answer keys will become visible on your student dashboard once results are published by the administration.
            </div>

            <a routerLink="/" class="btn btn-primary">Return to Home</a>
          </div>
        </div>
      }
    }
  `
})
export class ExamComponent implements OnInit {
  private examService = inject(ExamService);
  private attemptSession = inject(AttemptSessionService);
  private route = inject(ActivatedRoute);

  regNoInput = '';
  errorMessage = signal('');
  isLoading = signal(false);
  showReviewModal = signal(false);
  showFullscreenWarning = signal(false);
  currentViolationCount = signal(0);
  activeExamState = this.examService.activeExam;
  targetTestId = 0;
  private lastViolationTime = 0;
  private wasInFullscreen = false;

  async ngOnInit(): Promise<void> {
    const idParam = this.route.snapshot.queryParamMap.get('testId');
    if (idParam) {
      const parsed = parseInt(idParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        this.targetTestId = parsed;
      }
    }

    // Attempt automatic session recovery on page load / refresh ONLY if session matches targetTestId
    const session = this.attemptSession.loadSession();
    if (session) {
      if (this.targetTestId > 0 && Number(session.testId) !== Number(this.targetTestId)) {
        console.info(`Clearing session for test ${session.testId} because target URL testId is ${this.targetTestId}`);
        this.attemptSession.clearSession();
        this.examService.activeExam.set(null);
        return;
      }

      this.isLoading.set(true);
      const recovered = await this.examService.recoverSession(session, this.targetTestId);
      if (!recovered) {
        this.attemptSession.clearSession();
        this.examService.activeExam.set(null);
      }
      this.isLoading.set(false);
    }
  }

  @HostListener('document:fullscreenchange')
  @HostListener('document:webkitfullscreenchange')
  async onFullscreenChange(): Promise<void> {
    const isFullscreen = Boolean(
      document.fullscreenElement || (document as any).webkitFullscreenElement
    );

    const current = this.activeExamState();

    if (isFullscreen) {
      this.wasInFullscreen = true;
      this.showFullscreenWarning.set(false);
      return;
    }

    // Trigger violation ONLY if candidate was in fullscreen and exited while attempt is active
    if (!isFullscreen && this.wasInFullscreen && current && !current.isSubmitted && !current.isTerminated) {
      this.wasInFullscreen = false;
      const now = Date.now();
      if (now - this.lastViolationTime < 1500) return;
      this.lastViolationTime = now;

      const cnt = await this.examService.logViolation('Browser Fullscreen Exit');
      this.currentViolationCount.set(cnt);

      if (cnt < 4) {
        this.showFullscreenWarning.set(true);
      }
    }
  }

  async reenterFullscreen(): Promise<void> {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      } else if ((document.documentElement as any).webkitRequestFullscreen) {
        await (document.documentElement as any).webkitRequestFullscreen();
      }
      this.wasInFullscreen = true;
      this.showFullscreenWarning.set(false);
    } catch (e) {
      console.warn('Re-entering fullscreen failed:', e);
    }
  }

  requestBrowserFullscreen(): void {
    this.reenterFullscreen();
  }

  async verifyAndStart(): Promise<void> {
    this.errorMessage.set('');
    if (!this.regNoInput.trim()) {
      this.errorMessage.set('Please enter a Registration Number.');
      return;
    }

    this.isLoading.set(true);
    const res = await this.examService.verifyStudent(this.regNoInput);
    if (res.success && res.student) {
      try {
        await this.examService.startExam(res.student, this.targetTestId);
        await this.reenterFullscreen();
      } catch (e: any) {
        this.errorMessage.set(e.message || 'Failed to start exam.');
      }
    } else {
      this.errorMessage.set(res.message || 'Invalid registration number.');
    }
    this.isLoading.set(false);
  }

  getCurrentQuestion() {
    const s = this.activeExamState();
    if (!s) return null;
    return s.questions[s.currentQuestionIndex] || null;
  }

  selectOpt(opt: 'A' | 'B' | 'C' | 'D'): void {
    const q = this.getCurrentQuestion();
    if (q) this.examService.selectOption(q.id, opt);
  }

  prevQ(): void {
    const s = this.activeExamState();
    if (s && s.currentQuestionIndex > 0) {
      this.examService.activeExam.set({ ...s, currentQuestionIndex: s.currentQuestionIndex - 1 });
    }
  }

  nextQ(): void {
    const s = this.activeExamState();
    if (s && s.currentQuestionIndex < s.questions.length - 1) {
      this.examService.activeExam.set({ ...s, currentQuestionIndex: s.currentQuestionIndex + 1 });
    }
  }

  jumpTo(idx: number): void {
    const s = this.activeExamState();
    if (s && idx >= 0 && idx < s.questions.length) {
      this.examService.activeExam.set({ ...s, currentQuestionIndex: idx });
    }
  }

  finalSubmit(): void {
    this.showReviewModal.set(false);
    this.examService.submitExam('Final submission after review');
  }

  formatTimer(seconds: number): string {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }
}
