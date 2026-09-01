import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet } from '@angular/router';
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
  showAdminModal = signal(false);
}
