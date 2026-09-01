import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface Resource {
  id: number;
  test_id?: number;
  class_id?: number;
  resource_type: 'notes' | 'practice' | 'question_paper' | 'answer_key';
  title: string;
  storage_path: string;
  visibility: 'public' | 'completed_only' | 'admin_only';
}

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(private api: ApiService) {}

  async getPublicResources(testId: number): Promise<Resource[]> {
    try {
      const res = await firstValueFrom(this.api.get<any[]>('/resources', { testId }));
      if (res && Array.isArray(res)) {
        return res.map((r) => ({
          id: r.id,
          test_id: r.testId,
          class_id: r.classId,
          resource_type: r.type || r.resource_type || 'notes',
          title: r.title,
          storage_path: r.storagePath || r.file_path || '',
          visibility: 'public'
        }));
      }
    } catch (e) {
      console.warn(`Failed to fetch resources for test ${testId}:`, e);
    }
    return [];
  }
}
