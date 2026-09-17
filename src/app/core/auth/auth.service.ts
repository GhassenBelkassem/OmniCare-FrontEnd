import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, shareReplay, tap, throwError } from 'rxjs';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import {
  ApiErrorBody,
  DashboardRole,
  EmailPasswordLoginResponse,
  LoginSession,
  dashboardRouteFor,
} from './auth.models';
import { AuthTokenStore } from './auth-token.store';

export type LoginStep =
  | { readonly kind: 'authenticated'; readonly role: DashboardRole }
  | { readonly kind: 'requires-otp'; readonly phone: string };

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly tokens = inject(AuthTokenStore);

  readonly user = this.tokens.user;
  readonly authenticated = this.tokens.authenticated;

  private refreshInFlight: Observable<LoginSession> | null = null;

  login(email: string, password: string): Observable<LoginStep> {
    return this.http
      .post<EmailPasswordLoginResponse>(`${this.config.apiBaseUrl}/auth/login`, {
        identifier: email,
        password,
        ...devicePayload(),
      })
      .pipe(
        map((response) => {
          if (response.status === 'REQUIRES_PHONE_OTP') {
            return { kind: 'requires-otp' as const, phone: response.phone ?? '' };
          }
          if (response.session == null) {
            throw new Error('The server returned an invalid login response.');
          }
          this.tokens.setSession(response.session);
          return { kind: 'authenticated' as const, role: response.session.user.role };
        }),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
      );
  }

  verifyPhoneOtp(phone: string, otp: string): Observable<DashboardRole> {
    return this.http
      .post<LoginSession>(`${this.config.apiBaseUrl}/auth/login/phone/verify`, {
        phone,
        otp,
        ...devicePayload(),
      })
      .pipe(
        tap((session) => this.tokens.setSession(session)),
        map((session) => session.user.role),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
      );
  }

  refreshSession(): Observable<LoginSession> {
    const refreshToken = this.tokens.refreshToken();
    if (refreshToken === null) {
      return throwError(() => new Error('No refresh session is available.'));
    }

    if (this.refreshInFlight !== null) return this.refreshInFlight;

    const refresh$ = this.http
      .post<LoginSession>(`${this.config.apiBaseUrl}/auth/refresh`, { refreshToken })
      .pipe(
        tap((session) => this.tokens.setSession(session)),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
        finalize(() => {
          this.refreshInFlight = null;
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );

    this.refreshInFlight = refresh$;
    return refresh$;
  }

  logout(): void {
    this.http.post<void>(`${this.config.apiBaseUrl}/auth/logout`, {}).subscribe({
      complete: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  routeFor(role: DashboardRole): string {
    return dashboardRouteFor(role);
  }

  private finishLogout(): void {
    this.tokens.clear();
    void this.router.navigateByUrl('/login');
  }
}

function devicePayload(): {
  deviceFingerprint: string;
  platform: 'WEB';
  deviceLabel: string;
  sharedDevice: boolean;
  rememberDevice: boolean;
} {
  return {
    deviceFingerprint: dashboardDeviceFingerprint(),
    platform: 'WEB',
    deviceLabel: 'OmniCare dashboard',
    sharedDevice: false,
    rememberDevice: true,
  };
}

function dashboardDeviceFingerprint(): string {
  const key = 'omnicare.dashboard.deviceFingerprint';
  const existing = globalThis.localStorage?.getItem(key);
  if (existing) return existing;

  const created = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
  globalThis.localStorage?.setItem(key, created);
  return created;
}

function normalizeAuthError(error: unknown): Error {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    return new Error(body?.message ?? 'Sign in failed. Check your details and try again.');
  }
  return error instanceof Error ? error : new Error('Sign in failed.');
}
