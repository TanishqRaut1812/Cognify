import { Injectable, signal } from '@angular/core';
import { SupabaseService } from './supabase.service';
import { StudentScore, Test, SyllabusCategory, Resource } from '../models/cognify.models';

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

  constructor(private supabase: SupabaseService) {}

  async getTop10Rankings(): Promise<{ [key: string]: StudentScore[] }> {
    const grouped: { [key: string]: StudentScore[] } = { SY: [], TY: [], 'Final Year': [] };
    try {
      const { data } = await this.supabase.supabase
        .from('student_scores')
        .select('*, students(roll_no, name)')
        .lte('rank', 10)
        .gt('cognify_score', 0)
        .order('rank', { ascending: true });

      if (data && data.length > 0) {
        data.forEach((row: any) => {
          const c = row.class_name;
          if (!grouped[c]) grouped[c] = [];
          grouped[c].push({
            registration_no: row.registration_no,
            student_name: row.students?.name || 'Student',
            roll_no: row.students?.roll_no || '--',
            cognify_score: row.cognify_score,
            completed_tests_count: row.completed_tests_count,
            rank: row.rank,
            class_name: c
          });
        });
      }
    } catch (e) {
      console.warn('Could not load leaderboard rankings from Supabase:', e);
    }
    return grouped;
  }

  async getFullRankings(className: string): Promise<StudentScore[]> {
    try {
      const { data } = await this.supabase.supabase
        .from('student_scores')
        .select('*, students(roll_no, name)')
        .eq('class_name', className)
        .order('rank', { ascending: true });

      if (data && data.length > 0) {
        return data.map((row: any) => ({
          registration_no: row.registration_no,
          student_name: row.students?.name || 'Student',
          roll_no: row.students?.roll_no || '--',
          cognify_score: row.cognify_score,
          completed_tests_count: row.completed_tests_count,
          rank: row.rank,
          class_name: className
        }));
      }
    } catch (e) {}

    return [];
  }

  async getTimeline(): Promise<TimelineData> {
    try {
      const { data } = await this.supabase.supabase.from('tests').select('*').order('test_date', { ascending: true });
      if (data && data.length > 0) {
        const previous = data.filter((t: Test) => t.status === 'Completed').pop() || null;
        const current = data.find((t: Test) => t.status === 'Current') || null;
        const next = data.find((t: Test) => t.status === 'Upcoming') || null;
        return { previous, current, next };
      }
    } catch (e) {}

    return { previous: null, current: null, next: null };
  }

  async getAllTests(): Promise<Test[]> {
    try {
      const { data } = await this.supabase.supabase.from('tests').select('*').order('test_date', { ascending: true });
      if (data && data.length > 0) return data;
    } catch (e) {}
    return [];
  }

  async getCurrentPrep(): Promise<CurrentPrepData> {
    const timeline = await this.getTimeline();
    const current = timeline.current;

    let categories: { id: number; category_name: string; topics: string[] }[] = [];
    let resources: Resource[] = [];

    if (current) {
      try {
        const { data: catData } = await this.supabase.supabase
          .from('syllabus')
          .select('*')
          .eq('test_id', current.id);

        if (catData) {
          categories = catData.map((c: any) => ({
            id: c.id,
            category_name: c.category_name,
            topics: typeof c.topics === 'string' ? c.topics.split(',').map((t: string) => t.trim()) : (c.topics || [])
          }));
        }

        const { data: resData } = await this.supabase.supabase
          .from('resources')
          .select('*')
          .eq('test_id', current.id);

        if (resData) {
          resources = resData.map((r: any) => ({
            id: r.id,
            test_id: r.test_id,
            resource_type: r.resource_type,
            title: r.title,
            file_path: r.file_path,
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
