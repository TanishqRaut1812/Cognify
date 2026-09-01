import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';
import { StudentScore, Test, Resource } from '../models/cognify.models';

export interface TimelineData {
  previous: Test | null;
  current: Test | null;
  next: Test | null;
}

export interface CurrentPrepData {
  test: Test | null;
  categories: { id: number; category_name: string; topics: string[] }[];
  resources: Resource[];
}

@Injectable({
  providedIn: 'root'
})
export class LeaderboardService {
  top10Rankings = signal<{ [key: string]: StudentScore[] }>({ SY: [], TY: [], 'Final Year': [] });
  lastUpdated = signal<string>('');

  constructor(private api: ApiService) {}

  async getTop10Rankings(): Promise<{ [key: string]: StudentScore[] }> {
    const grouped: { [key: string]: StudentScore[] } = { SY: [], TY: [], 'Final Year': [] };
    const classes = ['SY', 'TY', 'Final Year'];

    for (const cName of classes) {
      try {
        const res = await firstValueFrom(this.api.get<any[]>('/leaderboard', { class: cName }));
        if (res && Array.isArray(res)) {
          grouped[cName] = res.map((r) => ({
            registration_no: r.registrationNo || r.reg || '',
            student_name: r.name || r.studentName || 'Student',
            roll_no: r.rollNo || '--',
            cognify_score: r.overallPercentage !== undefined ? r.overallPercentage : r.pct,
            completed_tests_count: r.completedTestsCount || 1,
            rank: r.rank,
            class_name: cName
          }));
        }
      } catch (e) {
        console.warn(`Failed to fetch leaderboard for class ${cName}:`, e);
      }
    }
    return grouped;
  }

  async getFullRankings(className: string): Promise<StudentScore[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>('/leaderboard', { class: className }));
      if (res && Array.isArray(res)) {
        return res.map((r) => ({
          registration_no: r.registrationNo || r.reg || '',
          student_name: r.name || r.studentName || 'Student',
          roll_no: r.rollNo || '--',
          cognify_score: r.overallPercentage !== undefined ? r.overallPercentage : r.pct,
          completed_tests_count: r.completedTestsCount || 1,
          rank: r.rank,
          class_name: className
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch full rankings for ${className}:`, e);
    }
    return [];
  }

  async getTimeline(): Promise<TimelineData> {
    try {
      const tests = await firstValueFrom(this.api.get<Test[]>('/tests'));
      if (tests && tests.length > 0) {
        const previous = tests.filter((t: Test) => t.status === 'Completed').pop() || null;
        const current = tests.find((t: Test) => t.status === 'Current') || null;
        const next = tests.find((t: Test) => t.status === 'Upcoming') || null;
        return { previous, current, next };
      }
    } catch (e) {}
    return { previous: null, current: null, next: null };
  }

  async getAllTests(): Promise<Test[]> {
    try {
      const tests = await firstValueFrom(this.api.get<Test[]>('/tests'));
      return tests || [];
    } catch (e) {
      return [];
    }
  }

  async getCurrentPrep(): Promise<CurrentPrepData> {
    const timeline = await this.getTimeline();
    const current = timeline.current;

    let categories: { id: number; category_name: string; topics: string[] }[] = [];
    let resources: Resource[] = [];

    if (current) {
      try {
        const sRes = await firstValueFrom(this.api.get<any[]>('/syllabus', { testId: current.id }));
        if (sRes) {
          categories = sRes.map((c) => ({
            id: c.id,
            category_name: c.categoryName || c.category_name || '',
            topics: Array.isArray(c.topics) ? c.topics : (c.topics || '').split(',')
          }));
        }

        const rRes = await firstValueFrom(this.api.get<any[]>('/resources', { testId: current.id }));
        if (rRes) {
          resources = rRes.map((r) => ({
            id: r.id,
            test_id: r.testId || r.test_id,
            resource_type: r.type || r.resource_type,
            title: r.title,
            file_path: r.storagePath || r.file_path,
            accessible: true
          }));
        }
      } catch (e) {}
    }

    return {
      test: current,
      categories,
      resources
    };
  }
}
