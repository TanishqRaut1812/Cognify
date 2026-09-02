import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { AdminService } from '../../../core/services/admin.service';
import { ExcelService } from '../../../core/services/excel.service';
import { AuthService } from '../../../core/services/auth.service';
import { LeaderboardService } from '../../../core/services/leaderboard.service';
import { AttendanceRecord, AuditLog, Resource, SyllabusCategory } from '../../../core/models/cognify.models';

@Component({
  selector: 'app-test-workspace',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="workspace-page-container" style="padding: 24px; max-width: 1400px; margin: 0 auto; min-height: 80vh;">
      <!-- WORKSPACE HEADER -->
      <div class="workspace-header" style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-subtle); padding-bottom: 16px; margin-bottom: 20px;">
        <div>
          <button type="button" class="btn btn-secondary btn-sm" (click)="closeWorkspace()" style="margin-bottom: 12px;">
            &larr; Back to All Tests
          </button>
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap;">
            <h2 style="font-size: 24px; font-weight: 800; color: var(--text-primary);">
              {{ testData()?.testNumber || testData()?.test_number || 'Test' }}: {{ testData()?.title || testData()?.test_name || 'Loading...' }}
            </h2>
            <span class="timeline-tag" [class.tag-current]="testData()?.status === 'Current'" [class.tag-upcoming]="testData()?.status === 'Upcoming'">
              {{ testData()?.status || 'Upcoming' }}
            </span>
            <span class="timeline-tag" [style.background]="testData()?.isPublished || testData()?.is_published ? 'rgba(16, 185, 129, 0.15)' : 'rgba(245, 158, 11, 0.15)'" [style.color]="testData()?.isPublished || testData()?.is_published ? 'var(--accent-emerald)' : 'var(--accent-amber)'">
              {{ testData()?.isPublished || testData()?.is_published === 1 ? 'Published' : 'Unpublished' }}
            </span>
          </div>
          <div style="font-size: 13px; color: var(--text-muted); margin-top: 6px;">
            Date: <strong>{{ testData()?.testDate || testData()?.test_date || '--' }}</strong> &bull;
            Total Marks: <strong>{{ testData()?.totalMarks || testData()?.total_marks || 50 }}</strong> &bull;
            Duration: <strong>{{ testData()?.durationMinutes || testData()?.duration_minutes || 60 }} mins</strong>
          </div>
        </div>
        <div style="display: flex; gap: 8px;">
          <button type="button" class="btn btn-primary btn-sm" (click)="togglePublishState()">
            {{ testData()?.isPublished || testData()?.is_published === 1 ? 'Unpublish Results' : 'Publish Results' }}
          </button>
        </div>
      </div>

      <!-- WORKSPACE SEGMENTED NAVIGATION TABS (ALL 8 PANES RESTORED) -->
      <div class="admin-workspace-tabs" style="display: flex; gap: 8px; border-bottom: 1px solid var(--border-subtle); padding-bottom: 12px; margin-bottom: 24px; overflow-x: auto;">
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'overview'" (click)="wsTab.set('overview')">Overview</button>
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'students'" (click)="wsTab.set('students')">Students & Attendance</button>
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'attempts'" (click)="wsTab.set('attempts')">Attempts</button>
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'results'" (click)="wsTab.set('results')">Results Verification</button>
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'resources'" (click)="wsTab.set('resources')">Resources</button>
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'questions'" (click)="wsTab.set('questions')">Questions</button>
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'settings'" (click)="wsTab.set('settings')">Settings</button>
        <button type="button" class="ws-tab-btn" [class.active]="wsTab() === 'audit'" (click)="wsTab.set('audit')">Audit Log</button>
      </div>

      <!-- PANE 1: OVERVIEW -->
      @if (wsTab() === 'overview') {
        <div class="ws-pane">
          <!-- SCHEDULE BOX -->
          <div class="card-box" style="background: rgba(56, 189, 248, 0.08); border: 1px solid rgba(56, 189, 248, 0.25); margin-bottom: 20px; padding: 20px; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
              <h4 style="font-size: 16px; color: var(--accent-sky); margin: 0; font-weight: 700;">Schedule & Availability</h4>
              <span class="timeline-tag tag-current">{{ testData()?.status || 'Active' }}</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-size: 13px;">
              <div>
                <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Date</div>
                <div style="font-weight: 700;">{{ testData()?.testDate || testData()?.test_date || '--' }}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Start Time</div>
                <div style="font-weight: 700;">{{ testData()?.startTime || testData()?.start_time || '10:00 AM' }}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Finish Time</div>
                <div style="font-weight: 700;">{{ testData()?.finishTime || testData()?.finish_time || '11:00 AM' }}</div>
              </div>
              <div>
                <div style="color: var(--text-muted); font-size: 11px; text-transform: uppercase;">Server Time</div>
                <div style="font-weight: 700; color: var(--accent-emerald);">{{ serverTime() }}</div>
              </div>
            </div>
          </div>

          <!-- STATS CARDS -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 12px; margin-bottom: 20px;">
            <div class="stat-card" style="background: rgba(255,255,255,0.04); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
              <div style="font-size: 12px; color: var(--text-muted);">Registered Candidates</div>
              <div style="font-size: 24px; font-weight: 800; margin-top: 4px;">{{ attendanceList().length }}</div>
            </div>
            <div class="stat-card" style="background: rgba(14, 165, 233, 0.1); padding: 16px; border-radius: var(--radius-md); border: 1px solid rgba(14, 165, 233, 0.3);">
              <div style="font-size: 12px; color: var(--accent-sky);">Submissions</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--accent-sky); margin-top: 4px;">{{ attemptsList().length }}</div>
            </div>
            <div class="stat-card" style="background: rgba(16, 185, 129, 0.1); padding: 16px; border-radius: var(--radius-md); border: 1px solid rgba(16, 185, 129, 0.3);">
              <div style="font-size: 12px; color: var(--accent-emerald);">Present Candidates</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--accent-emerald); margin-top: 4px;">{{ getPresentCount() }}</div>
            </div>
            <div class="stat-card" style="background: rgba(245, 158, 11, 0.1); padding: 16px; border-radius: var(--radius-md); border: 1px solid rgba(245, 158, 11, 0.3);">
              <div style="font-size: 12px; color: var(--accent-amber);">Absent Candidates</div>
              <div style="font-size: 24px; font-weight: 800; color: var(--accent-amber); margin-top: 4px;">{{ getAbsentCount() }}</div>
            </div>
            <div class="stat-card" style="background: rgba(168, 85, 247, 0.1); padding: 16px; border-radius: var(--radius-md); border: 1px solid rgba(168, 85, 247, 0.3);">
              <div style="font-size: 12px; color: #C084FC;">Questions Count</div>
              <div style="font-size: 24px; font-weight: 800; color: #C084FC; margin-top: 4px;">{{ questionsList().length }}</div>
            </div>
          </div>

          <!-- STATUS CONTROLS -->
          <div style="display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.2); padding: 16px; border-radius: var(--radius-md); border: 1px solid var(--border-subtle);">
            <div>
              <div style="font-weight: 600; font-size: 14px;">Quick Status Control</div>
              <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Manually transition test execution state.</div>
            </div>
            <select [ngModel]="testData()?.status || 'Upcoming'" (ngModelChange)="updateStatus($event)" style="padding: 6px 12px; font-weight: 600; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
              <option value="Upcoming">Upcoming</option>
              <option value="Current">Current</option>
              <option value="Completed">Completed</option>
            </select>
          </div>
        </div>
      }

      <!-- PANE 2: STUDENTS & ATTENDANCE -->
      @if (wsTab() === 'students') {
        <div class="ws-pane">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 12px;">
            <div>
              <h4 style="font-size: 16px; margin: 0;">Candidate Class List & Attendance Verification</h4>
              <p style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">Admin authorized status verification for test eligibility.</p>
            </div>
            <button type="button" class="btn btn-secondary btn-sm" (click)="markAllPresent()">Mark All Present</button>
          </div>

          <table class="ranking-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left;">
                <th style="padding: 10px;">Registration No</th>
                <th style="padding: 10px;">Student Name</th>
                <th style="padding: 10px;">Roll No</th>
                <th style="padding: 10px;">Status</th>
                <th style="padding: 10px;">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (att of attendanceList(); track att.registration_no) {
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px; font-family: monospace; font-weight: 700;">{{ att.registration_no || att.registrationNo }}</td>
                  <td style="padding: 10px;">{{ att.student_name || att.studentName }}</td>
                  <td style="padding: 10px;">{{ att.roll_no || att.rollNo || '--' }}</td>
                  <td style="padding: 10px;">
                    <span class="timeline-tag" [class.tag-current]="att.status === 'Present'" [class.tag-upcoming]="att.status !== 'Present'">
                      {{ att.status }}
                    </span>
                  </td>
                  <td style="padding: 10px;">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="toggleAttendance(att)">
                      Toggle {{ att.status === 'Present' ? 'Absent' : 'Present' }}
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- PANE 3: ATTEMPTS -->
      @if (wsTab() === 'attempts') {
        <div class="ws-pane">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 style="font-size: 16px; margin: 0;">Candidate Attempt Logs</h4>
            <select [(ngModel)]="attemptFilter" style="width: auto; padding: 6px 12px; font-size: 13px;">
              <option value="all">All Attempts</option>
              <option value="submitted">Submitted Only</option>
              <option value="flagged">Violations / Terminated</option>
            </select>
          </div>

          <table class="ranking-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left;">
                <th style="padding: 10px;">Attempt ID</th>
                <th style="padding: 10px;">Registration No</th>
                <th style="padding: 10px;">Start Time</th>
                <th style="padding: 10px;">Submit Time</th>
                <th style="padding: 10px;">Violations</th>
                <th style="padding: 10px;">Status</th>
                <th style="padding: 10px;">Score</th>
                <th style="padding: 10px;">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (att of getFilteredAttempts(); track att.id) {
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px; font-family: monospace;">#{{ att.id }}</td>
                  <td style="padding: 10px; font-weight: 700;">{{ att.registrationNo || att.registration_no }}</td>
                  <td style="padding: 10px; font-size: 12px;">{{ att.startTime || att.start_time || '--' }}</td>
                  <td style="padding: 10px; font-size: 12px;">{{ att.endTime || att.end_time || '--' }}</td>
                  <td style="padding: 10px;">
                    <span style="color: {{ (att.fullscreenViolations || 0) > 0 ? 'var(--accent-rose)' : 'var(--text-muted)' }}; font-weight: 700;">
                      {{ att.fullscreenViolations || att.fullscreen_violations || 0 }}
                    </span>
                  </td>
                  <td style="padding: 10px;">
                    <span class="timeline-tag" [class.tag-current]="att.status === 'Completed' || att.status === 'submitted'" [class.tag-upcoming]="att.status !== 'Completed'">
                      {{ att.status }}
                    </span>
                  </td>
                  <td style="padding: 10px; font-weight: 800; color: var(--accent-sky);">{{ att.score !== undefined ? att.score : (att.calculatedScore || 0) }}</td>
                  <td style="padding: 10px;">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="openScoreOverrideModal(att)">Override Score</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- PANE 4: RESULTS VERIFICATION & PUBLISHING -->
      @if (wsTab() === 'results') {
        <div class="ws-pane">
          <div style="background: rgba(14, 165, 233, 0.1); border: 1px solid rgba(14, 165, 233, 0.3); border-radius: var(--radius-md); padding: 20px; margin-bottom: 20px;">
            <h4 style="font-size: 18px; color: var(--accent-sky); margin: 0 0 6px 0;">Official Result Verification & Publication</h4>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
              Review candidate scores below. Publishing officially updates student dashboards and competition rankings.
            </p>
            <button type="button" class="btn btn-primary btn-lg" (click)="togglePublishState()">
              {{ testData()?.isPublished || testData()?.is_published === 1 ? 'Unpublish Test Results' : 'Publish Test Results for Rankings' }}
            </button>
          </div>

          <table class="ranking-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left;">
                <th style="padding: 10px;">Registration No</th>
                <th style="padding: 10px;">Student Name</th>
                <th style="padding: 10px;">Attendance</th>
                <th style="padding: 10px;">Marks Obtained</th>
                <th style="padding: 10px;">Percentage</th>
                <th style="padding: 10px;">Status</th>
              </tr>
            </thead>
            <tbody>
              @for (r of resultsList(); track r.id || r.registrationNo) {
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px; font-family: monospace; font-weight: 700;">{{ r.registrationNo || r.registration_no }}</td>
                  <td style="padding: 10px;">{{ r.studentName || r.student_name }}</td>
                  <td style="padding: 10px;">{{ r.attendance || 'Present' }}</td>
                  <td style="padding: 10px; font-weight: 800; color: var(--accent-emerald);">{{ r.marksObtained || r.marks_obtained || 0 }}</td>
                  <td style="padding: 10px;">{{ r.percentage ? r.percentage + '%' : '--' }}</td>
                  <td style="padding: 10px;">
                    <span class="timeline-tag" [class.tag-current]="r.published === 1" [class.tag-upcoming]="r.published !== 1">
                      {{ r.published === 1 ? 'Published' : 'Draft' }}
                    </span>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- PANE 5: STUDY RESOURCES & SYLLABUS -->
      @if (wsTab() === 'resources') {
        <div class="ws-pane">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px;">
            <!-- SYLLABUS BOX -->
            <div class="card-box" style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: var(--radius-md);">
              <h4 style="font-size: 16px; margin-bottom: 12px;">Syllabus Categories</h4>
              <div style="margin-bottom: 16px;">
                @for (s of testSyllabus(); track s.id) {
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div>
                      <div style="font-weight: 700;">{{ s.category_name }}</div>
                      <div style="font-size: 12px; color: var(--text-muted);">{{ s.topics_json }}</div>
                    </div>
                  </div>
                } @empty {
                  <div style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">No syllabus categories added yet.</div>
                }
              </div>

              <!-- ADD SYLLABUS FORM -->
              <form (submit)="$event.preventDefault(); saveSyllabusCategory()" style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                <input type="text" [(ngModel)]="newCatName" name="newCatName" placeholder="Category Name (e.g. Logic & Quantitative)" required style="width: 100%;">
                <textarea [(ngModel)]="newCatTopics" name="newCatTopics" rows="2" placeholder="Topics (comma-separated)" style="width: 100%;"></textarea>
                <button type="submit" class="btn btn-secondary btn-sm">+ Add Category</button>
              </form>
            </div>

            <!-- RESOURCES & MATERIAL BOX -->
            <div class="card-box" style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: var(--radius-md);">
              <h4 style="font-size: 16px; margin-bottom: 12px;">Test Material & Papers</h4>
              <div style="margin-bottom: 16px;">
                @for (r of testResources(); track r.id) {
                  <div style="display: flex; justify-content: space-between; align-items: center; padding: 8px 0; border-bottom: 1px solid rgba(255,255,255,0.05);">
                    <div>
                      <div style="font-weight: 700;">{{ r.title }}</div>
                      <div style="font-size: 12px; color: var(--accent-sky); text-transform: uppercase;">{{ r.resource_type }}</div>
                    </div>
                  </div>
                } @empty {
                  <div style="font-size: 13px; color: var(--text-muted); padding: 8px 0;">No test materials or papers uploaded yet.</div>
                }
              </div>

              @if (resUploadMsg()) {
                <div style="margin-bottom: 12px; font-size: 13px; color: var(--accent-emerald); font-weight: 600;">{{ resUploadMsg() }}</div>
              }

              <!-- UPLOAD RESOURCE FORM -->
              <form (submit)="$event.preventDefault(); uploadResourceFile()" style="display: flex; flex-direction: column; gap: 10px; margin-top: 16px; border-top: 1px solid var(--border-subtle); padding-top: 12px;">
                <select [(ngModel)]="newResType" name="newResType" style="width: 100%; padding: 8px; background: var(--bg-surface); color: var(--text-primary); border: 1px solid var(--border-subtle); border-radius: var(--radius-sm);">
                  <option value="notes">Notes (PDF)</option>
                  <option value="practice">Practice Questions (PDF)</option>
                  <option value="question_paper">Question Paper (PDF)</option>
                  <option value="answer_key">Answer Key (PDF)</option>
                </select>
                <input type="text" [(ngModel)]="newResTitle" name="newResTitle" placeholder="Document Title (e.g. QP-2026-SY-T1)" required style="width: 100%;">
                <input type="file" (change)="onResFileSelected($event)" accept=".pdf" required style="width: 100%;">
                <button type="submit" class="btn btn-primary btn-sm">Upload Resource Document</button>
              </form>
            </div>
          </div>
        </div>
      }

      <!-- PANE 6: QUESTION BANK & VERSIONING -->
      @if (wsTab() === 'questions') {
        <div class="ws-pane">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <h4 style="font-size: 16px; margin: 0;">Question Bank & Version Management</h4>
            <div style="display: flex; gap: 8px; flex-wrap: wrap; align-items: center;">
              <input type="file" #excelInput (change)="onQuestionFileSelected($event)" accept=".xlsx" style="display: none;">
              <button type="button" class="btn btn-primary btn-sm" (click)="excelInput.click()">
                Upload Question Excel (.xlsx)
              </button>
              <button type="button" class="btn btn-secondary btn-sm" (click)="showSingleQForm.set(!showSingleQForm())">
                {{ showSingleQForm() ? 'Close Form' : '+ Add Single Question' }}
              </button>
            </div>
          </div>

          @if (qUploadMsg()) {
            <div style="margin-bottom: 16px; padding: 12px; border-radius: var(--radius-sm); font-weight: 600;"
                 [style.background]="qUploadMsg().includes('Validation') || qUploadMsg().includes('failed') ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'"
                 [style.color]="qUploadMsg().includes('Validation') || qUploadMsg().includes('failed') ? 'var(--accent-rose)' : 'var(--accent-emerald)'">
              {{ qUploadMsg() }}
            </div>
          }

          <!-- SINGLE QUESTION FORM -->
          @if (showSingleQForm()) {
            <div class="card-box" style="background: rgba(0,0,0,0.25); padding: 20px; border-radius: var(--radius-md); margin-bottom: 20px;">
              <h5 style="font-size: 14px; margin-bottom: 12px;">Add Question</h5>
              <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px;">
                <div>
                  <label style="font-size: 12px; color: var(--text-muted);">Question Text</label>
                  <textarea [(ngModel)]="newQ.questionText" rows="2" style="width: 100%;"></textarea>
                </div>
                <div>
                  <label style="font-size: 12px; color: var(--text-muted);">Option A</label>
                  <input type="text" [(ngModel)]="newQ.optionA" style="width: 100%;">
                </div>
                <div>
                  <label style="font-size: 12px; color: var(--text-muted);">Option B</label>
                  <input type="text" [(ngModel)]="newQ.optionB" style="width: 100%;">
                </div>
                <div>
                  <label style="font-size: 12px; color: var(--text-muted);">Option C</label>
                  <input type="text" [(ngModel)]="newQ.optionC" style="width: 100%;">
                </div>
                <div>
                  <label style="font-size: 12px; color: var(--text-muted);">Option D</label>
                  <input type="text" [(ngModel)]="newQ.optionD" style="width: 100%;">
                </div>
                <div>
                  <label style="font-size: 12px; color: var(--text-muted);">Correct Answer</label>
                  <select [(ngModel)]="newQ.correctAnswer" style="width: 100%;">
                    <option value="A">A</option>
                    <option value="B">B</option>
                    <option value="C">C</option>
                    <option value="D">D</option>
                  </select>
                </div>
              </div>
              <button type="button" class="btn btn-primary btn-sm" (click)="saveSingleQuestion()" style="margin-top: 12px;">Save Question</button>
            </div>
          }

          <!-- QUESTION LIST TABLE -->
          <table class="ranking-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left;">
                <th style="padding: 10px;">#</th>
                <th style="padding: 10px;">Question Prompt</th>
                <th style="padding: 10px;">Option A</th>
                <th style="padding: 10px;">Option B</th>
                <th style="padding: 10px;">Option C</th>
                <th style="padding: 10px;">Option D</th>
                <th style="padding: 10px;">Key</th>
                <th style="padding: 10px;">Marks</th>
                <th style="padding: 10px;">Action</th>
              </tr>
            </thead>
            <tbody>
              @for (q of questionsList(); track q.id) {
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px; font-weight: 700;">{{ q.questionNumber || q.question_number || ($index + 1) }}</td>
                  <td style="padding: 10px; max-width: 300px;">{{ q.questionText || q.question_text }}</td>
                  <td style="padding: 10px; font-size: 13px;">{{ q.optionA || q.option_a }}</td>
                  <td style="padding: 10px; font-size: 13px;">{{ q.optionB || q.option_b }}</td>
                  <td style="padding: 10px; font-size: 13px;">{{ q.optionC || q.option_c }}</td>
                  <td style="padding: 10px; font-size: 13px;">{{ q.optionD || q.option_d }}</td>
                  <td style="padding: 10px;">
                    <span class="timeline-tag tag-current">{{ q.correctAnswer || q.correct_answer || q.correct_option }}</span>
                  </td>
                  <td style="padding: 10px; font-weight: 700;">{{ q.marks }}</td>
                  <td style="padding: 10px;">
                    <button type="button" class="btn btn-secondary btn-sm" (click)="deleteQuestion(q.id)">Delete</button>
                  </td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }

      <!-- PANE 7: SETTINGS -->
      @if (wsTab() === 'settings') {
        <div class="ws-pane">
          <div class="card-box" style="background: rgba(0,0,0,0.2); padding: 20px; border-radius: var(--radius-md); margin-bottom: 20px;">
            <h4 style="font-size: 16px; margin-bottom: 16px;">Edit Test Configuration</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px;">
              <div>
                <label style="font-size: 12px; color: var(--text-muted);">Test Number</label>
                <input type="text" [(ngModel)]="settingsForm.testNumber" style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 12px; color: var(--text-muted);">Test Title</label>
                <input type="text" [(ngModel)]="settingsForm.title" style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 12px; color: var(--text-muted);">Test Date</label>
                <input type="text" [(ngModel)]="settingsForm.testDate" style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 12px; color: var(--text-muted);">Start Time</label>
                <input type="text" [(ngModel)]="settingsForm.startTime" style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 12px; color: var(--text-muted);">Finish Time</label>
                <input type="text" [(ngModel)]="settingsForm.finishTime" style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 12px; color: var(--text-muted);">Total Marks</label>
                <input type="number" [(ngModel)]="settingsForm.totalMarks" style="width: 100%;">
              </div>
              <div>
                <label style="font-size: 12px; color: var(--text-muted);">Duration (minutes)</label>
                <input type="number" [(ngModel)]="settingsForm.durationMinutes" style="width: 100%;">
              </div>
            </div>
            <button type="button" class="btn btn-primary" (click)="saveSettings()" style="margin-top: 16px;">Update Test Info</button>
          </div>

          <div class="card-box" style="background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); padding: 20px; border-radius: var(--radius-md);">
            <h4 style="color: var(--accent-rose); font-size: 16px; margin-bottom: 6px;">Delete Test</h4>
            <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px;">
              Deleting a test permanently removes questions, attempts, attendance, and result records.
            </p>
            <button type="button" class="btn btn-danger" (click)="deleteEntireTest()">Delete Entire Test</button>
          </div>
        </div>
      }

      <!-- PANE 8: AUDIT LOG -->
      @if (wsTab() === 'audit') {
        <div class="ws-pane">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <h4 style="font-size: 16px; margin: 0;">System Audit Trail</h4>
            <button type="button" class="btn btn-secondary btn-sm" (click)="loadAuditLogs()">Refresh Log</button>
          </div>

          <table class="ranking-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="border-bottom: 1px solid var(--border-subtle); text-align: left;">
                <th style="padding: 10px;">Timestamp</th>
                <th style="padding: 10px;">Action</th>
                <th style="padding: 10px;">Details / Values</th>
              </tr>
            </thead>
            <tbody>
              @for (log of auditLogs(); track log.id) {
                <tr style="border-bottom: 1px solid rgba(255,255,255,0.05);">
                  <td style="padding: 10px; font-size: 12px; color: var(--text-muted);">{{ log.timestamp }}</td>
                  <td style="padding: 10px; font-weight: 700; color: var(--accent-sky);">{{ log.action }}</td>
                  <td style="padding: 10px; font-size: 13px;">{{ log.details || log.new_value || log.previous_value || '--' }}</td>
                </tr>
              }
            </tbody>
          </table>
        </div>
      }
    </div>
  `
})
export class TestWorkspaceComponent implements OnInit {
  testId = 0;
  testData = signal<any>(null);
  wsTab = signal<'overview' | 'students' | 'attempts' | 'results' | 'resources' | 'questions' | 'settings' | 'audit'>('overview');

  attendanceList = signal<any[]>([]);
  attemptsList = signal<any[]>([]);
  resultsList = signal<any[]>([]);
  questionsList = signal<any[]>([]);
  testResources = signal<Resource[]>([]);
  testSyllabus = signal<SyllabusCategory[]>([]);
  auditLogs = signal<AuditLog[]>([]);

  qUploadMsg = signal('');
  showSingleQForm = signal(false);
  attemptFilter = 'all';
  serverTime = signal(new Date().toLocaleTimeString());

  newQ = { questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A' };
  settingsForm = { testNumber: '', title: '', testDate: '', startTime: '', finishTime: '', totalMarks: 50, durationMinutes: 60 };

  newCatName = '';
  newCatTopics = '';
  newResType = 'notes';
  newResTitle = '';
  resUploadMsg = signal('');
  selectedResFile: File | null = null;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private adminService: AdminService,
    private excelService: ExcelService,
    private authService: AuthService,
    private leaderboardService: LeaderboardService
  ) {}

  async ngOnInit(): Promise<void> {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/']);
      return;
    }

    const idParam = this.route.snapshot.paramMap.get('id');
    this.testId = idParam ? parseInt(idParam, 10) : 0;

    if (!this.testId || isNaN(this.testId)) {
      this.router.navigate(['/admin']);
      return;
    }

    await this.loadWorkspaceData();
  }

  async loadWorkspaceData(): Promise<void> {
    try {
      const t = await this.adminService.getTestById(this.testId);
      this.testData.set(t);

      if (t) {
        this.settingsForm = {
          testNumber: t.testNumber || t.test_number || '',
          title: t.title || t.test_name || '',
          testDate: t.testDate || t.test_date || '',
          startTime: t.startTime || t.start_time || '10:00 AM',
          finishTime: t.finishTime || t.finish_time || '11:00 AM',
          totalMarks: t.totalMarks || t.total_marks || 50,
          durationMinutes: t.durationMinutes || t.duration_minutes || 60
        };
      }
    } catch (e) {
      console.warn(`Failed to fetch test ${this.testId}:`, e);
    }

    const att = await this.adminService.getAttendance(this.testId);
    this.attendanceList.set(att);

    const qs = await this.adminService.getQuestionsForTest(this.testId);
    this.questionsList.set(qs);

    const attempts = await this.adminService.getAttemptsForTest(this.testId);
    this.attemptsList.set(attempts);

    const resList = await this.adminService.getResultsForTest(this.testId);
    this.resultsList.set(resList);

    const res = await this.adminService.getTestResources(this.testId);
    this.testResources.set(res);

    const syl = await this.adminService.getTestSyllabus(this.testId);
    this.testSyllabus.set(syl);

    await this.loadAuditLogs();
  }

  onResFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) this.selectedResFile = file;
  }

  async uploadResourceFile(): Promise<void> {
    if (!this.selectedResFile || !this.newResTitle.trim()) {
      alert('Please enter a document title and select a PDF file.');
      return;
    }

    try {
      this.resUploadMsg.set('Uploading document...');
      if (this.newResType === 'question_paper') {
        await this.adminService.uploadQuestionPaper(this.testId, this.selectedResFile);
      } else if (this.newResType === 'answer_key') {
        await this.adminService.uploadAnswerKey(this.testId, this.selectedResFile);
      } else {
        await this.adminService.uploadResource(this.testId, this.newResTitle, this.newResType, this.selectedResFile);
      }

      this.resUploadMsg.set('Document uploaded successfully!');
      this.newResTitle = '';
      this.selectedResFile = null;
      const res = await this.adminService.getTestResources(this.testId);
      this.testResources.set(res);
    } catch (err: any) {
      this.resUploadMsg.set(`Upload failed: ${err?.message || 'Server error'}`);
    }
  }

  async saveSyllabusCategory(): Promise<void> {
    if (!this.newCatName.trim()) {
      alert('Please enter a category name.');
      return;
    }

    try {
      await this.adminService.addSyllabusCategory(this.testId, this.newCatName, this.newCatTopics);
      alert('Syllabus category added successfully!');
      this.newCatName = '';
      this.newCatTopics = '';
      const syl = await this.adminService.getTestSyllabus(this.testId);
      this.testSyllabus.set(syl);
    } catch (err: any) {
      alert(`Failed to add syllabus: ${err?.message || 'Server error'}`);
    }
  }

  async loadAuditLogs(): Promise<void> {
    const logs = await this.adminService.getAuditLogs();
    const filtered = logs.filter((l: any) => l.testId === this.testId || l.test_id === this.testId || !l.testId);
    this.auditLogs.set(filtered);
  }

  closeWorkspace(): void {
    this.router.navigate(['/admin']);
  }

  getPresentCount(): number {
    return this.attendanceList().filter((a) => a.status === 'Present').length;
  }

  getAbsentCount(): number {
    return this.attendanceList().filter((a) => a.status !== 'Present').length;
  }

  async updateStatus(newStatus: string): Promise<void> {
    await this.adminService.updateTest(this.testId, { status: newStatus });
    this.testData.set({ ...this.testData(), status: newStatus });
  }

  async togglePublishState(): Promise<void> {
    const current = this.testData()?.isPublished || this.testData()?.is_published === 1;
    if (confirm(current ? 'Unpublish test results?' : 'Publish test results for student dashboards and rankings?')) {
      if (current) {
        await this.adminService.unpublishTest(this.testId);
        this.testData.set({ ...this.testData(), isPublished: false, is_published: 0 });
      } else {
        await this.adminService.publishTest(this.testId);
        this.testData.set({ ...this.testData(), isPublished: true, is_published: 1 });
      }
    }
  }

  async markAllPresent(): Promise<void> {
    for (const a of this.attendanceList()) {
      if (a.status !== 'Present') {
        await this.adminService.overrideAttendance(this.testId, a.registration_no || a.registrationNo, 'Present');
      }
    }
    const att = await this.adminService.getAttendance(this.testId);
    this.attendanceList.set(att);
  }

  async toggleAttendance(att: AttendanceRecord): Promise<void> {
    const next = att.status === 'Present' ? 'Absent' : 'Present';
    await this.adminService.overrideAttendance(this.testId, att.registration_no || att.registrationNo, next);
    const updated = await this.adminService.getAttendance(this.testId);
    this.attendanceList.set(updated);
  }

  getFilteredAttempts(): any[] {
    if (this.attemptFilter === 'submitted') {
      return this.attemptsList().filter((a) => a.status === 'Completed' || a.status === 'submitted');
    }
    if (this.attemptFilter === 'flagged') {
      return this.attemptsList().filter((a) => (a.fullscreenViolations || a.fullscreen_violations || 0) > 0 || a.status === 'Terminated');
    }
    return this.attemptsList();
  }

  async openScoreOverrideModal(att: any): Promise<void> {
    const val = prompt(`Enter override score for ${att.registrationNo || att.registration_no}:`, String(att.score || att.calculatedScore || 0));
    if (val !== null) {
      const newScore = parseFloat(val);
      if (!isNaN(newScore)) {
        await this.adminService.overrideResultScore(att.id, newScore);
        alert('Score overridden successfully!');
        const attempts = await this.adminService.getAttemptsForTest(this.testId);
        this.attemptsList.set(attempts);
      }
    }
  }

  async onQuestionFileSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (!file) return;

    const res = await this.excelService.validateAndParseQuestions(file);
    if (!res.valid) {
      this.qUploadMsg.set(`Validation errors: ${res.errors.join('; ')}`);
      return;
    }

    try {
      this.qUploadMsg.set(`Validated ${res.data.length} questions locally. Uploading to database...`);
      const serverRes = await this.adminService.uploadQuestionExcel(this.testId, file);
      const inserted = serverRes?.inserted !== undefined ? serverRes.inserted : res.data.length;

      const qs = await this.adminService.getQuestionsForTest(this.testId);
      this.questionsList.set(qs);

      this.qUploadMsg.set(`Successfully imported ${inserted} questions into database.`);
    } catch (err: any) {
      const errMsg = err?.message || 'Server upload failed. Please try again.';
      this.qUploadMsg.set(`Upload failed: ${errMsg}`);
    }
  }

  async saveSingleQuestion(): Promise<void> {
    if (this.newQ.questionText && this.newQ.optionA && this.newQ.optionB && this.newQ.optionC && this.newQ.optionD) {
      await this.adminService.createQuestion(this.testId, {
        questionText: this.newQ.questionText,
        optionA: this.newQ.optionA,
        optionB: this.newQ.optionB,
        optionC: this.newQ.optionC,
        optionD: this.newQ.optionD,
        correctAnswer: this.newQ.correctAnswer
      });

      const qs = await this.adminService.getQuestionsForTest(this.testId);
      this.questionsList.set(qs);
      this.showSingleQForm.set(false);
      this.newQ = { questionText: '', optionA: '', optionB: '', optionC: '', optionD: '', correctAnswer: 'A' };
      alert('Question saved successfully!');
    }
  }

  async deleteQuestion(id: number): Promise<void> {
    if (confirm('Delete this question?')) {
      await this.adminService.deleteQuestion(id);
      const qs = await this.adminService.getQuestionsForTest(this.testId);
      this.questionsList.set(qs);
    }
  }

  async saveSettings(): Promise<void> {
    await this.adminService.updateTest(this.testId, {
      testNumber: this.settingsForm.testNumber,
      title: this.settingsForm.title,
      testDate: this.settingsForm.testDate,
      startTime: this.settingsForm.startTime,
      finishTime: this.settingsForm.finishTime,
      totalMarks: this.settingsForm.totalMarks,
      durationMinutes: this.settingsForm.durationMinutes
    });

    const t = await this.adminService.getTestById(this.testId);
    this.testData.set(t);
    alert('Test settings updated successfully!');
  }

  async deleteEntireTest(): Promise<void> {
    if (confirm(`CAUTION: Delete entire test "${this.testData()?.title || this.testId}"? This will permanently remove all questions, attendance, attempts, and results.`)) {
      await this.adminService.deleteTest(this.testId);
      alert('Test deleted successfully.');
      this.router.navigate(['/admin']);
    }
  }
}
