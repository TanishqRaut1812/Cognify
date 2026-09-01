import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-plan',
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="view-section active container">
      <div class="section-header" style="margin-bottom: 24px;">
        <div>
          <h1 class="hero-title" style="font-size: 28px; text-align: left;">Semester Assessment Plan 2026</h1>
          <p class="section-sub">Roadmap of scheduled tests, module weightages, and evaluation rules</p>
        </div>
      </div>

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
    </section>
  `
})
export class PlanComponent {}
