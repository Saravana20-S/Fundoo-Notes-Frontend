import { Component, HostListener, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth';
import { TokenService } from '../../../core/services/token';

interface CurrentUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  sub?: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {
  private readonly authService = inject(AuthService);
  private readonly tokenService = inject(TokenService);
  private readonly router = inject(Router);

  isProfileOpen = false;

  currentUser: CurrentUser | null = this.tokenService.getUserFromToken();

  get displayName(): string {
    const firstName = this.currentUser?.firstName?.trim() ?? '';

    const lastName = this.currentUser?.lastName?.trim() ?? '';

    const fullName = `${firstName} ${lastName}`.trim();

    return fullName || 'Fundoo User';
  }

  get email(): string {
    return this.currentUser?.email || this.currentUser?.sub || '';
  }

  get initials(): string {
    const first = this.currentUser?.firstName?.charAt(0) ?? '';

    const last = this.currentUser?.lastName?.charAt(0) ?? '';

    if (first || last) {
      return `${first}${last}`.toUpperCase();
    }

    return this.email.charAt(0).toUpperCase() || 'U';
  }

  toggleProfile(): void {
    this.isProfileOpen = !this.isProfileOpen;
  }

  closeProfile(): void {
    this.isProfileOpen = false;
  }

  logout(): void {
    this.authService.logout().subscribe({
      next: () => {
        this.closeProfile();

        this.router.navigate(['/login']);
      },

      error: (error) => {
        console.error('Logout failed:', error);

        this.tokenService.removeToken();

        this.closeProfile();

        this.router.navigate(['/login']);
      },
    });
  }

  @HostListener('document:keydown.escape')
  onEscape(): void {
    this.closeProfile();
  }
}
