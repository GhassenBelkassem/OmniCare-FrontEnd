import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, finalize, map, of, shareReplay, tap, throwError } from 'rxjs';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import {
  ApiErrorBody,
  DashboardRole,
  DevicePayload,
  EmailPasswordLoginResponse,
  LoginOutcome,
  LoginSession,
  dashboardRouteFor,
  isLoginSessionPayload,
} from './auth.models';
import { AUTH_MODE } from './auth-mode';
import { AuthTokenStore } from './auth-token.store';
import { SessionTerminationService } from './session-termination.service';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly config = inject(RUNTIME_CONFIG);
  private readonly tokens = inject(AuthTokenStore);
  private readonly termination = inject(SessionTerminationService);

  readonly user = this.tokens.user;
  readonly authenticated = this.tokens.authenticated;

  private refreshInFlight: Observable<LoginSession> | null = null;

  login(email: string, password: string): Observable<LoginOutcome> {
    if (AUTH_MODE.staticDemo) {
      return throwError(() => new Error('Choose a demo workspace to continue.'));
    }
    const device = devicePayload();
    return this.http
      .post<EmailPasswordLoginResponse>(`${this.config.apiBaseUrl}/auth/login`, {
        identifier: email,
        password,
        ...device,
      })
      .pipe(
        map((response) => {
          if (response.status === 'REQUIRES_PHONE_OTP' && response.phone !== null) {
            this.tokens.requirePhoneOtp({ phone: response.phone, device });
            return { kind: 'OTP_REQUIRED' } as const;
          }
          if (response.status === 'AUTHENTICATED' && response.session !== null) {
            return this.acceptSession(response.session);
          }
          throw new Error('The server returned an invalid login response.');
        }),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
      );
  }

  verifyPhoneOtp(otp: string): Observable<LoginOutcome> {
    const challenge = this.tokens.otpChallenge();
    if (challenge === null) {
      return throwError(() => new Error('The phone verification challenge has expired.'));
    }
    return this.http
      .post<unknown>(`${this.config.apiBaseUrl}/auth/login/phone/verify`, {
        phone: challenge.phone,
        otp,
        ...challenge.device,
      })
      .pipe(
        map((session) => this.acceptSession(session)),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
      );
  }

  resendPhoneOtp(): Observable<void> {
    const challenge = this.tokens.otpChallenge();
    if (challenge === null) {
      return throwError(() => new Error('The phone verification challenge has expired.'));
    }
    return this.http
      .post<void>(`${this.config.apiBaseUrl}/auth/login/phone/initiate`, {
        phone: challenge.phone,
      })
      .pipe(catchError((error: unknown) => throwError(() => normalizeAuthError(error))));
  }

  changeRequiredPassword(currentPassword: string, newPassword: string): Observable<DashboardRole> {
    return this.http
      .post<void>(`${this.config.apiBaseUrl}/auth/password/change`, {
        currentPassword,
        newPassword,
      })
      .pipe(
        map(() => {
          const role = this.tokens.user()?.role;
          if (role === undefined) throw new Error('The authenticated session is unavailable.');
          this.tokens.markPasswordChanged();
          return role;
        }),
        catchError((error: unknown) => throwError(() => normalizeAuthError(error))),
      );
  }

  refreshSession(): Observable<LoginSession> {
    if (AUTH_MODE.staticDemo) {
      const role = this.tokens.user()?.role;
      if (role !== undefined && AUTH_MODE.canSelectWorkspace(role)) {
        return of(AUTH_MODE.createWorkspaceSession(role)).pipe(
          tap((session) => this.tokens.setSession(session)),
        );
      }
      return throwError(() => new Error('No demo session is available.'));
    }
    const refreshToken = this.tokens.refreshToken();
    if (refreshToken === null) {
      return throwError(() => new Error('No refresh session is available.'));
    }

    if (this.refreshInFlight !== null) return this.refreshInFlight;

    const refresh$ = this.http
      .post<unknown>(`${this.config.apiBaseUrl}/auth/refresh`, { refreshToken })
      .pipe(
        map((session) => requireLoginSession(session)),
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
    if (AUTH_MODE.staticDemo) {
      void this.termination.terminate('EXPLICIT_LOGOUT');
      return;
    }
    this.http.post<void>(`${this.config.apiBaseUrl}/auth/logout`, {}).subscribe({
      complete: () => void this.termination.terminate('EXPLICIT_LOGOUT'),
      error: () => void this.termination.terminate('EXPLICIT_LOGOUT'),
    });
  }

  logoutAll(): Observable<void> {
    if (AUTH_MODE.staticDemo) {
      void this.termination.terminate('EXPLICIT_LOGOUT');
      return of(undefined);
    }
    return this.http
      .post<void>(`${this.config.apiBaseUrl}/auth/logout-all`, {})
      .pipe(finalize(() => void this.termination.terminate('EXPLICIT_LOGOUT')));
  }

  routeFor(role: DashboardRole): string {
    return dashboardRouteFor(role);
  }

  loginAsWorkspaceRole(role: DashboardRole): DashboardRole {
    if (!AUTH_MODE.staticDemo || !AUTH_MODE.canSelectWorkspace(role)) {
      throw new Error('Standalone workspace authentication is not available in this build.');
    }
    this.tokens.setSession(AUTH_MODE.createWorkspaceSession(role));
    return role;
  }

  private acceptSession(value: unknown): LoginOutcome {
    const session = requireLoginSession(value);
    this.tokens.setSession(session);
    return session.user.mustChangePassword
      ? { kind: 'PASSWORD_CHANGE_REQUIRED' }
      : { kind: 'AUTHENTICATED', role: session.user.role };
  }
}

function requireLoginSession(value: unknown): LoginSession {
  if (!isLoginSessionPayload(value)) {
    throw new Error('The server returned an invalid session response.');
  }
  return value;
}

function devicePayload(): DevicePayload {
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
