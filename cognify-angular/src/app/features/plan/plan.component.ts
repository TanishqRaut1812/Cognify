import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="view-section active">
      <div class="page-header container">
        <h1 class="page-title">
          <svg class="accent-icon" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="display: inline-block; vertical-align: middle; margin-right: 8px;"><rect width="18" height="18" x="3" y="4" rx="2" ry="2"/><line x1="16" x2="16" y1="2" y2="6"/><line x1="8" x2="8" y1="2" y2="6"/><line x1="3" x2="21" y1="10" y2="10"/></svg>
          Semester Plan
        </h1>
        <p class="page-sub">Full chronological schedule of tests, notes, and keys</p>
      </div>

      <div class="container margin-top">
        <div class="semester-plan-list">
          <div class="plan-card">
            <div class="plan-card-header">
              <div>
                <span class="timeline-tag tag-completed">Phase 1</span>
                <h3 style="font-size: 18px; margin-top: 6px;">Test 01: Quantitative Aptitude & Logic Foundation</h3>
              </div>
              <span style="font-weight: 700; color: var(--accent-emerald);">Weightage: 50 Marks</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 14px;">Focus areas: Number series, percentage calculations, profit-loss ratios, data interpretation tables.</p>
          </div>

          <div class="plan-card">
            <div class="plan-card-header">
              <div>
                <span class="timeline-tag tag-completed">Phase 2</span>
                <h3 style="font-size: 18px; margin-top: 6px;">Test 02: Verbal Reasoning & Data Interpretation</h3>
              </div>
              <span style="font-weight: 700; color: var(--accent-emerald);">Weightage: 100 Marks</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 14px;">Focus areas: Vocabulary antonyms/synonyms, grammar proficiency, bar charts, caselet data interpretation.</p>
          </div>

          <div class="plan-card" style="border-color: var(--accent-primary);">
            <div class="plan-card-header">
              <div>
                <span class="timeline-tag tag-current">Phase 3 (Active)</span>
                <h3 style="font-size: 18px; margin-top: 6px;">Test 03: Advanced Spatial & Analytical Ability</h3>
              </div>
              <span style="font-weight: 700; color: var(--accent-emerald);">Weightage: 75 Marks</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 14px;">Focus areas: 3D net folding, mirror images, direction sense shortest paths, syllogistic deductions.</p>
          </div>

          <div class="plan-card">
            <div class="plan-card-header">
              <div>
                <span class="timeline-tag tag-upcoming">Phase 4</span>
                <h3 style="font-size: 18px; margin-top: 6px;">Test 04: Comprehensive Mental Ability Final</h3>
              </div>
              <span style="font-weight: 700; color: var(--accent-emerald);">Weightage: 100 Marks</span>
            </div>
            <p style="color: var(--text-secondary); font-size: 14px;">Grand final evaluation integrating compound interest, clock time calculations, statement arguments, and complex puzzle logic.</p>
          </div>
        </div>
      </div>
    </section>
  `
})
export class PlanComponent {}
