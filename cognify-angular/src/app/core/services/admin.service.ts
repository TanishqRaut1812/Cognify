import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { DashboardStats, AttendanceRecord, AuditLog, BackupRecord, Student, SyllabusCategory, Resource } from '../models/cognify.models';

@Injectable({
  providedIn: 'root'
})
export class AdminService {
  constructor(private api: ApiService) {}

  async getDashboardStats(): Promise<DashboardStats> {
    try {
      const res = await firstValueFrom(this.api.get<any>('/admin/dashboard-stats'));
      if (res) {
        return {
          totalStudents: res.totalStudents,
          studentsByClass: res.studentsByClass,
          students_by_class: res.students_by_class,
          totalTests: res.totalTests,
          activeTests: res.activeTests,
          completedTests: res.completedTests,
          publishedTests: res.publishedTests,
          cheatingAttemptsCount: res.cheatingAttemptsCount,
          terminatedAttemptsCount: res.terminatedAttemptsCount,
          tests_by_status: res.tests_by_status
        };
      }
    } catch (e) {
      console.warn('Failed to fetch admin stats:', e);
    }

    return {
      students_by_class: { SY: 0, TY: 0, 'Final Year': 0, total: 0 },
      tests_by_status: { Upcoming: 0, Current: 0, Completed: 0, Published: 0, total: 0 }
    };
  }

  async getAttendance(testId: number): Promise<AttendanceRecord[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/admin/tests/${testId}/attendance`));
      if (res && Array.isArray(res)) {
        return res.map((r) => ({
          id: r.id,
          test_id: r.testId || testId,
          testId: r.testId || testId,
          registration_no: r.registrationNo,
          registrationNo: r.registrationNo,
          student_name: r.studentName,
          studentName: r.studentName,
          roll_no: r.rollNo || '--',
          rollNo: r.rollNo || '--',
          class_name: r.className || 'SY',
          className: r.className || 'SY',
          status: r.status,
          is_late_attempt: 0,
          updated_at: r.updatedAt
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch attendance for test ${testId}:`, e);
    }
    return [];
  }

  async overrideAttendance(testId?: number, target?: number | string, newStatus?: 'Present' | 'Absent'): Promise<void> {
    try {
      const tId = testId || 1;
      const regNo = String(target || '');
      if (!regNo) return;
      const status = newStatus || 'Present';
      await firstValueFrom(
        this.api.put(`/admin/tests/${tId}/attendance/${encodeURIComponent(regNo)}`, { status })
      );
    } catch (e) {
      console.warn('Failed to override attendance:', e);
    }
  }

  async bulkUpdateAttendance(testId: number, status: 'Present' | 'Absent'): Promise<void> {
    try {
      await firstValueFrom(this.api.post(`/admin/tests/${testId}/attendance/bulk`, { status }));
    } catch (e) {
      console.warn('Failed to bulk update attendance:', e);
    }
  }

  async logAction(action: string, testId?: number, regNo?: string, prevVal?: string, newVal?: string): Promise<void> {
    try {
      if (action === 'TOGGLE_PUBLISH_RESULTS' && testId) {
        if (newVal === '1') {
          await firstValueFrom(this.api.post(`/admin/tests/${testId}/publish`));
        } else {
          await firstValueFrom(this.api.post(`/admin/tests/${testId}/unpublish`));
        }
      }
    } catch (e) {
      console.warn('Failed to log admin action or update publish state:', e);
    }
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>('/admin/audit-logs'));
      if (res && Array.isArray(res)) {
        return res;
      }
    } catch (e) {}

    return [
      { id: 1, timestamp: new Date().toISOString(), action: 'SYSTEM_INIT', previous_value: '', new_value: 'System initialized' }
    ];
  }

  async getBackups(): Promise<BackupRecord[]> {
    return [
      { id: 1, backup_name: 'cognify_backup_2026_08_24.sql', created_at: new Date().toISOString(), file_path: '#', size_bytes: 420000 }
    ];
  }

  async createBackup(): Promise<BackupRecord> {
    const b: BackupRecord = {
      id: Date.now(),
      backup_name: `cognify_backup_${new Date().toISOString().slice(0, 10)}.sql`,
      created_at: new Date().toISOString(),
      file_path: '#',
      size_bytes: 512000
    };
    return b;
  }

  // TEST MANAGEMENT API
  async createTest(testData: any): Promise<any> {
    return await firstValueFrom(this.api.post<any>('/admin/tests', testData));
  }

  async getTestById(testId: number): Promise<any> {
    return await firstValueFrom(this.api.get<any>(`/admin/tests/${testId}`));
  }

  async updateTest(testId: number, testData: any): Promise<any> {
    return await firstValueFrom(this.api.put<any>(`/admin/tests/${testId}`, testData));
  }

  async deleteTest(testId: number): Promise<any> {
    return await firstValueFrom(this.api.delete<any>(`/admin/tests/${testId}`));
  }

  async publishTest(testId: number): Promise<any> {
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/publish`));
  }

  async unpublishTest(testId: number): Promise<any> {
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/unpublish`));
  }

  // QUESTION BANK API
  async getQuestionsForTest(testId: number): Promise<any[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/admin/tests/${testId}/questions`));
      return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn(`Failed to fetch questions for test ${testId}:`, e);
      return [];
    }
  }

  async createQuestion(testId: number, qData: any): Promise<any> {
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/questions`, qData));
  }

  async updateQuestion(questionId: number, qData: any): Promise<any> {
    return await firstValueFrom(this.api.put<any>(`/admin/questions/${questionId}`, qData));
  }

  async deleteQuestion(questionId: number): Promise<any> {
    return await firstValueFrom(this.api.delete<any>(`/admin/questions/${questionId}`));
  }

  // ATTEMPTS & RESULTS INSPECTION
  async getAttemptsForTest(testId: number): Promise<any[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/admin/tests/${testId}/attempts`));
      return Array.isArray(res) ? res : [];
    } catch (e) {
      console.warn(`Failed to fetch attempts for test ${testId}:`, e);
      return [];
    }
  }

  async getResultsForTest(testId: number): Promise<any[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/admin/tests/${testId}/results`));
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }

  async overrideResultScore(attemptId: number, score: number): Promise<any> {
    return await firstValueFrom(this.api.put<any>(`/admin/attempts/${attemptId}/score`, { score }));
  }

  // SYLLABUS MANAGEMENT API
  async getTestSyllabus(testId: number): Promise<any[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/syllabus?testId=${testId}`));
      return Array.isArray(res) ? res : [];
    } catch (e) {
      return [];
    }
  }

  async addSyllabusCategory(testId: number, categoryName: string, topics: string): Promise<any> {
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/syllabus`, { categoryName, topics }));
  }

  async deleteSyllabusCategory(syllabusId: number): Promise<any> {
    return await firstValueFrom(this.api.delete<any>(`/admin/syllabus/${syllabusId}`));
  }

  // RESOURCE MANAGEMENT API
  async getAllResources(): Promise<Resource[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>('/resources'));
      if (res && Array.isArray(res)) {
        return res.map((r) => ({
          id: r.id,
          test_id: r.testId || r.test_id,
          resource_type: r.resourceType || r.resource_type || 'notes',
          title: r.title,
          storage_path: r.filePath || r.file_path || '',
          visibility: 'public'
        }));
      }
    } catch (e) {
      console.warn('Failed to fetch resources:', e);
    }
    return [];
  }

  async getTestResources(testId: number): Promise<Resource[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>(`/resources?testId=${testId}`));
      if (res && Array.isArray(res)) {
        return res.map((r) => ({
          id: r.id,
          test_id: r.testId || r.test_id || testId,
          resource_type: r.resourceType || r.resource_type || 'notes',
          title: r.title,
          storage_path: r.filePath || r.file_path || '',
          visibility: 'public'
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch resources for test ${testId}:`, e);
    }
    return [];
  }

  async uploadResource(testId: number, title: string, resourceType: string, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('title', title);
    formData.append('resourceType', resourceType);
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/resources`, formData));
  }

  async uploadQuestionPaper(testId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/question-paper`, formData));
  }

  async uploadAnswerKey(testId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/answer-key`, formData));
  }

  async deleteResource(resourceId: number): Promise<any> {
    return await firstValueFrom(this.api.delete<any>(`/admin/resources/${resourceId}`));
  }

  // EXCEL IMPORT API
  async uploadQuestionExcel(testId: number, file: File): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    return await firstValueFrom(this.api.post<any>(`/admin/tests/${testId}/questions/import`, formData));
  }

  async uploadStudentExcel(file: File, className: string = 'SY'): Promise<any> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('className', className);
    return await firstValueFrom(this.api.post<any>('/admin/students/import', formData));
  }

  async deleteStudent(registrationNo: string): Promise<any> {
    return await firstValueFrom(this.api.delete<any>(`/admin/students/${encodeURIComponent(registrationNo)}`));
  }
}
