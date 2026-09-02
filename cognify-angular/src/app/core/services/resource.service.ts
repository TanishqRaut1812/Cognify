import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

export interface ResourceStatusMap {
  testId: number;
  testStatus: string;
  isCompleted: boolean;
  resources: {
    notes: { exists: boolean; resourceId?: number; title?: string; isLocked: boolean };
    practice: { exists: boolean; resourceId?: number; title?: string; isLocked: boolean };
    question_paper: { exists: boolean; resourceId?: number; title?: string; isLocked: boolean };
    answer_key: { exists: boolean; resourceId?: number; title?: string; isLocked: boolean };
  };
}

export interface ResourceDownloadResult {
  downloadUrl: string;
  title: string;
  resourceType: string;
}

@Injectable({
  providedIn: 'root'
})
export class ResourceService {
  constructor(private api: ApiService) {}

  async getTestResourceStatus(testId: number): Promise<ResourceStatusMap | null> {
    try {
      const res = await firstValueFrom(this.api.get<ResourceStatusMap>(`/tests/${testId}/resources-status`));
      return res;
    } catch (e) {
      console.warn(`Failed to fetch resource status for test ${testId}:`, e);
      return null;
    }
  }

  async getDownloadUrl(testId: number, resourceType: string): Promise<ResourceDownloadResult> {
    const res = await firstValueFrom(this.api.get<ResourceDownloadResult>(`/tests/${testId}/resources/${resourceType}/download`));
    return res;
  }
}
