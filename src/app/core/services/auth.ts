import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

import {
  RegisterRequest,
  LoginRequest,
  LoginResponse,
  ForgotPasswordRequest,
  ResetPasswordRequest,
} from '../models/auth.model';

import { TokenService } from './token';

@Injectable({
  providedIn: 'root',
})
export class AuthService {

  private readonly http = inject(HttpClient);
  private readonly tokenService = inject(TokenService);

  private readonly apiUrl =
    `${environment.apiUrl}/api/auth`;

  register(request: RegisterRequest): Observable<unknown> {
    return this.http.post(
      `${this.apiUrl}/register`,
      request
    );
  }

  login(request: LoginRequest): Observable<LoginResponse> {

    return this.http
      .post<LoginResponse>(
        `${this.apiUrl}/login`,
        request
      )
      .pipe(

        tap((response) => {

          console.log('Login response:', response);

          if (!response?.token) {

            console.error(
              'Login response does not contain a token.'
            );

            return;
          }

          // Store JWT
          this.tokenService.setToken(
            response.token
          );

          // Immediately verify storage
          const storedToken =
            this.tokenService.getToken();

          if (storedToken) {

            console.log(
              'JWT stored successfully.'
            );

          } else {

            console.error(
              'JWT could not be stored.'
            );
          }
        })
      );
  }

  forgotPassword(
    request: ForgotPasswordRequest
  ): Observable<unknown> {

    return this.http.post(
      `${this.apiUrl}/forgot-password`,
      request
    );
  }

  resetPassword(
    request: ResetPasswordRequest
  ): Observable<unknown> {

    return this.http.post(
      `${this.apiUrl}/reset-password`,
      request
    );
  }

  logout(): Observable<unknown> {

    return this.http
      .post(
        `${this.apiUrl}/logout`,
        {}
      )
      .pipe(

        tap(() => {

          this.tokenService.removeToken();

        })
      );
  }

  isLoggedIn(): boolean {

    const token =
      this.tokenService.getToken();

    if (!token) {
      return false;
    }

    return true;
  }

  getCurrentUser() {

    return this.tokenService
      .getUserFromToken();
  }
}