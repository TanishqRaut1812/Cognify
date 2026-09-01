import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService } from '../../core/services/leaderboard.service';
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
          <p class="section-sub">Complete catalog of Cognify 2026 test series and study materials</p>
        </div>
      </div>

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
              <span class="resource-pill">Notes PDF</span>
              <span class="resource-pill">Practice Set</span>
              <span class="resource-pill" [class.disabled]="t.status !== 'Completed'" (click)="downloadPaper(t)">
                Question Paper
                @if (t.status !== 'Completed') {
                  <span style="font-size: 10px; color: var(--accent-rose); font-weight: 700;">(Locked)</span>
                }
              </span>
              <span class="resource-pill" [class.disabled]="t.status !== 'Completed'" (click)="downloadKey(t)">
                Answer Key
                @if (t.status !== 'Completed') {
                  <span style="font-size: 10px; color: var(--accent-rose); font-weight: 700;">(Locked)</span>
                }
              </span>
            </div>
          </div>
        }
      </div>
    </section>
  `
})
export class TestsComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);
  tests = signal<Test[]>([]);

  async ngOnInit(): Promise<void> {
    const list = await this.leaderboardService.getAllTests();
    this.tests.set(list);
  }

  getStatusTagClass(status: string): string {
    if (status === 'Current') return 'tag-current';
    if (status === 'Completed') return 'tag-completed';
    return 'tag-upcoming';
  }

  downloadPaper(test: Test): void {
    if (test.status !== 'Completed') {
      alert('Question Paper is inaccessible until the test has passed its Finish Time AND is marked Completed.');
    } else {
      alert(`Downloading Question Paper for ${test.test_number}`);
    }
  }

  downloadKey(test: Test): void {
    if (test.status !== 'Completed') {
      alert('Answer Key is inaccessible until the test has passed its Finish Time AND is marked Completed.');
    } else {
      alert(`Downloading Answer Key for ${test.test_number}`);
    }
  }
}
