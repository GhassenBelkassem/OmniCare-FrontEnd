import { Injectable, computed, signal } from '@angular/core';

import { AuthenticatedUser, LoginSession } from './auth.models';

@Injectable({ providedIn: 'root' })
export class AuthTokenStore {
  private readonly accessTokenState = signal<string | null>(null);
  private readonly refreshTokenState = signal<string | null>(null);
  private readonly userState = signal<AuthenticatedUser | null>(null);

  readonly accessToken = this.accessTokenState.asReadonly();
  readonly refreshToken = this.refreshTokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly authenticated = computed(() => this.accessTokenState() !== null && this.userState() !== null);

  setSession(session: LoginSession): void {
    this.accessTokenState.set(session.accessToken);
    this.refreshTokenState.set(session.refreshToken);
    this.userState.set(session.user);
  }

  clear(): void {
    this.accessTokenState.set(null);
    this.refreshTokenState.set(null);
    this.userState.set(null);
  }
}
