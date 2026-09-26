import { Component, HostListener, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

import { AuthService } from '../../../core/services/auth';
import { TokenService } from '../../../core/services/token';
import { NoteListService } from '../../../core/services/note-list';

interface CurrentUser {
  firstName?: string;
  lastName?: string;
  email?: string;
  sub?: string;
}

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [FormsModule],
  templateUrl: './navbar.html',
  styleUrl: './navbar.css',
})
export class Navbar {

  // =========================================================
  // SERVICES
  // =========================================================

  private readonly authService = inject(AuthService);

  private readonly tokenService = inject(TokenService);

  private readonly router = inject(Router);

  private readonly noteListService = inject(NoteListService);

  // =========================================================
  // PROFILE
  // =========================================================

  isProfileOpen = false;

  // =========================================================
  // SEARCH
  // =========================================================

  searchText = '';

  // =========================================================
  // CURRENT USER
  // =========================================================

  currentUser: CurrentUser | null =
    this.tokenService.getUserFromToken();

  // =========================================================
  // DISPLAY NAME
  // =========================================================

  get displayName(): string {

    const firstName =
      this.currentUser?.firstName?.trim() ?? '';

    const lastName =
      this.currentUser?.lastName?.trim() ?? '';

    const fullName =
      `${firstName} ${lastName}`.trim();

    return fullName || 'Fundoo User';
  }

  // =========================================================
  // EMAIL
  // =========================================================

  get email(): string {

    return (
      this.currentUser?.email ||
      this.currentUser?.sub ||
      ''
    );
  }

  // =========================================================
  // INITIALS
  // =========================================================

  get initials(): string {

    const first =
      this.currentUser?.firstName?.charAt(0) ?? '';

    const last =
      this.currentUser?.lastName?.charAt(0) ?? '';

    if (first || last) {

      return `${first}${last}`.toUpperCase();
    }

    return (
      this.email.charAt(0).toUpperCase() ||
      'U'
    );
  }

  // =========================================================
  // SEARCH INPUT
  // =========================================================

  onSearchInput(): void {

    console.log('NAVBAR SEARCH INPUT:', this.searchText);

    this.noteListService.onSearchInput(
      this.searchText
    );
  }

  // =========================================================
  // CLEAR SEARCH
  // =========================================================

  clearSearch(): void {

    this.searchText = '';

    this.noteListService.clearSearch();
  }

  // =========================================================
  // PROFILE
  // =========================================================

  toggleProfile(): void {

    this.isProfileOpen =
      !this.isProfileOpen;
  }

  // =========================================================
  // CLOSE PROFILE
  // =========================================================

  closeProfile(): void {

    this.isProfileOpen = false;
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  logout(): void {

    this.authService.logout().subscribe({

      next: () => {

        this.closeProfile();

        this.router.navigate(['/login']);
      },

      error: (error) => {

        console.error(
          'Logout failed:',
          error
        );

        this.tokenService.removeToken();

        this.closeProfile();

        this.router.navigate(['/login']);
      },
    });
  }

  // =========================================================
  // ESCAPE KEY
  // =========================================================

  @HostListener('document:keydown.escape')
  onEscape(): void {

    this.closeProfile();
  }
}