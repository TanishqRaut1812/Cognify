import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private readonly ADMIN_KEY = 'cognify_admin_session';
  isAdmin = signal<boolean>(this.checkInitialAdminState());

  private checkInitialAdminState(): boolean {
    return localStorage.getItem(this.ADMIN_KEY) === 'true';
  }

  login(password: string): { success: boolean; message: string } {
    if (password === 'CognifyAdmin2026!') {
      localStorage.setItem(this.ADMIN_KEY, 'true');
      this.isAdmin.set(true);
      return { success: true, message: 'Authenticated successfully.' };
    }
    return { success: false, message: 'Incorrect password. Please try again.' };
  }

  logout(): void {
    localStorage.removeItem(this.ADMIN_KEY);
    this.isAdmin.set(false);
  }
}
