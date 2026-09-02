import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface SyllabusItem {
  id: number;
  class_id?: number;
  test_id: number;
  category_name: string;
  title?: string;
  content?: string;
  topics: string[];
  display_order: number;
}

@Injectable({
  providedIn: 'root'
})
export class SyllabusService {
  constructor(private api: ApiService) {}

  async getSyllabusForTest(testId: number): Promise<SyllabusItem[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>('/syllabus', { testId }));
      if (res && Array.isArray(res)) {
        return res.map((s) => {
          let topics: string[] = [];
          if (Array.isArray(s.topics)) {
            topics = s.topics;
          } else if (typeof s.topics_json === 'string') {
            try {
              topics = JSON.parse(s.topics_json);
            } catch (e) {
              topics = s.topics_json.split(/[\n,]+/).map((t: string) => t.trim()).filter(Boolean);
            }
          }
          return {
            id: s.id,
            class_id: s.classId || s.class_id,
            test_id: s.testId || s.test_id || testId,
            category_name: s.categoryName || s.category_name || s.title || 'General Category',
            title: s.title || s.categoryName || '',
            content: s.content || '',
            topics,
            display_order: s.displayOrder || s.display_order || 0
          };
        });
      }
    } catch (e) {
      console.warn(`Failed to fetch syllabus for test ${testId}:`, e);
    }
    return [];
  }

  async getAllSyllabus(): Promise<SyllabusItem[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>('/syllabus'));
      if (res && Array.isArray(res)) {
        return res.map((s) => {
          let topics: string[] = [];
          if (Array.isArray(s.topics)) {
            topics = s.topics;
          } else if (typeof s.topics_json === 'string') {
            try {
              topics = JSON.parse(s.topics_json);
            } catch (e) {
              topics = s.topics_json.split(/[\n,]+/).map((t: string) => t.trim()).filter(Boolean);
            }
          }
          return {
            id: s.id,
            class_id: s.classId || s.class_id,
            test_id: s.testId || s.test_id || 0,
            category_name: s.categoryName || s.category_name || s.title || 'General Category',
            title: s.title || s.categoryName || '',
            content: s.content || '',
            topics,
            display_order: s.displayOrder || s.display_order || 0
          };
        });
      }
    } catch (e) {
      console.warn('Failed to fetch all syllabus entries:', e);
    }
    return [];
  }
}
