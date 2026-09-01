import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { StudentScore } from '../../core/models/cognify.models';

@Component({
  selector: 'app-student-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <section class="view-section active container">
      <div style="margin-bottom: 16px;">
        <a routerLink="/" class="btn btn-secondary btn-sm">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="15 18 9 12 15 6"/></svg>
          Back to Home
        </a>
      </div>

      @if (studentData(); as st) {
        <div class="card-box" style="margin-bottom: 24px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 16px;">
            <div>
              <span class="timeline-tag tag-current">{{ st.class_name }} Class</span>
              <h1 style="font-size: 26px; margin-top: 6px;">{{ st.student_name }}</h1>
              <div style="font-family: monospace; color: var(--text-muted); font-size: 14px;">Registration: {{ st.registration_no }} | Roll: {{ st.roll_no }}</div>
            </div>
            <div style="text-align: right;">
              <div style="font-size: 12px; color: var(--text-muted); text-transform: uppercase;">Cognify Score</div>
              <div class="score-cell" style="font-size: 32px; font-weight: 800;">{{ st.cognify_score }}%</div>
              <div style="font-size: 13px; color: var(--accent-amber); font-weight: 700;">Class Rank: #{{ st.rank }}</div>
            </div>
          </div>
        </div>

        <div class="card-box">
          <h3 style="font-size: 18px; margin-bottom: 16px;">Assessment Performance History</h3>
          <table class="ranking-table">
            <thead>
              <tr>
                <th>Test Series</th>
                <th>Test Date</th>
                <th>Attendance</th>
                <th>Score Obtained</th>
                <th>Percentage</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight: 600;">Test 01: Quantitative Aptitude & Logic Foundation</td>
                <td>15/07/26</td>
                <td><span class="timeline-tag tag-completed">Present</span></td>
                <td>46.0 / 50</td>
                <td class="score-cell">92.0%</td>
              </tr>
              <tr>
                <td style="font-weight: 600;">Test 02: Verbal Reasoning & Data Interpretation</td>
                <td>01/08/26</td>
                <td><span class="timeline-tag tag-completed">Present</span></td>
                <td>93.0 / 100</td>
                <td class="score-cell">93.0%</td>
              </tr>
            </tbody>
          </table>
        </div>
      } @else {
        <div class="card-box" style="text-align: center; padding: 48px;">
          <h3 style="font-size: 20px; color: var(--accent-rose);">Student Not Found</h3>
          <p style="color: var(--text-secondary); margin-top: 8px;">No performance record found for registration number: {{ regNo() }}</p>
        </div>
      }
    </section>
  `
})
export class StudentDashboardComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private leaderboardService = inject(LeaderboardService);

  regNo = signal<string>('');
  studentData = signal<StudentScore | null>(null);

  async ngOnInit(): Promise<void> {
    this.route.params.subscribe(async params => {
      const reg = params['regNo'];
      this.regNo.set(reg);
      if (reg) {
        // Look up student across classes
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
            cognify_score: 88.5,
            completed_tests_count: 2,
            rank: 4,
            class_name: 'SY'
          });
        }
      }
    });
  }
}
