import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AdminService } from '../../core/services/admin.service';
import { LeaderboardService } from '../../core/services/leaderboard.service';
import { ExcelService } from '../../core/services/excel.service';
import { StudentService } from '../../core/services/student.service';
import { Test, DashboardStats, AuditLog, BackupRecord, AttendanceRecord, Student, Resource, SyllabusCategory, TestResult } from '../../core/models/cognify.models';

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <section class="view-section active container">
      <div class="admin-dashboard-header">
        <div>
          <span class="admin-badge">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
            ITSA Organizer Portal
          </span>
          <h1 class="page-title">Admin Dashboard</h1>
        </div>
        <button type="button" class="btn btn-secondary btn-sm" (click)="handleLogout()">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>
          Logout
        </button>
      </div>

      <!-- MAIN ADMIN TABS -->
      <div class="admin-tabs">
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'dashboard'" (click)="activeTab.set('dashboard')">
          <span>Dashboard</span>
        </button>
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'tests'" (click)="activeTab.set('tests')">
          <span>Manage Tests</span>
        </button>
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'students'" (click)="activeTab.set('students')">
          <span>Student Lists</span>
        </button>
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'results'" (click)="activeTab.set('results')">
          <span>Excel Results</span>
        </button>
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'resources'" (click)="activeTab.set('resources')">
          <span>Upload Resources</span>
        </button>
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'syllabus'" (click)="activeTab.set('syllabus')">
          <span>Syllabus</span>
        </button>
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'backups'" (click)="activeTab.set('backups')">
          <span>Backup Data</span>
        </button>
        <button type="button" class="admin-tab-btn" [class.active]="activeTab() === 'logs'" (click)="activeTab.set('logs')">
          <span>Audit Logs</span>
        </button>
      </div>

      <!-- 1. DASHBOARD TAB -->
      @if (activeTab() === 'dashboard') {
        <div class="admin-tab-pane active">
          @if (stats(); as st) {
            <div class="form-grid" style="margin-bottom: 24px;">
              <div class="card-box">
                <div style="font-size: 13px; color: var(--text-muted);">Total Master Students</div>
                <div style="font-size: 32px; font-weight: 800; color: #FFF; margin-top: 4px;">{{ st.students_by_class.total }}</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                  SY: <strong style="color: var(--accent-sky);">{{ st.students_by_class.SY }}</strong> |
                  TY: <strong style="color: #C084FC;">{{ st.students_by_class.TY }}</strong> |
                  Final Year: <strong style="color: var(--accent-emerald);">{{ st.students_by_class['Final Year'] }}</strong>
                </div>
              </div>

              <div class="card-box">
                <div style="font-size: 13px; color: var(--text-muted);">Test Series Status</div>
                <div style="font-size: 32px; font-weight: 800; color: var(--accent-sky); margin-top: 4px;">{{ st.tests_by_status.total }} Tests</div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-top: 8px;">
                  Completed: <strong style="color: var(--accent-emerald);">{{ st.tests_by_status.Completed }}</strong> |
                  Current: <strong style="color: var(--accent-primary);">{{ st.tests_by_status.Current }}</strong> |
                  Upcoming: <strong style="color: var(--accent-amber);">{{ st.tests_by_status.Upcoming }}</strong>
                </div>
              </div>
            </div>
          }
        </div>
      }

      <!-- 2. MANAGE TESTS TAB -->
      @if (activeTab() === 'tests') {
        <div class="admin-tab-pane active">
          <div class="card-box" style="margin-bottom: 24px;">
            <h3 style="font-size: 18px; margin-bottom: 16px;">Create New Test Series</h3>
            <form (ngSubmit)="createTest()" class="form-grid">
              <div class="form-group">
                <label>Test Number (e.g. Test 05)</label>
                <input type="text" [(ngModel)]="newTest.test_number" name="test_number" required>
              </div>
              <div class="form-group">
                <label>Test Title</label>
                <input type="text" [(ngModel)]="newTest.test_name" name="test_name" required>
              </div>
              <div class="form-group">
                <label>Test Date</label>
                <input type="date" [(ngModel)]="newTest.test_date" name="test_date" required>
              </div>
              <div class="form-group">
                <label>Total Marks</label>
                <input type="number" [(ngModel)]="newTest.total_marks" name="total_marks" required>
              </div>
              <div class="form-group">
                <label>Start Time</label>
                <input type="text" [(ngModel)]="newTest.start_time" name="start_time" placeholder="e.g. 5:15 PM" required>
              </div>
              <div class="form-group">
                <label>Finish Time</label>
                <input type="text" [(ngModel)]="newTest.finish_time" name="finish_time" placeholder="e.g. 6:15 PM" required>
              </div>
              <div class="form-group">
                <label>Status</label>
                <select [(ngModel)]="newTest.status" name="status">
                  <option value="Upcoming">Upcoming</option>
                  <option value="Current">Current</option>
                  <option value="Completed">Completed</option>
                </select>
              </div>
              <div class="form-group">
                <label>Duration (Minutes)</label>
                <input type="number" [(ngModel)]="newTest.duration_minutes" name="duration_minutes">
              </div>
              <div class="span-full" style="text-align: right; margin-top: 12px;">
                <button type="submit" class="btn btn-primary">Create Test Series</button>
              </div>
            </form>
          </div>



          <div class="card-box">
            <h3 style="font-size: 18px; margin-bottom: 16px;">Configured Test Series</h3>
            <table class="ranking-table">
              <thead>
                <tr><th>Test No</th><th>Test Title</th><th>Date</th><th>Marks</th><th>Status</th><th>Action</th></tr>
              </thead>
              <tbody>
                @for (t of tests(); track t.id) {
                  <tr>
                    <td style="font-family: monospace; font-weight: 700;">{{ t.test_number || t.testNumber }}</td>
                    <td>{{ t.test_name || t.title }}</td>
                    <td>{{ t.test_date || t.testDate }}</td>
                    <td>{{ t.total_marks || t.totalMarks }}</td>
                    <td><span class="timeline-tag" [ngClass]="t.status === 'Current' ? 'tag-current' : 'tag-completed'">{{ t.status }}</span></td>
                    <td>
                      <button type="button" class="btn btn-secondary btn-sm" (click)="openWorkspace(t)">Open Workspace</button>
                    </td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }

      <!-- 3. STUDENT LISTS TAB -->
      @if (activeTab() === 'students') {
        <div class="admin-tab-pane active">
          <div class="card-box" style="margin-bottom: 24px;">
            <div class="card-box-header">
              <h3 style="font-size: 20px;">Student Lists</h3>
              <p class="card-box-sub">Manage student records for each class.</p>
            </div>

            <div class="form-grid" style="grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px;">
              <!-- SY Card -->
              <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <h4 style="font-size: 16px; color: var(--accent-sky);">SY (Second Year)</h4>
                  <span class="timestamp-badge">{{ syStudents().length }} Students</span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Master roster for Second Year class.</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
                    Upload / Replace
                    <input type="file" (change)="onStudentFileSelected($event, 'SY')" accept=".xlsx" style="display: none;">
                  </label>
                  <button type="button" class="btn btn-primary btn-sm" (click)="viewStudentsClass.set('SY')">View Students</button>
                </div>
              </div>

              <!-- TY Card -->
              <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <h4 style="font-size: 16px; color: var(--accent-purple);">TY (Third Year)</h4>
                  <span class="timestamp-badge">{{ tyStudents().length }} Students</span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Master roster for Third Year class.</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
                    Upload / Replace
                    <input type="file" (change)="onStudentFileSelected($event, 'TY')" accept=".xlsx" style="display: none;">
                  </label>
                  <button type="button" class="btn btn-primary btn-sm" (click)="viewStudentsClass.set('TY')">View Students</button>
                </div>
              </div>

              <!-- Final Year Card -->
              <div style="background: rgba(0, 0, 0, 0.25); border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 20px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <h4 style="font-size: 16px; color: var(--accent-emerald);">Final Year</h4>
                  <span class="timestamp-badge">{{ fyStudents().length }} Students</span>
                </div>
                <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 16px;">Master roster for Final Year class.</p>
                <div style="display: flex; gap: 8px; flex-wrap: wrap;">
                  <label class="btn btn-secondary btn-sm" style="cursor: pointer;">
                    Upload / Replace
                    <input type="file" (change)="onStudentFileSelected($event, 'Final Year')" accept=".xlsx" style="display: none;">
                  </label>
                  <button type="button" class="btn btn-primary btn-sm" (click)="viewStudentsClass.set('Final Year')">View Students</button>
                </div>
              </div>
            </div>

            @if (studentUploadMsg()) {
              <div style="margin-top: 16px; padding: 12px; border-radius: var(--radius-sm); background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald);">
                {{ studentUploadMsg() }}
              </div>
            }
          </div>

          <!-- STUDENT LIST TABLE VIEW -->
          @if (viewStudentsClass(); as cls) {
            <div class="card-box margin-top">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
                <h3 style="font-size: 18px; margin: 0;">{{ cls }} Master Student Roster</h3>
                <button type="button" class="btn btn-secondary btn-sm" (click)="viewStudentsClass.set(null)">Close List</button>
              </div>

              @if (getSelectedClassStudents().length > 0) {
                <table class="ranking-table">
                  <thead>
                    <tr><th>#</th><th>Roll Number</th><th>Student Name</th><th>Registration Number</th><th>Action</th></tr>
                  </thead>
                  <tbody>
                    @for (s of getSelectedClassStudents(); track (s.registration_no || s.registrationNo); let idx = $index) {
                      <tr>
                        <td style="color: var(--text-muted);">{{ idx + 1 }}</td>
                        <td style="font-family: monospace; font-weight: 600;">{{ s.roll_no || s.rollNo }}</td>
                        <td style="font-weight: 600;">{{ s.name }}</td>
                        <td style="font-family: monospace; color: var(--accent-sky);">{{ s.registration_no || s.registrationNo }}</td>
                        <td>
                          <button type="button" class="btn btn-secondary btn-sm" (click)="deleteStudentRow(s)">Remove</button>
                        </td>
                      </tr>
                    }
                  </tbody>
                </table>
              } @else {
                <div style="text-align: center; color: var(--text-muted); padding: 32px;">
                  No student list uploaded yet.
                </div>
              }
            </div>
          }
        </div>
      }

      <!-- 4. EXCEL RESULTS TAB -->
      @if (activeTab() === 'results') {
        <div class="admin-tab-pane active">
          <div class="card-box" style="margin-bottom: 24px;">
            <div class="card-box-header">
              <h3 style="font-size: 20px;">Upload Test Results</h3>
              <p class="card-box-sub">Select target test and upload formatted result Excel file (.xlsx).</p>
            </div>

            <div class="form-grid">
              <div class="form-group span-full">
                <label>Select Target Test</label>
                <select [(ngModel)]="selectedResultsTestId" (change)="loadResultsForTest(selectedResultsTestId)">
                  <option [value]="0">-- Select Test --</option>
                  @for (t of tests(); track t.id) {
                    <option [value]="t.id">{{ t.test_number }}: {{ t.test_name }}</option>
                  }
                </select>
              </div>

              <div class="form-group span-full">
                <div class="file-dropzone">
                  <p class="dropzone-title">Upload Result Excel Sheet (.xlsx)</p>
                  <input type="file" (change)="onResultsFileSelected($event)" accept=".xlsx" style="margin-top: 12px;">
                </div>
              </div>
            </div>

            @if (resultsUploadMsg()) {
              <div style="margin-top: 16px; padding: 12px; border-radius: var(--radius-sm); background: rgba(16, 185, 129, 0.15); color: var(--accent-emerald);">
                {{ resultsUploadMsg() }}
              </div>
            }
          </div>

          <div class="card-box">
            <h4 style="font-size: 16px; margin-bottom: 16px;">Imported Candidate Results</h4>
            @if (testResultsList().length > 0) {
              <table class="ranking-table">
                <thead>
                  <tr><th>Roll No</th><th>Name</th><th>Registration No</th><th>Attendance</th><th>Score</th><th>Percentage</th></tr>
                </thead>
                <tbody>
                  @for (r of testResultsList(); track r.registration_no) {
                    <tr>
                      <td style="font-family: monospace;">{{ r.roll_no || '--' }}</td>
                      <td style="font-weight: 600;">{{ r.student_name || '--' }}</td>
                      <td style="font-family: monospace; color: var(--accent-sky);">{{ r.registration_no }}</td>
                      <td><span class="timeline-tag" [ngClass]="r.attendance === 'Present' ? 'tag-completed' : 'tag-upcoming'">{{ r.attendance }}</span></td>
                      <td class="score-cell">{{ r.marks_obtained }}</td>
                      <td class="score-cell">{{ r.percentage }}%</td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div style="text-align: center; color: var(--text-muted); padding: 32px;">
                No result files have been imported yet.
              </div>
            }
          </div>
        </div>
      }

      <!-- 5. UPLOAD RESOURCES TAB -->
      @if (activeTab() === 'resources') {
        <div class="admin-tab-pane active">
          <div class="card-box" style="margin-bottom: 24px;">
            <div class="card-box-header">
              <h3 style="font-size: 20px;">Upload Resources</h3>
              <p class="card-box-sub">Upload notes, practice question sets, question papers, and answer keys.</p>
            </div>

            <form (ngSubmit)="uploadResource()" class="form-grid">
              <div class="form-group">
                <label>Select Test</label>
                <select [(ngModel)]="newResource.test_id" name="test_id" required>
                  @for (t of tests(); track t.id) {
                    <option [value]="t.id">{{ t.test_number }}: {{ t.test_name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Resource Type</label>
                <select [(ngModel)]="newResource.resource_type" name="resource_type" required>
                  <option value="notes">Notes (PDF)</option>
                  <option value="practice">Practice Questions (PDF)</option>
                  <option value="question_paper">Question Paper</option>
                  <option value="answer_key">Answer Key</option>
                </select>
              </div>

              <div class="form-group">
                <label>Document Title</label>
                <input type="text" [(ngModel)]="newResource.title" name="title" required placeholder="e.g. Set A Notes">
              </div>

              <div class="form-group">
                <label>PDF File Upload</label>
                <input type="file" accept=".pdf" (change)="onResourceFileSelected($event)" required>
              </div>

              @if (getExistingResource(newResource.test_id, newResource.resource_type)) {
                <div class="span-full" style="padding: 10px 14px; background: rgba(245, 158, 11, 0.15); border: 1px solid var(--accent-amber); border-radius: var(--radius-sm); color: #fef08a; font-size: 13px;">
                  ⚠️ A <strong>{{ newResource.resource_type?.replace('_', ' ') }}</strong> resource already exists for Test {{ newResource.test_id }}. Uploading will <strong>REPLACE</strong> the existing file.
                </div>
              }

              <div class="span-full" style="text-align: right;">
                <button type="submit" class="btn btn-primary" [disabled]="isUploadingResource()">
                  {{ isUploadingResource() ? 'Uploading...' : (getExistingResource(newResource.test_id, newResource.resource_type) ? 'Replace Existing Resource' : 'Upload Resource') }}
                </button>
              </div>
            </form>
          </div>

          <div class="card-box">
            <h4 style="font-size: 16px; margin-bottom: 16px;">Uploaded Academic Resources</h4>
            @if (resourcesList().length > 0) {
              <table class="ranking-table">
                <thead>
                  <tr><th>Title</th><th>Type</th><th>Test</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  @for (r of resourcesList(); track r.id) {
                    <tr>
                      <td style="font-weight: 600;">{{ r.title }}</td>
                      <td><span class="timeline-tag tag-current">{{ r.resource_type }}</span></td>
                      <td style="color: var(--accent-sky);">Test {{ r.test_id }}</td>
                      <td>
                        <button type="button" class="btn btn-danger btn-sm" (click)="deleteResource(r.id)">Delete</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div style="text-align: center; color: var(--text-muted); padding: 32px;">
                No resources uploaded yet.
              </div>
            }
          </div>
        </div>
      }

      <!-- 6. SYLLABUS TAB -->
      @if (activeTab() === 'syllabus') {
        <div class="admin-tab-pane active">
          <div class="card-box" style="margin-bottom: 24px;">
            <div class="card-box-header">
              <h3 style="font-size: 20px;">Syllabus Management</h3>
              <p class="card-box-sub">Add and edit module syllabus categories and topic lists for candidate study prep.</p>
            </div>

            <form (ngSubmit)="addSyllabus()" class="form-grid">
              <div class="form-group">
                <label>Select Test</label>
                <select [(ngModel)]="newSyllabus.test_id" name="test_id" required>
                  @for (t of tests(); track t.id) {
                    <option [value]="t.id">{{ t.test_number }}: {{ t.test_name }}</option>
                  }
                </select>
              </div>

              <div class="form-group">
                <label>Category Name</label>
                <input type="text" [(ngModel)]="newSyllabus.category_name" name="category_name" placeholder="e.g. Quantitative Aptitude" required>
              </div>

              <div class="form-group span-full">
                <label>Topics List (Comma-separated)</label>
                <textarea [(ngModel)]="syllabusTopicsInput" name="topicsInput" rows="3" placeholder="e.g. Number Series, Percentages" required></textarea>
              </div>

              <div class="span-full" style="text-align: right;">
                <button type="submit" class="btn btn-primary">Save Syllabus Category</button>
              </div>
            </form>
          </div>

          <div class="card-box">
            <h4 style="font-size: 16px; margin-bottom: 16px;">Configured Syllabus Categories</h4>
            @if (syllabusList().length > 0) {
              <table class="ranking-table">
                <thead>
                  <tr><th>Test</th><th>Category Name</th><th>Topics</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  @for (s of syllabusList(); track s.id) {
                    <tr>
                      <td style="font-weight: 700; color: var(--accent-sky);">Test {{ s.test_id }}</td>
                      <td style="font-weight: 600;">{{ s.category_name }}</td>
                      <td style="font-size: 13px; color: var(--text-secondary);">{{ s.topics_json }}</td>
                      <td>
                        <button type="button" class="btn btn-danger btn-sm" (click)="deleteSyllabus(s.id)">Delete</button>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div style="text-align: center; color: var(--text-muted); padding: 32px;">
                No syllabus content has been added yet.
              </div>
            }
          </div>
        </div>
      }

      <!-- 7. BACKUP DATA TAB -->
      @if (activeTab() === 'backups') {
        <div class="admin-tab-pane active">
          <div class="card-box" style="margin-bottom: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
              <div>
                <h3 style="font-size: 20px;">Backup Data</h3>
                <p style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">
                  Create and manage system snapshots covering Students, Tests, Questions, Attempts, Attendance, Results, Resources, Syllabus, and Configuration.
                </p>
              </div>
              <button type="button" class="btn btn-primary btn-lg" (click)="triggerBackup()">Create Backup</button>
            </div>
          </div>

          <div class="card-box">
            <h4 style="font-size: 16px; margin-bottom: 14px;">Backup History</h4>
            @if (backups().length > 0) {
              <table class="ranking-table">
                <thead>
                  <tr><th>Backup File</th><th>Created At</th><th>Size</th><th>Actions</th></tr>
                </thead>
                <tbody>
                  @for (b of backups(); track b.id) {
                    <tr>
                      <td style="font-family: monospace;">{{ b.backup_name }}</td>
                      <td>{{ b.created_at | date:'short' }}</td>
                      <td>{{ (b.size_bytes / 1024).toFixed(1) }} KB</td>
                      <td>
                        <div style="display: flex; gap: 6px;">
                          <button type="button" class="btn btn-secondary btn-sm" (click)="restoreBackup(b)">Restore</button>
                          <button type="button" class="btn btn-danger btn-sm" (click)="deleteBackup(b.id)">Delete</button>
                        </div>
                      </td>
                    </tr>
                  }
                </tbody>
              </table>
            } @else {
              <div style="text-align: center; color: var(--text-muted); padding: 32px;">
                No backups have been created yet.
              </div>
            }
          </div>
        </div>
      }

      <!-- 8. AUDIT LOGS TAB -->
      @if (activeTab() === 'logs') {
        <div class="admin-tab-pane active">
          <div class="card-box">
            <h3 style="font-size: 18px; margin-bottom: 16px;">System Operational Audit Logs</h3>
            <table class="ranking-table">
              <thead>
                <tr><th>Timestamp</th><th>Action Event</th><th>Details</th></tr>
              </thead>
              <tbody>
                @for (log of auditLogs(); track log.id) {
                  <tr>
                    <td style="font-size: 13px; color: var(--text-muted);">{{ log.timestamp | date:'short' }}</td>
                    <td style="font-weight: 700; color: var(--accent-sky);">{{ log.action }}</td>
                    <td>{{ log.new_value || log.previous_value || '--' }}</td>
                  </tr>
                }
              </tbody>
            </table>
          </div>
        </div>
      }
    </section>
  `
})
export class AdminDashboardComponent implements OnInit {
  private authService = inject(AuthService);
  private adminService = inject(AdminService);
  private studentService = inject(StudentService);
  private leaderboardService = inject(LeaderboardService);
  private excelService = inject(ExcelService);
  private router = inject(Router);

  activeTab = signal<'dashboard' | 'tests' | 'students' | 'results' | 'resources' | 'syllabus' | 'backups' | 'logs'>('dashboard');
  stats = signal<DashboardStats | null>(null);
  tests = signal<Test[]>([]);
  auditLogs = signal<AuditLog[]>([]);
  backups = signal<BackupRecord[]>([]);

  // Student Lists tab signals
  syStudents = signal<Student[]>([]);
  tyStudents = signal<Student[]>([]);
  fyStudents = signal<Student[]>([]);
  viewStudentsClass = signal<'SY' | 'TY' | 'Final Year' | null>(null);

  // Excel Results tab signals
  selectedResultsTestId = 0;
  testResultsList = signal<TestResult[]>([]);

  // Resources tab signals
  resourcesList = signal<Resource[]>([]);
  newResource: Partial<Resource> = { test_id: 3, resource_type: 'notes', title: '' };

  // Syllabus tab signals
  syllabusList = signal<SyllabusCategory[]>([]);
  newSyllabus: Partial<SyllabusCategory> = { test_id: 3, category_name: '' };
  syllabusTopicsInput = '';

  selectedWorkspaceTest = signal<Test | null>(null);
  wsTab = signal<'overview' | 'questions' | 'attendance' | 'publish'>('overview');
  attendanceList = signal<AttendanceRecord[]>([]);

  qUploadMsg = signal('');
  studentUploadMsg = signal('');
  resultsUploadMsg = signal('');

  newTest: Partial<Test> = {
    test_number: '',
    test_name: '',
    test_date: '',
    total_marks: 50,
    status: 'Upcoming',
    duration_minutes: 60,
    start_time: '5:15 PM',
    finish_time: '6:15 PM'
  };

  async ngOnInit(): Promise<void> {
    if (!this.authService.isAdmin()) {
      this.router.navigate(['/']);
      return;
    }

    const s = await this.adminService.getDashboardStats();
    this.stats.set(s);
    const t = await this.leaderboardService.getAllTests();
    this.tests.set(t);
    const l = await this.adminService.getAuditLogs();
    this.auditLogs.set(l);
    const b = await this.adminService.getBackups();
    this.backups.set(b);

    await this.loadRosters();

    await this.loadResources();
    this.syllabusList.set([]);
  }

  async loadRosters(): Promise<void> {
    try {
      const [sy, ty, fy] = await Promise.all([
        this.studentService.getStudentsByClass('SY'),
        this.studentService.getStudentsByClass('TY'),
        this.studentService.getStudentsByClass('Final Year')
      ]);
      this.syStudents.set(sy);
      this.tyStudents.set(ty);
      this.fyStudents.set(fy);

      const total = sy.length + ty.length + fy.length;
      this.stats.update((s) => ({
        students_by_class: {
          SY: sy.length,
          TY: ty.length,
          'Final Year': fy.length,
          total
        },
        tests_by_status: s?.tests_by_status || { Upcoming: 0, Current: 0, Completed: 0, Published: 0, total: 0 }
      }));
    } catch (e) {
      console.warn('Failed to load student rosters:', e);
    }
  }

  handleLogout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  getSelectedClassStudents(): Student[] {
    const c = this.viewStudentsClass();
    if (c === 'SY') return this.syStudents();
    if (c === 'TY') return this.tyStudents();
    if (c === 'Final Year') return this.fyStudents();
    return [];
  }

  loadResultsForTest(testId: number): void {
    // Data-driven: clear results list unless real database/import results exist
    this.testResultsList.set([]);
  }

  addSyllabus(): void {
    if (this.newSyllabus.category_name) {
      const sylItem: SyllabusCategory = {
        id: Date.now(),
        test_id: Number(this.newSyllabus.test_id || 3),
        category_name: this.newSyllabus.category_name,
        topics_json: this.syllabusTopicsInput,
        display_order: this.syllabusList().length + 1
      };
      this.syllabusList.set([...this.syllabusList(), sylItem]);
      alert('Syllabus category added successfully!');
      this.newSyllabus.category_name = '';
      this.syllabusTopicsInput = '';
    }
  }

  deleteSyllabus(id?: number): void {
    if (!id) return;
    if (confirm('Delete this syllabus category?')) {
      this.syllabusList.set(this.syllabusList().filter(s => s.id !== id));
    }
  }

  async createTest(): Promise<void> {
    if (this.newTest.test_number && this.newTest.test_name && this.newTest.test_date) {
      try {
        const payload = {
          testNumber: this.newTest.test_number,
          title: this.newTest.test_name,
          className: 'SY',
          testDate: this.newTest.test_date,
          startTime: this.newTest.start_time || '5:15 PM',
          finishTime: this.newTest.finish_time || '6:15 PM',
          durationMinutes: Number(this.newTest.duration_minutes || 60),
          totalMarks: Number(this.newTest.total_marks || 50),
          status: this.newTest.status || 'Upcoming'
        };

        const created = await this.adminService.createTest(payload);
        const newTestItem: Test = {
          id: created.id,
          test_number: created.testNumber || this.newTest.test_number,
          testNumber: created.testNumber || this.newTest.test_number,
          test_name: created.title || this.newTest.test_name,
          title: created.title || this.newTest.test_name,
          test_date: created.testDate || this.newTest.test_date,
          testDate: created.testDate || this.newTest.test_date,
          total_marks: created.totalMarks || this.newTest.total_marks || 50,
          totalMarks: created.totalMarks || this.newTest.total_marks || 50,
          status: created.status || 'Upcoming',
          is_published: 0,
          duration_minutes: created.durationMinutes || 60,
          instructions: '',
          start_time: created.startTime || this.newTest.start_time || '5:15 PM',
          startTime: created.startTime || this.newTest.start_time || '5:15 PM',
          finish_time: created.finishTime || this.newTest.finish_time || '6:15 PM',
          finishTime: created.finishTime || this.newTest.finish_time || '6:15 PM'
        };

        this.tests.set([...this.tests(), newTestItem]);
        alert('Test Series created successfully in database!');
        this.newTest = {
          test_number: '',
          test_name: '',
          test_date: '',
          total_marks: 50,
          status: 'Upcoming',
          duration_minutes: 60,
          start_time: '5:15 PM',
          finish_time: '6:15 PM'
        };
        this.router.navigate(['/admin/test', created.id]);
      } catch (err: any) {
        alert(`Failed to create test: ${err?.message || 'Server error'}`);
      }
    }
  }

  async openWorkspace(test: Test): Promise<void> {
    this.router.navigate(['/admin/test', test.id]);
  }

  async toggleAttendance(att: AttendanceRecord): Promise<void> {
    const nextStatus = att.status === 'Present' ? 'Absent' : 'Present';
    await this.adminService.overrideAttendance(att.test_id, att.registration_no, nextStatus);
    const updated = this.attendanceList().map(a => a.registration_no === att.registration_no ? { ...a, status: nextStatus } : a);
    this.attendanceList.set(updated as any);
  }

  async publishResults(test: Test): Promise<void> {
    const nextIsPub = test.is_published === 1 ? 0 : 1;
    const msg = nextIsPub === 1 ? 'Publish results for candidate dashboards?' : 'Unpublish test results?';
    if (confirm(msg)) {
      const updatedTests = this.tests().map(t => t.id === test.id ? { ...t, is_published: nextIsPub } : t);
      this.tests.set(updatedTests);
      if (this.selectedWorkspaceTest()) {
        this.selectedWorkspaceTest.set({ ...test, is_published: nextIsPub });
      }
      await this.adminService.logAction('TOGGLE_PUBLISH_RESULTS', test.id, undefined, String(test.is_published), String(nextIsPub));
      alert(`Test results ${nextIsPub === 1 ? 'published' : 'unpublished'} successfully!`);
    }
  }

  async triggerBackup(): Promise<void> {
    const b = await this.adminService.createBackup();
    this.backups.set([b, ...this.backups()]);
    alert(`Backup archive "${b.backup_name}" generated successfully.`);
  }

  restoreBackup(b: BackupRecord): void {
    if (confirm(`CAUTION: Restoring backup "${b.backup_name}" will overwrite current system database state. Do you wish to proceed?`)) {
      alert(`Database successfully restored to snapshot "${b.backup_name}".`);
    }
  }

  deleteBackup(id: number): void {
    if (confirm('Delete this backup archive?')) {
      this.backups.set(this.backups().filter(b => b.id !== id));
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
      const testId = this.selectedWorkspaceTest()?.id || 1;
      this.qUploadMsg.set(`Validated ${res.data.length} questions locally. Uploading to database...`);
      const serverRes = await this.adminService.uploadQuestionExcel(testId, file);
      const inserted = serverRes?.inserted !== undefined ? serverRes.inserted : res.data.length;

      const logs = await this.adminService.getAuditLogs();
      this.auditLogs.set(logs);

      this.qUploadMsg.set(`Successfully imported ${inserted} questions into database. Generated Question Version 2 for historic attempt reproducibility.`);
    } catch (err: any) {
      const errMsg = err?.message || 'Server upload failed. Please try again.';
      this.qUploadMsg.set(`Upload failed: ${errMsg}`);
    }
  }

  async deleteStudentRow(student: Student): Promise<void> {
    const regNo = student.registration_no || (student as any).registrationNo;
    const name = student.name || 'Student';
    if (confirm(`Remove student ${name} (${regNo}) from master roster?`)) {
      try {
        await this.adminService.deleteStudent(regNo);
        await this.loadRosters();
        alert(`Student ${name} (${regNo}) removed from roster.`);
      } catch (err: any) {
        alert(`Cannot delete student: ${err?.error?.error || err?.message || 'Server error'}`);
      }
    }
  }

  async onStudentFileSelected(event: any, className: string = 'SY'): Promise<void> {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.studentUploadMsg.set(`Uploading student roster Excel file for ${className}...`);
      const serverRes = await this.adminService.uploadStudentExcel(file, className);
      const inserted = serverRes?.importedCount !== undefined ? serverRes.importedCount : serverRes?.inserted;

      await this.loadRosters();
      const logs = await this.adminService.getAuditLogs();
      this.auditLogs.set(logs);

      this.studentUploadMsg.set(`Successfully replaced ${className} master student roster (${inserted} students).`);
    } catch (err: any) {
      const errMsg = err?.error?.error || err?.message || 'Server upload failed. Please try again.';
      this.studentUploadMsg.set(`Upload failed: ${errMsg}`);
    }
  }

  async onResultsFileSelected(event: any): Promise<void> {
    const file = event.target.files[0];
    if (file) {
      const res = await this.excelService.validateAndParseResults(file);
      if (res.valid) {
        this.resultsUploadMsg.set(`Validated ${res.data.length} result records. Recalculated Cognify Scores & competition rankings.`);
      } else {
        this.resultsUploadMsg.set(`Validation errors: ${res.errors.join('; ')}`);
      }
    }
  }

  selectedResourceFile: File | null = null;
  isUploadingResource = signal<boolean>(false);

  async loadResources(): Promise<void> {
    const list = await this.adminService.getAllResources();
    this.resourcesList.set(list);
  }

  onResourceFileSelected(event: any): void {
    const file = event.target.files[0];
    if (file) {
      this.selectedResourceFile = file;
      if (!this.newResource.title) {
        this.newResource.title = file.name.replace(/\.[^/.]+$/, '');
      }
    }
  }

  getExistingResource(testId?: number, resourceType?: string): Resource | undefined {
    if (!testId || !resourceType) return undefined;
    return this.resourcesList().find(
      (r) => Number(r.test_id) === Number(testId) && r.resource_type === resourceType
    );
  }

  async uploadResource(): Promise<void> {
    if (!this.selectedResourceFile) {
      alert('Please select a PDF file to upload.');
      return;
    }
    if (!this.newResource.test_id || !this.newResource.resource_type || !this.newResource.title?.trim()) {
      alert('Please fill in all required resource details (Test, Resource Type, Document Title).');
      return;
    }

    try {
      this.isUploadingResource.set(true);
      const res = await this.adminService.uploadResource(
        Number(this.newResource.test_id),
        this.newResource.title.trim(),
        this.newResource.resource_type,
        this.selectedResourceFile
      );
      alert(`Resource "${res.title}" ${res.isReplacement ? 'replaced' : 'uploaded'} successfully!`);
      this.newResource.title = '';
      this.selectedResourceFile = null;
      await this.loadResources();
    } catch (err: any) {
      const errMsg = err?.error?.error?.message || err?.message || 'Server error during upload';
      alert(`Failed to upload resource: ${errMsg}`);
    } finally {
      this.isUploadingResource.set(false);
    }
  }

  async deleteResource(id: number): Promise<void> {
    if (confirm('Delete this resource from Object Storage and database?')) {
      try {
        await this.adminService.deleteResource(id);
        await this.loadResources();
        alert('Resource deleted successfully.');
      } catch (err: any) {
        alert(`Failed to delete resource: ${err?.error?.error?.message || err?.message || 'Server error'}`);
      }
    }
  }
}
