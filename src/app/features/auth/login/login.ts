import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.css',
})
export class Login {
  private readonly authService = inject(AuthService);

  private readonly router = inject(Router);

  email = '';
  password = '';

  isLoading = false;
  errorMessage = '';

  onLogin(): void {
    this.errorMessage = '';

    if (!this.email || !this.password) {
      this.errorMessage = 'Please enter email and password.';

      return;
    }

    this.isLoading = true;

    const loginRequest = {
      email: this.email.trim(),
      password: this.password,
    };

    this.authService.login(loginRequest).subscribe({
      next: (response) => {
        this.isLoading = false;

        console.log('Login successful');

        console.log('Login response:', response);

        /*
         * Confirm that frontend authentication
         * state exists before navigating.
         */
        if (this.authService.isLoggedIn()) {
          console.log('Authentication token is available.');

          this.router.navigate(['/notes']);
        } else {
          console.error('Login succeeded but authentication token was not stored.');

          this.errorMessage = 'Login succeeded, but authentication could not be stored.';
        }
      },

      error: (error) => {
        this.isLoading = false;

        console.error('Login failed:', error);

        if (error.status === 401) {
          this.errorMessage = 'Invalid email or password.';
        } else if (error.status === 400) {
          this.errorMessage = 'Please check the entered information.';
        } else {
          this.errorMessage = 'Unable to connect to the server. Please try again.';
        }
      },
    });
  }
}
