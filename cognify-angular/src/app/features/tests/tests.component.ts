import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { ResourceService, ResourceStatusMap } from '../../core/services/resource.service';
import { Test } from '../../core/models/cognify.models';

@Component({
  selector: 'app-tests',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="view-section active container">
      <div class="section-header" style="margin-bottom: 24px;">
        <div>
          <h1 class="hero-title" style="font-size: 28px; text-align: left;">Test Archive & Resources</h1>
          <p class="section-sub">Complete catalog of Cognify 2026 test series and official study materials</p>
        </div>
      </div>

      <!-- TOAST ERROR MESSAGE BANNER -->
      @if (errorMessage()) {
        <div class="toast-error-banner" style="margin-bottom: 20px; padding: 12px 16px; background: rgba(244, 63, 94, 0.15); border: 1px solid var(--accent-rose); border-radius: var(--radius-sm); color: #fecdd3; font-size: 13.5px; display: flex; justify-content: space-between; align-items: center; gap: 12px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--accent-rose);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <span>{{ errorMessage() }}</span>
          </div>
          <button type="button" (click)="dismissError()" style="background: none; border: none; color: #fecdd3; cursor: pointer; font-size: 16px; font-weight: bold;">✕</button>
        </div>
      }

      <div class="test-timeline-grid">
        @for (t of tests(); track t.id) {
          <div class="timeline-card" [class.current-card]="t.status === 'Current'">
            <div class="timeline-header">
              <span class="timeline-tag" [ngClass]="getStatusTagClass(t.status)">{{ t.status }}</span>
              <span style="font-size: 13px; font-weight: 700; color: var(--accent-sky);">{{ t.test_number }}</span>
            </div>
            <h3 class="timeline-title">{{ t.test_name }}</h3>
            <p class="timeline-date">Date: {{ t.formatted_date || t.test_date }} | Total Marks: {{ t.total_marks }}</p>
            <div style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px;">
              Timing: {{ t.start_time }} - {{ t.finish_time }} ({{ t.duration_minutes }} mins)
            </div>

            <div class="resource-pills">
              <!-- NOTES PDF -->
              <button
                type="button"
                class="resource-pill"
                [class.disabled]="!hasResource(t.id, 'notes')"
                [attr.disabled]="!hasResource(t.id, 'notes') ? true : null"
                (click)="downloadResource(t.id, 'notes')"
                [title]="hasResource(t.id, 'notes') ? 'Download Notes PDF' : 'Notes PDF not uploaded yet'"
                tabindex="0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                <span>Notes PDF</span>
                @if (!hasResource(t.id, 'notes')) {
                  <span style="font-size: 10px; color: var(--text-muted); font-weight: 500;">(Not Uploaded)</span>
                }
              </button>

              <!-- PRACTICE SET -->
              <button
                type="button"
                class="resource-pill"
                [class.disabled]="!hasResource(t.id, 'practice')"
                [attr.disabled]="!hasResource(t.id, 'practice') ? true : null"
                (click)="downloadResource(t.id, 'practice')"
                [title]="hasResource(t.id, 'practice') ? 'Download Practice Set' : 'Practice Set not uploaded yet'"
                tabindex="0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="m9 12 2 2 4-4"/></svg>
                <span>Practice Set</span>
                @if (!hasResource(t.id, 'practice')) {
                  <span style="font-size: 10px; color: var(--text-muted); font-weight: 500;">(Not Uploaded)</span>
                }
              </button>

              <!-- QUESTION PAPER -->
              <button
                type="button"
                class="resource-pill"
                [class.disabled]="t.status !== 'Completed' || !hasResource(t.id, 'question_paper')"
                [attr.disabled]="(t.status !== 'Completed' || !hasResource(t.id, 'question_paper')) ? true : null"
                (click)="downloadResource(t.id, 'question_paper')"
                [title]="t.status !== 'Completed' ? 'Question Paper locked until test completion' : (hasResource(t.id, 'question_paper') ? 'Download Question Paper' : 'Question Paper not uploaded yet')"
                tabindex="0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
                <span>Question Paper</span>
                @if (t.status !== 'Completed') {
                  <span style="font-size: 10px; color: var(--accent-rose); font-weight: 700;">(Locked)</span>
                } @else if (!hasResource(t.id, 'question_paper')) {
                  <span style="font-size: 10px; color: var(--text-muted); font-weight: 500;">(Not Uploaded)</span>
                }
              </button>

              <!-- ANSWER KEY -->
              <button
                type="button"
                class="resource-pill"
                [class.disabled]="t.status !== 'Completed' || !hasResource(t.id, 'answer_key')"
                [attr.disabled]="(t.status !== 'Completed' || !hasResource(t.id, 'answer_key')) ? true : null"
                (click)="downloadResource(t.id, 'answer_key')"
                [title]="t.status !== 'Completed' ? 'Answer Key locked until test completion' : (hasResource(t.id, 'answer_key') ? 'Download Answer Key' : 'Answer Key not uploaded yet')"
                tabindex="0"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/></svg>
                <span>Answer Key</span>
                @if (t.status !== 'Completed') {
                  <span style="font-size: 10px; color: var(--accent-rose); font-weight: 700;">(Locked)</span>
                } @else if (!hasResource(t.id, 'answer_key')) {
                  <span style="font-size: 10px; color: var(--text-muted); font-weight: 500;">(Not Uploaded)</span>
                }
              </button>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class TestsComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);
  private resourceService = inject(ResourceService);

  tests = signal<Test[]>([]);
  resourceMap = signal<{ [testId: number]: ResourceStatusMap }>({});
  errorMessage = signal<string | null>(null);

  async ngOnInit(): Promise<void> {
    const list = await this.leaderboardService.getAllTests();
    this.tests.set(list);

    // Fetch resource statuses for all tests
    const statusMap: { [testId: number]: ResourceStatusMap } = {};
    for (const t of list) {
      const status = await this.resourceService.getTestResourceStatus(t.id);
      if (status) {
        statusMap[t.id] = status;
      }
    }
    this.resourceMap.set(statusMap);
  }

  getStatusTagClass(status: string): string {
    if (status === 'Current') return 'tag-current';
    if (status === 'Completed') return 'tag-completed';
    return 'tag-upcoming';
  }

  hasResource(testId: number, resourceType: string): boolean {
    const map = this.resourceMap()[testId];
    if (!map || !map.resources) return false;
    const item = (map.resources as any)[resourceType];
    return !!(item && item.exists);
  }

  async downloadResource(testId: number, resourceType: string): Promise<void> {
    this.dismissError();
    const test = this.tests().find((t) => t.id === testId);

    if ((resourceType === 'question_paper' || resourceType === 'answer_key') && test?.status !== 'Completed') {
      this.errorMessage.set(
        `${resourceType === 'question_paper' ? 'Question Paper' : 'Answer Key'} is locked until the test has passed its Finish Time AND is marked Completed.`
      );
      return;
    }

    if (!this.hasResource(testId, resourceType)) {
      this.errorMessage.set(
        `The requested ${resourceType.replace('_', ' ')} resource has not been uploaded yet for this test.`
      );
      return;
    }

    try {
      const res = await this.resourceService.getDownloadUrl(testId, resourceType);
      if (res && res.downloadUrl) {
        // Open pre-signed URL securely in a new browser tab to trigger native browser open/download
        window.open(res.downloadUrl, '_blank');
      } else {
        this.errorMessage.set('Failed to generate download link. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.error?.error?.message || err?.message || 'Failed to download resource.';
      this.errorMessage.set(msg);
    }
  }

  dismissError(): void {
    this.errorMessage.set(null);
  }
}
