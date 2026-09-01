import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { StudentScore } from '../../core/models/cognify.models';

@Component({
  selector: 'app-rankings',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="view-section active container">
      <div class="section-header" style="margin-bottom: 24px;">
        <div>
          <h1 class="hero-title" style="font-size: 28px; text-align: left;">Official Competition Leaderboard</h1>
          <p class="section-sub">Comprehensive competition rankings calculated across all published test series</p>
        </div>
      </div>

      <div class="class-segmented-control">
        <button type="button" class="segmented-btn" [class.active]="selectedClass() === 'SY'" (click)="loadClassRankings('SY')">SY (Second Year)</button>
        <button type="button" class="segmented-btn" [class.active]="selectedClass() === 'TY'" (click)="loadClassRankings('TY')">TY (Third Year)</button>
        <button type="button" class="segmented-btn" [class.active]="selectedClass() === 'Final Year'" (click)="loadClassRankings('Final Year')">Final Year</button>
      </div>

      <div class="leaderboard-card">
        <table class="ranking-table">
          <thead>
            <tr>
              <th style="width: 80px;">Rank</th>
              <th>Roll Number</th>
              <th>Student Name</th>
              <th>Cognify Score</th>
              <th>Tests Completed</th>
            </tr>
          </thead>
          <tbody>
            @for (st of rankings(); track st.registration_no) {
              <tr>
                <td>
                  <span class="rank-badge" [ngClass]="getRankClass(st.rank)">{{ st.rank }}</span>
                </td>
                <td style="font-family: monospace;">{{ st.roll_no }}</td>
                <td style="font-weight: 600;">{{ st.student_name }}</td>
                <td class="score-cell">{{ st.cognify_score }}%</td>
                <td>{{ st.completed_tests_count }} / 4</td>
              </tr>
            } @empty {
              <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 32px;">No student rankings found for this class.</td></tr>
            }
          </tbody>
        </table>
      </div>
    </section>
  `
})
export class RankingsComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);

  selectedClass = signal<'SY' | 'TY' | 'Final Year'>('SY');
  rankings = signal<StudentScore[]>([]);

  ngOnInit(): void {
    this.loadClassRankings('SY');
  }

  async loadClassRankings(cname: 'SY' | 'TY' | 'Final Year'): Promise<void> {
    this.selectedClass.set(cname);
    const data = await this.leaderboardService.getFullRankings(cname);
    this.rankings.set(data);
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-top-1';
    if (rank === 2) return 'rank-top-2';
    if (rank === 3) return 'rank-top-3';
    return '';
  }
}
