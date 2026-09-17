import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

import { AuthenticatedUser, LoginSession, isDashboardRole } from './auth.models';

export const AUTH_SESSION_STORAGE_KEY = 'omnicare.dashboard.session';

@Injectable({ providedIn: 'root' })
export class AuthTokenStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly accessTokenState = signal<string | null>(null);
  private readonly refreshTokenState = signal<string | null>(null);
  private readonly userState = signal<AuthenticatedUser | null>(null);

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly refreshToken = this.refreshTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly authenticated = computed(() => this.accessTokenState() !== null && this.userState() !== null);

  constructor() {
    const session = this.readStoredSession();
    if (session !== null) this.applySession(session);
  }

  setSession(session: LoginSession): void {
    this.applySession(session);
    this.writeStoredSession(session);
  }

  clear(): void {
    this.accessTokenState.set(null);
    this.refreshTokenState.set(null);
    this.userState.set(null);
    this.removeStoredSession();
  }

  private applySession(session: LoginSession): void {
    this.accessTokenState.set(session.accessToken);
    this.refreshTokenState.set(session.refreshToken);
    this.userState.set(session.user);
  }

  private readStoredSession(): LoginSession | null {
    if (!this.isBrowser) return null;
    try {
      const raw = globalThis.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (raw === null) return null;
      const session = JSON.parse(raw) as unknown;
      if (!isLoginSession(session) || isPast(session.refreshExpiresAt)) {
        this.removeStoredSession();
        return null;
      }
      return session;
    } catch {
      this.removeStoredSession();
      return null;
    }
  }

  private writeStoredSession(session: LoginSession): void {
    if (!this.isBrowser) return;
    try {
      globalThis.sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session));
    } catch {
      // Storage is best-effort; in-memory auth still works for the active page.
    }
  }

  private removeStoredSession(): void {
    if (!this.isBrowser) return;
    try {
      globalThis.sessionStorage.removeItem(AUTH_SESSION_STORAGE_KEY);
    } catch {
      // Ignored: blocked storage must not break logout.
    }
  }
}

function isLoginSession(value: unknown): value is LoginSession {
  if (!isRecord(value)) return false;
  return typeof value['accessToken'] === 'string'
    && value['tokenType'] === 'Bearer'
    && typeof value['expiresAt'] === 'string'
    && typeof value['refreshToken'] === 'string'
    && typeof value['refreshExpiresAt'] === 'string'
    && isAuthenticatedUser(value['user']);
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (!isRecord(value)) return false;
  return typeof value['id'] === 'string'
    && isDashboardRole(value['role'])
    && typeof value['mustChangePassword'] === 'boolean';
}

function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null;
}

function isPast(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) || timestamp <= Date.now();
}
