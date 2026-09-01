import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SupabaseService } from './supabase.service';

export interface StorageUploadResponse {
  success: boolean;
  resource_id?: number;
  storage_path: string;
  file_path: string;
  message: string;
}

export interface SignedUrlResponse {
  success: boolean;
  signed_url: string;
  title: string;
}

@Injectable({
  providedIn: 'root'
})
export class StorageService {
  private http = inject(HttpClient);
  private supabase = inject(SupabaseService);

  /**
   * Upload resource file to Supabase Storage backend endpoint.
   */
  uploadResource(testId: number, resourceType: string, title: string, file: File): Observable<StorageUploadResponse> {
    const formData = new FormData();
    formData.append('test_id', testId.toString());
    formData.append('resource_type', resourceType);
    formData.append('title', title);
    formData.append('file', file, file.name);

    return this.http.post<StorageUploadResponse>('/api/admin/resources/upload', formData);
  }

  /**
   * Get short-lived signed URL for private file access.
   */
  getSignedUrl(resourceId: number): Observable<SignedUrlResponse> {
    return this.http.get<SignedUrlResponse>(`/api/resources/${resourceId}/download`, {
      headers: { Accept: 'application/json' }
    });
  }

  /**
   * Directly upload file to Supabase Storage bucket client-side.
   */
  async uploadToBucket(bucket: string, path: string, file: File): Promise<string | null> {
    const { data, error } = await this.supabase.client.storage
      .from(bucket)
      .upload(path, file, { upsert: true });

    if (error) {
      console.error(`Supabase Storage upload error [${bucket}]:`, error);
      return null;
    }

    return data.path;
  }
}
