import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { SyllabusService, SyllabusItem } from '../../core/services/syllabus.service';
import { Test } from '../../core/models/cognify.models';

interface TestPlanCard {
  id: number;
  test_number: string;
  test_name: string;
  phase_label: string;
  phase_class: string;
  weightage_marks: number;
  focus_areas: string;
  status: string;
}

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
        <p class="page-sub">Full chronological schedule of tests, topics, and test-by-test syllabus</p>
      </div>

      <div class="container margin-top">
        <div class="semester-plan-list">
          @for (card of planCards(); track card.id) {
            <div class="plan-card" [style.border-color]="card.status === 'Current' ? 'var(--accent-primary)' : null">
              <!-- CARD HEADER -->
              <div class="plan-card-header">
                <div>
                  <span class="timeline-tag" [ngClass]="card.phase_class">{{ card.phase_label }}</span>
                  <h3 style="font-size: 18px; margin-top: 6px;">{{ card.test_number }}: {{ card.test_name }}</h3>
                </div>
                <span style="font-weight: 700; color: var(--accent-emerald);">Weightage: {{ card.weightage_marks }} Marks</span>
              </div>

              <!-- FOCUS AREAS -->
              <p style="color: var(--text-secondary); font-size: 14px; margin-bottom: 12px;">
                <strong>Focus areas:</strong> {{ card.focus_areas }}
              </p>

              <!-- VIEW SYLLABUS EXPANDABLE TOGGLE -->
              <div class="syllabus-toggle-bar" style="margin-top: 14px; padding-top: 10px; border-top: 1px dashed var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
                <button type="button" class="btn btn-secondary btn-sm" (click)="toggleSyllabus(card.id)" style="display: inline-flex; align-items: center; gap: 6px; font-weight: 600;">
                  <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                  <span>{{ isExpanded(card.id) ? 'Hide Syllabus ▲' : 'View Syllabus ▼' }}</span>
                </button>
                @if (getSyllabusItems(card.id).length > 0) {
                  <span style="font-size: 12px; color: var(--accent-sky); font-weight: 600;">
                    {{ getSyllabusItems(card.id).length }} Syllabus Category{{ getSyllabusItems(card.id).length > 1 ? 'ies' : '' }} Configured
                  </span>
                }
              </div>

              <!-- EXPANDED PRETTY-PRINTED SYLLABUS BOX -->
              @if (isExpanded(card.id)) {
                <div class="syllabus-detail-container" style="margin-top: 16px; background: rgba(0,0,0,0.25); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 18px;">
                  <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 14px; border-bottom: 1px solid rgba(255,255,255,0.08); padding-bottom: 8px;">
                    <svg class="accent-icon" xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
                    <h4 style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin: 0;">
                      Official Test Syllabus — {{ card.test_number }}
                    </h4>
                  </div>

                  @if (getSyllabusItems(card.id).length > 0) {
                    <div class="syllabus-category-grid" style="display: flex; flex-direction: column; gap: 16px;">
                      @for (cat of getSyllabusItems(card.id); track cat.id; let idx = $index) {
                        <div class="syllabus-category-card" style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: var(--radius-sm); padding: 14px;">
                          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                            <span style="background: var(--accent-sky); color: #000; font-weight: 800; font-size: 12px; border-radius: 50%; width: 22px; height: 22px; display: inline-flex; align-items: center; justify-content: center;">
                              {{ idx + 1 }}
                            </span>
                            <h5 style="font-size: 15px; font-weight: 700; color: var(--accent-sky); margin: 0;">
                              {{ cat.category_name }}
                            </h5>
                          </div>

                          @if (cat.content) {
                            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px; font-style: italic;">
                              {{ cat.content }}
                            </p>
                          }

                          @if (cat.topics && cat.topics.length > 0) {
                            <ul style="margin: 0; padding-left: 20px; font-size: 13.5px; color: var(--text-primary); line-height: 1.6;">
                              @for (topic of cat.topics; track topic) {
                                <li style="margin-bottom: 4px;">{{ topic }}</li>
                              }
                            </ul>
                          }
                        </div>
                      }
                    </div>
                  } @else {
                    <div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 13.5px; background: rgba(255,255,255,0.02); border-radius: var(--radius-sm); border: 1px dashed rgba(255,255,255,0.1);">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="margin-bottom: 6px; color: var(--text-muted);"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                      <div>Syllabus not available yet for this test.</div>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </div>
    </section>
  `
})
export class PlanComponent implements OnInit {
  private leaderboardService = inject(LeaderboardService);
  private syllabusService = inject(SyllabusService);

  planCards = signal<TestPlanCard[]>([]);
  syllabusMap = signal<{ [testId: number]: SyllabusItem[] }>({});
  expandedTests = signal<{ [testId: number]: boolean }>({});

  async ngOnInit(): Promise<void> {
    await this.loadPlanData();
  }

  async loadPlanData(): Promise<void> {
    const defaultCards: TestPlanCard[] = [
      {
        id: 1,
        test_number: 'Test 01',
        test_name: 'Quantitative Aptitude & Logic Foundation',
        phase_label: 'Phase 1 (Completed)',
        phase_class: 'tag-completed',
        weightage_marks: 50,
        focus_areas: 'Number series, percentage calculations, profit-loss ratios, data interpretation tables.',
        status: 'Completed'
      },
      {
        id: 2,
        test_number: 'Test 02',
        test_name: 'Verbal Reasoning & Data Interpretation',
        phase_label: 'Phase 2 (Completed)',
        phase_class: 'tag-completed',
        weightage_marks: 100,
        focus_areas: 'Vocabulary antonyms/synonyms, grammar proficiency, bar charts, caselet data interpretation.',
        status: 'Completed'
      },
      {
        id: 3,
        test_number: 'Test 03',
        test_name: 'Advanced Spatial & Analytical Ability',
        phase_label: 'Phase 3 (Active)',
        phase_class: 'tag-current',
        weightage_marks: 75,
        focus_areas: '3D net folding, mirror images, direction sense shortest paths, syllogistic deductions.',
        status: 'Current'
      },
      {
        id: 4,
        test_number: 'Test 04',
        test_name: 'Comprehensive Mental Ability Final',
        phase_label: 'Phase 4 (Upcoming)',
        phase_class: 'tag-upcoming',
        weightage_marks: 100,
        focus_areas: 'Grand final evaluation integrating compound interest, clock time calculations, statement arguments, and complex puzzle logic.',
        status: 'Upcoming'
      }
    ];

    try {
      const tests = await this.leaderboardService.getAllTests();
      if (tests && tests.length > 0) {
        const mapped: TestPlanCard[] = tests.map((t: Test, idx: number) => {
          let phaseLabel = `Phase ${idx + 1}`;
          let phaseClass = 'tag-upcoming';
          if (t.status === 'Completed') {
            phaseLabel = `Phase ${idx + 1} (Completed)`;
            phaseClass = 'tag-completed';
          } else if (t.status === 'Current') {
            phaseLabel = `Phase ${idx + 1} (Active)`;
            phaseClass = 'tag-current';
          } else {
            phaseLabel = `Phase ${idx + 1} (Upcoming)`;
            phaseClass = 'tag-upcoming';
          }

          const def = defaultCards.find((d) => d.id === t.id);

          return {
            id: t.id,
            test_number: t.test_number || t.testNumber || `Test 0${t.id}`,
            test_name: t.test_name || t.title || `Test ${t.id}`,
            phase_label: phaseLabel,
            phase_class: phaseClass,
            weightage_marks: t.total_marks || t.totalMarks || (def ? def.weightage_marks : 50),
            focus_areas: def ? def.focus_areas : 'Comprehensive mental ability, aptitude, and analytical logic.',
            status: t.status || 'Upcoming'
          };
        });

        this.planCards.set(mapped);
      } else {
        this.planCards.set(defaultCards);
      }
    } catch (e) {
      this.planCards.set(defaultCards);
    }

    // Fetch syllabus test-by-test for each test card
    const sMap: { [testId: number]: SyllabusItem[] } = {};
    for (const card of this.planCards()) {
      const syl = await this.syllabusService.getSyllabusForTest(card.id);
      sMap[card.id] = syl;
    }
    this.syllabusMap.set(sMap);

    // Expand active test 3 by default
    this.expandedTests.set({ 3: true });
  }

  toggleSyllabus(testId: number): void {
    const current = this.expandedTests();
    this.expandedTests.set({
      ...current,
      [testId]: !current[testId]
    });
  }

  isExpanded(testId: number): boolean {
    return !!this.expandedTests()[testId];
  }

  getSyllabusItems(testId: number): SyllabusItem[] {
    return this.syllabusMap()[testId] || [];
  }
}
