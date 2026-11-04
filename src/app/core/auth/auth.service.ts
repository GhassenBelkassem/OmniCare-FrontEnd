import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';

import { APP_MODE } from '../config/app-mode';
import { RUNTIME_CONFIG } from '../config/runtime-config';
import {
  ApiErrorBody,
  DashboardRole,
  EmailPasswordLoginResponse,
  LoginSession,
  dashboardRouteFor,
} from './auth.models';
import { AuthTokenStore } from './auth-token.store';
import { createDemoSession, DemoWorkspaceRole, isDemoWorkspaceRole } from './demo-auth';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly tokens = inject(AuthTokenStore);

  readonly user = this.tokens.user;
  readonly authenticated = this.tokens.authenticated;

  private refreshInFlight: Observable<LoginSession> | null = null;

  login(email: string, password: string): Observable<DashboardRole> {
    if (APP_MODE.staticDemo) {
      return throwError(() => new Error('Choose a demo workspace to continue.'));
    }
    return this.http
      .post<EmailPasswordLoginResponse>(`${this.config.apiBaseUrl}/auth/login`, {
        identifier: email,
        password,
        ...devicePayload(),
      })
      .pipe(
        map((response) => {
          if (response.status !== 'AUTHENTICATED' || response.session == null) {
            throw new Error('The server returned an invalid login response.');
          }
          this.tokens.setSession(response.session);
          return response.session.user.role;
        }),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
      );
  }

  refreshSession(): Observable<LoginSession> {
    if (APP_MODE.staticDemo) {
      const role = this.tokens.user()?.role;
      if (role !== undefined && isDemoWorkspaceRole(role)) {
        return of(createDemoSession(role)).pipe(tap((session) => this.tokens.setSession(session)));
      }
      return throwError(() => new Error('No demo session is available.'));
    }
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
    if (APP_MODE.staticDemo) {
      this.finishLogout();
      return;
    }
    this.http.post<void>(`${this.config.apiBaseUrl}/auth/logout`, {}).subscribe({
      complete: () => this.finishLogout(),
      error: () => this.finishLogout(),
    });
  }

  logoutAll(): Observable<void> {
    if (APP_MODE.staticDemo) {
      this.finishLogout();
      return of(undefined);
    }
    return this.http
      .post<void>(`${this.config.apiBaseUrl}/auth/logout-all`, {})
      .pipe(tap(() => this.finishLogout()));
  }

  routeFor(role: DashboardRole): string {
    return dashboardRouteFor(role);
  }

  loginAsDemoRole(role: DemoWorkspaceRole): DashboardRole {
    if (!APP_MODE.staticDemo) {
      throw new Error('Demo authentication is not available in this build.');
    }
    this.tokens.setSession(createDemoSession(role));
    return role;
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
