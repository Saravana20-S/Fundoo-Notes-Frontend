import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';

import { AuthService } from '../../../core/services/auth';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './register.html',
  styleUrl: './register.css',
})
export class Register {

  private readonly authService = inject(AuthService);
  private readonly router = inject(Router);

  firstName: string = '';
  lastName: string = '';
  email: string = '';
  password: string = '';
  confirmPassword: string = '';
  mobile: string = '';

  isLoading: boolean = false;
  errorMessage: string = '';
  successMessage: string = '';

  onRegister(): void {

    this.errorMessage = '';
    this.successMessage = '';

    // Basic validation
    if (
      !this.firstName ||
      !this.lastName ||
      !this.email ||
      !this.password ||
      !this.mobile
    ) {
      return;
    }

    // Confirm password validation
    if (this.password !== this.confirmPassword) {
      this.errorMessage = 'Passwords do not match.';
      return;
    }

    this.isLoading = true;

    // confirmPassword is intentionally NOT sent to backend
    const registerRequest = {
      firstName: this.firstName,
      lastName: this.lastName,
      email: this.email,
      password: this.password,
      mobile: this.mobile,
    };

    this.authService.register(registerRequest).subscribe({

      next: () => {

        this.isLoading = false;

        this.successMessage =
          'Registration successful. Redirecting to login...';

        setTimeout(() => {
          this.router.navigate(['/login']);
        }, 1500);
      },

      error: (error) => {

        this.isLoading = false;

        console.error('Registration failed:', error);

        if (error.status === 409) {

          this.errorMessage =
            'An account with this email already exists.';

        } else if (error.status === 400) {

          this.errorMessage =
            'Please check the entered information.';

        } else {

          this.errorMessage =
            'Unable to register. Please try again.';
        }
      },
    });
  }
}