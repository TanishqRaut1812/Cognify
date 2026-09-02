import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { LeaderboardService, TimelineData, CurrentPrepData } from '../../core/services/leaderboard.service';
import { ResourceService } from '../../core/services/resource.service';
import { StudentScore } from '../../core/models/cognify.models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  template: `
    <section class="view-section active container">
      <!-- HERO BANNER -->
      <div class="hero-card">
        <div class="hero-badge">
          <span class="pulse-dot"></span>
          <span>Official ITSA Platform</span>
        </div>
        <h1 class="hero-title">Cognify</h1>
        <h2 class="hero-subtitle">ITSA Mental Ability Development Program</h2>
        <p class="hero-tagline">Sharpen Your Thinking.</p>
        <p class="hero-desc">
          The central portal for student test schedules, syllabus, practice questions, performance rankings, and official test keys across SY, TY, and Final Year.
        </p>
        <div class="hero-actions">
          <a routerLink="/rankings" class="btn btn-primary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
            View Rankings
          </a>
          <a routerLink="/plan" class="btn btn-secondary">
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
            Semester Plan
          </a>
        </div>
      </div>

      <!-- TOP 10 LEADERBOARD BLOCK -->
      <div class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">
              <svg class="accent-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
              Current Class Leaderboards
            </h2>
            <p class="section-sub">Top 10 rankings per class based on Cognify Score</p>
          </div>
          <span class="timestamp-badge">Updated: {{ lastUpdated() || 'Live' }}</span>
        </div>

        <div class="class-segmented-control">
          <button type="button" class="segmented-btn" [class.active]="activeTab() === 'SY'" (click)="activeTab.set('SY')">SY</button>
          <button type="button" class="segmented-btn" [class.active]="activeTab() === 'TY'" (click)="activeTab.set('TY')">TY</button>
          <button type="button" class="segmented-btn" [class.active]="activeTab() === 'Final Year'" (click)="activeTab.set('Final Year')">Final Year</button>
        </div>

        <div class="leaderboard-card">
          <table class="ranking-table">
            <thead>
              <tr>
                <th style="width: 70px;">Rank</th>
                <th>Roll No</th>
                <th>Student Name</th>
                <th>Cognify Score</th>
                <th>Tests Completed</th>
              </tr>
            </thead>
            <tbody>
              @for (st of getCurrentTabRankings(); track st.registration_no) {
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
                <tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 24px;">No rankings available yet.</td></tr>
              }
            </tbody>
          </table>
        </div>
      </div>

      <!-- TEST TIMELINE GRID -->
      <div class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">
              <svg class="accent-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Test Timeline
            </h2>
            <p class="section-sub">Schedule and evaluation progress</p>
          </div>
        </div>

        <div class="test-timeline-grid">
          @if (timeline()?.previous; as prev) {
            <div class="timeline-card">
              <div class="timeline-header">
                <span class="timeline-tag tag-completed">Previous Test</span>
                <span style="font-size: 12px; color: var(--text-muted);">{{ prev.test_number }}</span>
              </div>
              <h3 class="timeline-title">{{ prev.test_name }}</h3>
              <p class="timeline-date">Date: {{ prev.formatted_date || prev.test_date }}</p>
              <div style="display: flex; gap: 8px;">
                <span class="timeline-tag tag-completed">Published</span>
              </div>
            </div>
          }

          @if (timeline()?.current; as curr) {
            <div class="timeline-card current-card">
              <div class="timeline-header">
                <span class="timeline-tag tag-current">Active Test</span>
                <span style="font-size: 12px; color: var(--accent-primary); font-weight: 700;">{{ curr.test_number }}</span>
              </div>
              <h3 class="timeline-title">{{ curr.test_name }}</h3>
              <p class="timeline-date">Date: {{ curr.formatted_date || curr.test_date }} | {{ curr.start_time }} - {{ curr.finish_time }}</p>
              <div style="display: flex; gap: 8px;">
                <a [routerLink]="['/exam']" [queryParams]="{ testId: curr.id }" class="btn btn-primary btn-sm">Enter Exam Workspace</a>
              </div>
            </div>
          }

          @if (timeline()?.next; as nxt) {
            <div class="timeline-card">
              <div class="timeline-header">
                <span class="timeline-tag tag-upcoming">Upcoming Test</span>
                <span style="font-size: 12px; color: var(--text-muted);">{{ nxt.test_number }}</span>
              </div>
              <h3 class="timeline-title">{{ nxt.test_name }}</h3>
              <p class="timeline-date">Scheduled: {{ nxt.formatted_date || nxt.test_date }}</p>
              <div style="display: flex; gap: 8px;">
                <span class="timeline-tag tag-upcoming">Upcoming</span>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- CURRENT PREPARATION & RESOURCES -->
      <div class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">
              <svg class="accent-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/></svg>
              Current Preparation & Syllabus
            </h2>
            <p class="section-sub">Active syllabus & study reference material</p>
          </div>
        </div>

        <div class="prep-container">
          @for (cat of currentPrep()?.categories; track cat.id) {
            <div class="syllabus-category">
              <h4 class="cat-title">{{ cat.category_name }}</h4>
              <ul class="topic-list">
                @for (top of cat.topics; track top) {
                  <li class="topic-item">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-emerald)" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                    <span>{{ top }}</span>
                  </li>
                }
              </ul>
            </div>
          }

          <div class="resource-pills">
            @for (res of currentPrep()?.resources; track res.id) {
              <a [href]="res.file_path" class="resource-pill" [class.disabled]="!res.accessible" (click)="handleDownload($event, res)">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
                <span>{{ res.title }}</span>
                @if (!res.accessible) {
                  <span style="font-size: 10px; color: var(--accent-rose); font-weight: 700;">(Locked)</span>
                }
              </a>
            }
          </div>
        </div>
      </div>

      <!-- STUDENT SCORECARD SEARCH -->
      <div class="section-block">
        <div class="section-header">
          <div>
            <h2 class="section-title">
              <svg class="accent-icon" xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><polyline points="16 11 18 13 22 9"/></svg>
              My Student Scorecard & Results
            </h2>
            <p class="section-sub">Enter your registration number to view your published test scores, percentages, and Cognify Score</p>
          </div>
        </div>

        <div class="prep-container">
          <form (ngSubmit)="searchStudent()" style="display: flex; gap: 12px; flex-wrap: wrap;">
            <input type="text" [(ngModel)]="searchRegNo" name="searchRegNo" placeholder="Enter Registration Number (e.g. REG101)" style="flex: 1; min-width: 220px; font-family: monospace;" required>
            <button type="submit" class="btn btn-primary">Check Published Results</button>
          </form>
        </div>
      </div>
    </section>
  `
})
export class HomeComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);
  private resourceService = inject(ResourceService);
  private router = inject(Router);

  activeTab = signal<'SY' | 'TY' | 'Final Year'>('SY');
  rankings = signal<{ [key: string]: StudentScore[] }>({ SY: [], TY: [], 'Final Year': [] });
  lastUpdated = signal<string>('');
  timeline = signal<TimelineData | null>(null);
  currentPrep = signal<CurrentPrepData | null>(null);

  searchRegNo = '';
  homeErrorMessage: string | null = null;

  async ngOnInit(): Promise<void> {
    const r = await this.leaderboardService.getTop10Rankings();
    this.rankings.set(r);
    const t = await this.leaderboardService.getTimeline();
    this.timeline.set(t);
    const p = await this.leaderboardService.getCurrentPrep();
    this.currentPrep.set(p);
  }

  getCurrentTabRankings(): StudentScore[] {
    const list = this.rankings()[this.activeTab()] || [];
    return list.slice(0, 10);
  }

  getRankClass(rank: number): string {
    if (rank === 1) return 'rank-top-1';
    if (rank === 2) return 'rank-top-2';
    if (rank === 3) return 'rank-top-3';
    return '';
  }

  async handleDownload(event: Event, resource: any): Promise<void> {
    event.preventDefault();
    this.homeErrorMessage = null;
    if (!resource.accessible) {
      this.homeErrorMessage = 'Question Paper and Answer Key are inaccessible until the test has passed its Finish Time AND is marked Completed.';
      return;
    }

    try {
      const res = await this.resourceService.getDownloadUrl(resource.test_id || 3, resource.type || 'notes');
      if (res && res.downloadUrl) {
        window.open(res.downloadUrl, '_blank');
      } else {
        this.homeErrorMessage = 'Failed to generate download link. Please try again.';
      }
    } catch (err: any) {
      const msg = err?.error?.error?.message || err?.message || 'Resource not uploaded yet.';
      this.homeErrorMessage = msg;
    }
  }

  searchStudent(): void {
    if (this.searchRegNo.trim()) {
      this.router.navigate(['/student-dashboard', this.searchRegNo.trim()]);
    }
  }
}
