import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, computed, inject, signal } from '@angular/core';

import { AuthenticatedUser, LoginSession, PhoneOtpChallenge, isLoginSessionPayload } from './auth.models';

export const AUTH_SESSION_STORAGE_KEY = 'omnicare.dashboard.session';
export type AuthState =
  'BOOTSTRAPPING' | 'ANONYMOUS' | 'OTP_REQUIRED' | 'PASSWORD_CHANGE_REQUIRED' | 'AUTHENTICATED';

@Injectable({ providedIn: 'root' })
export class AuthTokenStore {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly accessTokenState = signal<string | null>(null);
  private readonly refreshTokenState = signal<string | null>(null);
  private readonly expiresAtState = signal<string | null>(null);
  private readonly refreshExpiresAtState = signal<string | null>(null);
  private readonly userState = signal<AuthenticatedUser | null>(null);
  private readonly otpChallengeState = signal<PhoneOtpChallenge | null>(null);
  private readonly state = signal<AuthState>('BOOTSTRAPPING');

  readonly accessToken = this.accessTokenState.asReadonly();
  /** G-1 D5: when the access token expires (ISO-8601), to refresh it shortly before. */
  readonly expiresAt = this.expiresAtState.asReadonly();
  readonly refreshToken = this.refreshTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly otpChallenge = this.otpChallengeState.asReadonly();
  readonly authState = this.state.asReadonly();
  readonly authenticated = computed(
    () =>
      this.state() === 'AUTHENTICATED' &&
      this.accessTokenState() !== null &&
      this.userState() !== null,
  );
  readonly hasSession = computed(
    () =>
      this.accessTokenState() !== null &&
      this.refreshTokenState() !== null &&
      this.userState() !== null,
  );

  setSession(session: LoginSession): void {
    this.applySession(session);
    this.otpChallengeState.set(null);
    this.state.set(session.user.mustChangePassword ? 'PASSWORD_CHANGE_REQUIRED' : 'AUTHENTICATED');
    this.writeStoredSession(session);
  }

  requirePhoneOtp(challenge: PhoneOtpChallenge): void {
    this.accessTokenState.set(null);
    this.refreshTokenState.set(null);
    this.expiresAtState.set(null);
    this.refreshExpiresAtState.set(null);
    this.userState.set(null);
    this.otpChallengeState.set(challenge);
    this.state.set('OTP_REQUIRED');
    this.removeStoredSession();
  }

  markPasswordChanged(): void {
    const user = this.userState();
    if (user === null || !this.hasSession()) return;
    const updatedUser = { ...user, mustChangePassword: false };
    this.userState.set(updatedUser);
    this.state.set('AUTHENTICATED');
    this.writeStoredSession(this.currentSession(updatedUser));
  }

  clear(): void {
    this.accessTokenState.set(null);
    this.refreshTokenState.set(null);
    this.expiresAtState.set(null);
    this.refreshExpiresAtState.set(null);
    this.userState.set(null);
    this.otpChallengeState.set(null);
    this.state.set('ANONYMOUS');
    this.removeStoredSession();
  }

  /** Restores credentials for validation while retaining the unresolved auth state. */
  restoreStoredSession(): boolean {
    const session = this.readStoredSession();
    if (session === null) return false;
    this.applySession(session);
    return true;
  }

  resolveAnonymous(): void {
    this.accessTokenState.set(null);
    this.refreshTokenState.set(null);
    this.expiresAtState.set(null);
    this.refreshExpiresAtState.set(null);
    this.userState.set(null);
    this.otpChallengeState.set(null);
    this.state.set('ANONYMOUS');
  }

  private currentSession(user: AuthenticatedUser): LoginSession {
    return {
      accessToken: this.accessTokenState()!,
      tokenType: 'Bearer',
      expiresAt: this.expiresAtState()!,
      refreshToken: this.refreshTokenState()!,
      refreshExpiresAt: this.refreshExpiresAtState()!,
      user,
    };
  }

  private applySession(session: LoginSession): void {
    this.accessTokenState.set(session.accessToken);
    this.refreshTokenState.set(session.refreshToken);
    this.expiresAtState.set(session.expiresAt);
    this.refreshExpiresAtState.set(session.refreshExpiresAt);
    this.userState.set(session.user);
  }

  private readStoredSession(): LoginSession | null {
    if (!this.isBrowser) return null;
    try {
      const raw = globalThis.sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY);
      if (raw === null) return null;
      const session = JSON.parse(raw) as unknown;
      if (!isLoginSessionPayload(session) || isPast(session.refreshExpiresAt)) {
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

function isPast(value: string): boolean {
  const timestamp = Date.parse(value);
  return Number.isNaN(timestamp) || timestamp <= Date.now();
}
