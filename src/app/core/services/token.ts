
import { Injectable, inject, PLATFORM_ID } from '@angular/core';
import { isPlatformBrowser } from '@angular/common';

interface UserTokenPayload {
  firstName?: string;
  lastName?: string;
  email?: string;
  sub?: string;
  exp?: number;
}

@Injectable({
  providedIn: 'root',
})
export class TokenService {
  private readonly TOKEN_KEY = 'fundoo_token';

  private readonly platformId = inject(PLATFORM_ID);

  private get isBrowser(): boolean {
    return isPlatformBrowser(this.platformId);
  }

  setToken(token: string): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.setItem(this.TOKEN_KEY, token);
  }

  getToken(): string | null {
    if (!this.isBrowser) {
      return null;
    }

    return localStorage.getItem(this.TOKEN_KEY);
  }

  removeToken(): void {
    if (!this.isBrowser) {
      return;
    }

    localStorage.removeItem(this.TOKEN_KEY);
  }

  hasToken(): boolean {
    return !!this.getToken();
  }

  getUserFromToken(): UserTokenPayload | null {
    const token = this.getToken();

    if (!token) {
      return null;
    }

    try {
      const parts = token.split('.');

      if (parts.length !== 3) {
        return null;
      }

      const payload = parts[1];

      const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');

      const decodedPayload = atob(base64);

      return JSON.parse(decodedPayload);
    } catch (error) {
      console.error('Unable to decode authentication token:', error);

      return null;
    }
  }
}
