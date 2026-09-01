import { Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from './api.service';

const ADMIN_TOKEN_KEY = 'cognify_admin_jwt_token';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  isAdmin = signal<boolean>(Boolean(this.getAdminToken()));

  constructor(private api: ApiService) {
    this.verifyAdminState();
  }

  getAdminToken(): string | null {
    try {
      return localStorage.getItem(ADMIN_TOKEN_KEY);
    } catch (e) {
      return null;
    }
  }

  private setAdminToken(token: string | null): void {
    try {
      if (token) {
        localStorage.setItem(ADMIN_TOKEN_KEY, token);
        this.isAdmin.set(true);
      } else {
        localStorage.removeItem(ADMIN_TOKEN_KEY);
        this.isAdmin.set(false);
      }
    } catch (e) {}
  }

  async verifyAdminState(): Promise<boolean> {
    const token = this.getAdminToken();
    if (!token) {
      this.isAdmin.set(false);
      return false;
    }

    try {
      const res = await firstValueFrom(this.api.get<{ authenticated: boolean }>('/admin/auth/me'));
      const authenticated = res && res.authenticated;
      this.isAdmin.set(authenticated);
      if (!authenticated) {
        this.setAdminToken(null);
      }
      return authenticated;
    } catch (e) {
      this.setAdminToken(null);
      return false;
    }
  }

  async login(password: string): Promise<{ success: boolean; message: string }> {
    try {
      const res = await firstValueFrom(
        this.api.post<{ token: string; role: string; message: string }>('/admin/auth/login', { password })
      );

      if (res && res.token) {
        this.setAdminToken(res.token);
        return { success: true, message: res.message || 'Authenticated successfully.' };
      }
    } catch (e: any) {
      return { success: false, message: e.message || 'Incorrect password. Please try again.' };
    }
    return { success: false, message: 'Admin login failed.' };
  }

  async logout(): Promise<void> {
    try {
      await firstValueFrom(this.api.post('/admin/auth/logout'));
    } catch (e) {}
    this.setAdminToken(null);
  }
}
