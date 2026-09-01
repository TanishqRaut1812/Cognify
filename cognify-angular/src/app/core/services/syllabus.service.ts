import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface SyllabusItem {
  id: number;
  class_id?: number;
  test_id?: number;
  category_name: string;
  title: string;
  content: string;
  topics_json: string;
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
        return res.map((s) => ({
          id: s.id,
          class_id: s.classId,
          test_id: s.testId,
          category_name: s.categoryName || s.category_name || '',
          title: s.title || s.categoryName || '',
          content: s.content || '',
          topics_json: JSON.stringify(s.topics || []),
          display_order: s.displayOrder || 0
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch syllabus for test ${testId}:`, e);
    }
    return [];
  }
}
