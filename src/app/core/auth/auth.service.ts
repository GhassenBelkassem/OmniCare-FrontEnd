import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, map, tap, throwError } from 'rxjs';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import { ApiErrorBody, DashboardRole, EmailPasswordLoginResponse } from './auth.models';
import { AuthTokenStore } from './auth-token.store';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly tokens = inject(AuthTokenStore);

  readonly user = this.tokens.user;
  readonly authenticated = this.tokens.authenticated;

  login(email: string, password: string): Observable<DashboardRole> {
    return this.http
      .post<EmailPasswordLoginResponse>(`${this.config.apiBaseUrl}/auth/login`, {
        identifier: email,
        password,
        platform: 'WEB',
        deviceLabel: 'OmniCare dashboard',
        sharedDevice: false,
        rememberDevice: false,
      })
      .pipe(
        map((response) => {
          if (response.status !== 'AUTHENTICATED' || response.session === null) {
            throw new Error('This account requires an unsupported authentication step.');
          }
          return response.session;
        }),
        tap((session) => this.tokens.setSession(session)),
        map((session) => session.user.role),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
      );
  }

  logout(): void {
    this.http.post<void>(`${this.config.apiBaseUrl}/auth/logout`, {}).subscribe({
      complete: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  routeFor(role: DashboardRole): string {
    if (role === 'ADMIN') return '/admin';
    if (role === 'DOCTOR') return '/doctor';
    return '/clinic';
  }

  private finishLogout(): void {
    this.tokens.clear();
    void this.router.navigateByUrl('/login');
  }
}

function normalizeAuthError(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    return new Error(body?.message ?? 'Sign in failed. Check your details and try again.');
  }
  return error instanceof Error ? error : new Error('Sign in failed.');
}
