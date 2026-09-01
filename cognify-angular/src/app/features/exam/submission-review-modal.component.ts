import { Component, EventEmitter, Input, Output } from '@angular/core';
import { CommonModule } from '@angular/common';
import { StudentExamQuestion } from '../../core/models/cognify.models';

@Component({
  selector: 'app-submission-review-modal',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-card" style="max-width: 560px;">
        <div class="modal-header">
          <div class="modal-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>
          </div>
          <div>
            <h3 class="modal-title">Review Candidate Submission</h3>
            <p class="modal-subtitle">Verify your selected choices before final submission. Click a row to return to that question.</p>
          </div>
          <button type="button" class="modal-close" (click)="closeModal.emit()">&times;</button>
        </div>

        <div class="modal-body" style="max-height: 380px; overflow-y: auto;">
          <table class="ranking-table">
            <thead>
              <tr>
                <th style="width: 110px;">Question #</th>
                <th>Status</th>
                <th>Selected Choice</th>
                <th style="width: 80px;">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (q of questions; track q.id; let idx = $index) {
                <tr style="cursor: pointer;" (click)="onRowClick(idx)">
                  <td style="font-weight: 700; color: var(--accent-sky);">Question {{ idx + 1 }}</td>
                  <td>
                    @if (answers[q.id]) {
                      <span class="timeline-tag tag-completed">Answered</span>
                    } @else {
                      <span class="timeline-tag tag-upcoming">Not Answered</span>
                    }
                  </td>
                  <td style="font-weight: 700;">
                    {{ answers[q.id] || '--' }}
                  </td>
                  <td>
                    <button type="button" class="btn btn-secondary btn-sm" (click)="onRowClick(idx); $event.stopPropagation()">Jump</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>

          <div style="margin-top: 16px; font-size: 13px; color: var(--text-muted); background: rgba(0,0,0,0.2); padding: 12px; border-radius: var(--radius-sm);">
            Notice: Clicking <strong>Confirm & Submit Test</strong> will finalize your answers. Official scores and answer keys will become visible on your dashboard once published by administration.
          </div>

          <div class="modal-actions">
            <button type="button" class="btn btn-secondary" (click)="closeModal.emit()">Back to Test</button>
            <button type="button" class="btn btn-primary" (click)="confirmSubmit.emit()">Confirm & Submit Test</button>
          </div>
        </div>
      </div>
    </div>
  `
})
export class SubmissionReviewModalComponent {
  @Input() questions: StudentExamQuestion[] = [];
  @Input() answers: { [qId: number]: 'A' | 'B' | 'C' | 'D' | '' } = {};

  @Output() closeModal = new EventEmitter<void>();
  @Output() confirmSubmit = new EventEmitter<void>();
  @Output() selectQuestion = new EventEmitter<number>();

  onRowClick(index: number): void {
    this.selectQuestion.emit(index);
    this.closeModal.emit();
  }
}
