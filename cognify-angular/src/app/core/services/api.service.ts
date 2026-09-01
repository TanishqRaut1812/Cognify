import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { Observable, throwError } from 'rxjs';
import { map, catchError } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { ApiResponse } from '../models/cognify.models';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private readonly baseUrl = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  get<T>(path: string, params?: Record<string, any>, headers?: Record<string, string>): Observable<T> {
    let httpParams = new HttpParams();
    if (params) {
      Object.keys(params).forEach((key) => {
        if (params[key] !== undefined && params[key] !== null) {
          httpParams = httpParams.set(key, String(params[key]));
        }
      });
    }

    let httpHeaders = new HttpHeaders();
    if (headers) {
      Object.keys(headers).forEach((key) => {
        httpHeaders = httpHeaders.set(key, headers[key]);
      });
    }

    return this.http
      .get<ApiResponse<T>>(`${this.baseUrl}${path}`, {
        params: httpParams,
        headers: httpHeaders,
        withCredentials: true
      })
      .pipe(
        map((res) => (res && res.data !== undefined ? res.data : (res as any))),
        catchError(this.handleError)
      );
  }

  post<T>(path: string, body?: any, headers?: Record<string, string>): Observable<T> {
    let httpHeaders = new HttpHeaders();
    if (headers) {
      Object.keys(headers).forEach((key) => {
        httpHeaders = httpHeaders.set(key, headers[key]);
      });
    }

    return this.http
      .post<ApiResponse<T>>(`${this.baseUrl}${path}`, body, {
        headers: httpHeaders,
        withCredentials: true
      })
      .pipe(
        map((res) => (res && res.data !== undefined ? res.data : (res as any))),
        catchError(this.handleError)
      );
  }

  put<T>(path: string, body?: any, headers?: Record<string, string>): Observable<T> {
    let httpHeaders = new HttpHeaders();
    if (headers) {
      Object.keys(headers).forEach((key) => {
        httpHeaders = httpHeaders.set(key, headers[key]);
      });
    }

    return this.http
      .put<ApiResponse<T>>(`${this.baseUrl}${path}`, body, {
        headers: httpHeaders,
        withCredentials: true
      })
      .pipe(
        map((res) => (res && res.data !== undefined ? res.data : (res as any))),
        catchError(this.handleError)
      );
  }

  delete<T>(path: string, headers?: Record<string, string>): Observable<T> {
    let httpHeaders = new HttpHeaders();
    if (headers) {
      Object.keys(headers).forEach((key) => {
        httpHeaders = httpHeaders.set(key, headers[key]);
      });
    }

    return this.http
      .delete<ApiResponse<T>>(`${this.baseUrl}${path}`, {
        headers: httpHeaders,
        withCredentials: true
      })
      .pipe(
        map((res) => (res && res.data !== undefined ? res.data : (res as any))),
        catchError(this.handleError)
      );
  }

  private handleError(error: any) {
    const errorMsg =
      error?.error?.error?.message ||
      error?.error?.message ||
      error?.message ||
      'An unexpected server error occurred';
    return throwError(() => new Error(errorMsg));
  }
}
