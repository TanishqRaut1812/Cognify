import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface StorageUploadResponse {
  success: boolean;
  resourceId?: number;
  storagePath: string;
  title: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private http = inject(HttpClient);
  private baseUrl = environment.apiBaseUrl;

  uploadQuestionPaper(testId: number, file: File): Observable<StorageUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<StorageUploadResponse>(
      `${this.baseUrl}/admin/tests/${testId}/question-paper`,
      formData,
      { withCredentials: true }
    );
  }

  uploadAnswerKey(testId: number, file: File): Observable<StorageUploadResponse> {
    const formData = new FormData();
    formData.append('file', file, file.name);

    return this.http.post<StorageUploadResponse>(
      `${this.baseUrl}/admin/tests/${testId}/answer-key`,
      formData,
      { withCredentials: true }
    );
  }
}
