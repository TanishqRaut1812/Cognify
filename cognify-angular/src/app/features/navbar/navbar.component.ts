import { Component, EventEmitter, Output, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterLinkActive],
  template: `
    <header class="navbar-top">
      <div class="container nav-content">
        <a routerLink="/" class="brand">
          <div class="brand-icon">
            <img src="cognify-logo.png" alt="Cognify Logo" class="cognify-brand-logo">
          </div>
          <div>
            <span class="brand-name">COGNIFY</span>
            <span class="brand-sub">ITSA Leaderboard</span>
          </div>
        </a>

        <nav class="desktop-nav">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="nav-link">Home</a>
          <a routerLink="/rankings" routerLinkActive="active" class="nav-link">Rankings</a>
          <a routerLink="/tests" routerLinkActive="active" class="nav-link">Test Archive</a>
          <a routerLink="/plan" routerLinkActive="active" class="nav-link">Semester Plan</a>

          @if (authService.isAdmin()) {
            <a routerLink="/admin" routerLinkActive="active" class="nav-link admin-btn">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="18" x="3" y="3" rx="2"/><path d="M9 3v18"/><path d="M14 9h7"/>
              </svg>
              Admin Dashboard
            </a>
          } @else {
            <button type="button" class="nav-link admin-btn" (click)="openAdminModal.emit()">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              Admin Login
            </button>
          }
        </nav>
      </div>
    </header>

    <!-- Mobile Bottom Navigation -->
    <nav class="navbar-bottom">
      <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact: true}" class="bottom-nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
        <span>Home</span>
      </a>
      <a routerLink="/rankings" routerLinkActive="active" class="bottom-nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2z"/></svg>
        <span>Rankings</span>
      </a>
      <a routerLink="/tests" routerLinkActive="active" class="bottom-nav-item">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="8" height="4" x="8" y="2" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>
        <span>Tests</span>
      </a>

      @if (authService.isAdmin()) {
        <a routerLink="/admin" routerLinkActive="active" class="bottom-nav-item admin-trigger">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>
          <span>Admin</span>
        </a>
      } @else {
        <button type="button" class="bottom-nav-item admin-trigger" (click)="openAdminModal.emit()">
          <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
          <span>Login</span>
        </button>
      }
    </nav>
  `
})
export class NavbarComponent {
  authService = inject(AuthService);
  @Output() openAdminModal = new EventEmitter<void>();
}
