import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { filter } from 'rxjs';
import { NavbarComponent } from './features/navbar/navbar.component';
import { AdminLoginModalComponent } from './features/admin/admin-login-modal.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, NavbarComponent, AdminLoginModalComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  private router = inject(Router);

  showAdminModal = signal(false);
  isExamRoute = signal(false);

  constructor() {
    const initialUrl = this.router.url || (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '');
    this.isExamRoute.set(initialUrl.includes('/exam'));

    this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((event: NavigationEnd) => {
      const currentUrl = event.urlAfterRedirects || event.url;
      this.isExamRoute.set(currentUrl.includes('/exam'));
    });
  }
}
