import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { ResultService } from '../../core/services/result.service';
import { AttemptSessionService } from '../../core/services/attempt-session.service';
import { StudentScore, StudentResult } from '../../core/models/cognify.models';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="view-section active container">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
        <a routerLink="/" class="btn btn-secondary btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Home
        </a>

        @if (hasActiveAttempt()) {
          <a routerLink="/exam" class="btn btn-primary btn-sm">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Continue Active Examination
          </a>
        }
      </div>

      @if (studentData(); as st) {
        <div class="card-box" style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <span class="timeline-tag tag-current">{{ st.class_name || 'Cognify' }} Class</span>
              <h1 style="font-size: 26px; margin-top: 6px;">{{ st.student_name || st.name || ('Candidate ' + st.registration_no) }}</h1>
              <div style="font-family: monospace; color: var(--text-muted); font-size: 14px;">Registration: {{ st.registration_no }} | Roll: {{ st.roll_no || '--' }}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Cognify Score</div>
              <div class="score-cell" style="font-size: 32px; font-weight: 800;">{{ st.cognify_score ? st.cognify_score + '%' : 'Pending' }}</div>
              <div style="font-size: 13px; color: var(--accent-amber); font-weight: 700;">Class Rank: #{{ st.rank || 1 }}</div>
            </div>
          </div>
        </div>

        <div class="card-box">
          <h3 style="font-size: 18px; margin-bottom: 16px;">Assessment Performance History</h3>
          <table class="ranking-table">
            <thead>
              <tr>
                <th>Test Series</th>
                <th>Attendance</th>
                <th>Score Obtained</th>
                <th>Percentage</th>
                <th>Publication Status</th>
              </tr>
            </thead>
            <tbody>
              @if (resultsList().length > 0) {
                @for (r of resultsList(); track r.test_id || r.testId) {
                  <tr>
                    <td style="font-weight: 600;">{{ r.testTitle || ('Test ' + (r.test_id || r.testId)) }}</td>
                    <td>
                      <span class="timeline-tag" [class.tag-completed]="r.attendance === 'Present'" [class.tag-upcoming]="r.attendance === 'Absent'">
                        {{ r.attendance }}
                      </span>
                    </td>
                    <td>
                      @if (r.published) {
                        <strong>{{ r.marks_obtained !== null && r.marks_obtained !== undefined ? r.marks_obtained : '--' }}</strong>
                      } @else {
                        <span style="color: var(--text-muted); font-style: italic;">[Masked until published]</span>
                      }
                    </td>
                    <td class="score-cell">
                      @if (r.published) {
                        <strong>{{ r.percentage !== null && r.percentage !== undefined ? r.percentage + '%' : '--' }}</strong>
                      } @else {
                        <span style="color: var(--text-muted); font-style: italic;">Hidden</span>
                      }
                    </td>
                    <td>
                      @if (r.published) {
                        <span class="timeline-tag tag-completed">Published</span>
                      } @else {
                        <span class="timeline-tag tag-upcoming">Unpublished</span>
                      }
                    </td>
                  </tr>
                }
              } @else {
                <tr>
                  <td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">
                    No assessment history recorded for candidate {{ regNo() }}.
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      } @else {
        <div class="card-box" style="text-align: center; padding: 48px;">
          <h3 style="font-size: 20px; color: var(--accent-rose);">Student Record</h3>
          <p style="color: var(--text-secondary); margin-top: 8px;">Registration Number: {{ regNo() }}</p>
        </div>
      }
    </section>
  `
})
export class StudentDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private leaderboardService = inject(LeaderboardService);
  private resultService = inject(ResultService);
  private attemptSession = inject(AttemptSessionService);

  regNo = signal<string>('');
  studentData = signal<StudentScore | null>(null);
  resultsList = signal<StudentResult[]>([]);
  hasActiveAttempt = signal<boolean>(false);

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe(async params => {
      const reg = params['regNo'];
      this.regNo.set(reg);

      const activeSession = this.attemptSession.loadSession();
      if (activeSession && activeSession.registrationNo.toLowerCase() === (reg || '').toLowerCase()) {
        this.hasActiveAttempt.set(true);
      }

      if (reg) {
        // Fetch results via ResultService calling GET /api/student/results?registrationNumber=...
        const res = await this.resultService.getStudentResults(reg);
        this.resultsList.set(res);

        // Fetch leaderboard ranking
        const sys = await this.leaderboardService.getFullRankings('SY');
        const tys = await this.leaderboardService.getFullRankings('TY');
        const fys = await this.leaderboardService.getFullRankings('Final Year');
        const all = [...sys, ...tys, ...fys];
        const match = all.find(s => s.registration_no.toLowerCase() === reg.toLowerCase());
        if (match) {
          this.studentData.set(match);
        } else {
          this.studentData.set({
            registration_no: reg,
            student_name: 'Student ' + reg,
            roll_no: '01',
            cognify_score: 0,
            completed_tests_count: res.filter(r => r.published).length,
            rank: 1,
            class_name: 'SY'
          });
        }
      }
    });
  }
}
