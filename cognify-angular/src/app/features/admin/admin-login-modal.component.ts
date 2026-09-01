import { Component, EventEmitter, Output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-admin-login-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-card">
        <div class="modal-header">
          <div class="modal-icon">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          </div>
          <div>
            <h3 class="modal-title">Admin Authentication</h3>
            <p class="modal-subtitle">Enter administrator security credentials</p>
          </div>
          <button type="button" class="modal-close" (click)="closeModal.emit()">&times;</button>
        </div>

        <div class="modal-body">
          <form (ngSubmit)="handleLogin()">
            <div class="form-group">
              <label>Admin Secret Password</label>
              <div class="password-wrapper">
                <input [type]="showPassword() ? 'text' : 'password'" [(ngModel)]="passwordInput" name="passwordInput" placeholder="Enter Admin Password" required autofocus>
                <button type="button" class="toggle-password-btn" (click)="showPassword.set(!showPassword())">
                  {{ showPassword() ? 'Hide' : 'Show' }}
                </button>
              </div>
            </div>

            @if (errorMessage()) {
              <div class="form-error">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" x2="12" y1="8" y2="12"/><line x1="12" x2="12.01" y1="16" y2="16"/></svg>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="closeModal.emit()">Cancel</button>
              <button type="submit" class="btn btn-primary">Authenticate</button>
            </div>
          </form>
        </div>
      </div>
    </div>
  `
})
export class AdminLoginModalComponent {
  private authService = inject(AuthService);
  private router = inject(Router);

  @Output() closeModal = new EventEmitter<void>();

  passwordInput = '';
  showPassword = signal(false);
  errorMessage = signal('');

  handleLogin(): void {
    this.errorMessage.set('');
    const res = this.authService.login(this.passwordInput);
    if (res.success) {
      this.closeModal.emit();
      this.router.navigate(['/admin']);
    } else {
      this.errorMessage.set(res.message);
    }
  }
}
