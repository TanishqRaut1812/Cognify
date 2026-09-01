import { Component, HostListener, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { ExamService, ActiveExamState } from '../../core/services/exam.service';
import { Student } from '../../core/models/cognify.models';
import { SubmissionReviewModalComponent } from './submission-review-modal.component';

@Component({
  selector: 'app-exam',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, SubmissionReviewModalComponent],
  template: `
    <!-- 1. REGISTRATION VERIFICATION MODAL -->
    @if (!activeExamState()) {
      <div class="modal-overlay">
        <div class="modal-card">
          <div class="modal-header">
            <div class="modal-icon">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
            </div>
            <div>
              <h3 class="modal-title">Cognify Candidate Verification</h3>
              <p class="modal-subtitle">Enter your Registration Number to begin Test 03</p>
            </div>
          </div>

          <div class="modal-body">
            <form (ngSubmit)="verifyAndStart()">
              <div class="form-group">
                <label>Registration Number</label>
                <input type="text" [(ngModel)]="regNoInput" name="regNoInput" placeholder="e.g. REG2026SY001 or 2024BIT022" required style="font-family: monospace;" autofocus>
              </div>

              @if (errorMessage()) {
                <div class="form-error">
                  <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                  <span>{{ errorMessage() }}</span>
                </div>
              }

              <div class="modal-actions">
                <a routerLink="/" class="btn btn-secondary">Cancel</a>
                <button type="submit" class="btn btn-primary">Verify Identity & Launch Exam</button>
              </div>
            </form>
          </div>
        </div>
      </div>
    }

    <!-- 2. ACTIVE EXAM WORKSPACE -->
    @if (activeExamState(); as exam) {
      @if (!exam.isSubmitted) {
        <div class="exam-container">
          <div class="exam-top-bar">
            <div class="exam-brand">
              <span class="timeline-tag tag-current">{{ exam.testNumber }}</span>
              <h3 style="font-size: 16px;">{{ exam.testName }}</h3>
            </div>

            <div class="exam-timer-box">
              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              <span>{{ formatTimer(exam.remainingSeconds) }}</span>
            </div>

            <div>
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

                  <h3 style="font-size: 18px; margin-bottom: 20px; line-height: 1.5;">{{ q.question_text }}</h3>

                  <div class="exam-options-list">
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'A'" (click)="selectOpt('A')">
                      <span class="opt-letter-pill">A</span>
                      <span>{{ q.option_a }}</span>
                    </div>
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'B'" (click)="selectOpt('B')">
                      <span class="opt-letter-pill">B</span>
                      <span>{{ q.option_b }}</span>
                    </div>
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'C'" (click)="selectOpt('C')">
                      <span class="opt-letter-pill">C</span>
                      <span>{{ q.option_c }}</span>
                    </div>
                    <div class="exam-option-card" [class.selected]="exam.answers[q.id] === 'D'" (click)="selectOpt('D')">
                      <span class="opt-letter-pill">D</span>
                      <span>{{ q.option_d }}</span>
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
            (confirmSubmit)="finalSubmit()">
          </app-submission-review-modal>
        }
      } @else {
        <!-- 3. SUBMITTED SUCCESS SCREEN (Protected: Scores/Answers masked until published) -->
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

  regNoInput = '';
  errorMessage = signal('');
  showReviewModal = signal(false);
  activeExamState = this.examService.activeExam;

  ngOnInit(): void {}

  @HostListener('window:blur')
  onWindowBlur(): void {
    if (this.activeExamState() && !this.activeExamState()?.isSubmitted) {
      const cnt = this.examService.logViolation('Window Blur / Fullscreen Exit');
      if (cnt < 4) {
        alert(`Anti-Cheat Warning: Fullscreen exit detected! (Violation ${cnt}/4). 4th exit will terminate the test.`);
      }
    }
  }

  async verifyAndStart(): Promise<void> {
    this.errorMessage.set('');
    if (!this.regNoInput.trim()) {
      this.errorMessage.set('Please enter a Registration Number.');
      return;
    }

    const res = await this.examService.verifyStudent(this.regNoInput);
    if (res.success && res.student) {
      await this.examService.startExam(res.student);
    } else {
      this.errorMessage.set(res.message || 'Invalid registration number.');
    }
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
    if (s) this.examService.activeExam.set({ ...s, currentQuestionIndex: idx });
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
