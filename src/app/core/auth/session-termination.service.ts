import { Injectable, inject } from '@angular/core';
import { Router } from '@angular/router';

import { AuthTokenStore } from './auth-token.store';
import { SensitiveStateRegistry } from './sensitive-state.registry';

export type SessionTerminationReason =
  'EXPLICIT_LOGOUT' | 'INVALID_BOOTSTRAP' | 'REFRESH_REJECTED' | 'SESSION_INVALID';

@Injectable({ providedIn: 'root' })
export class SessionTerminationService {
  private readonly tokens = inject(AuthTokenStore);
  private readonly sensitiveState = inject(SensitiveStateRegistry);
  private readonly router = inject(Router);
  private termination: Promise<boolean> | null = null;
  private terminated = false;

  terminate(_reason: SessionTerminationReason, redirect = true): Promise<boolean> {
    if (this.terminated && !this.tokens.hasSession()) {
      return this.termination ?? Promise.resolve(true);
    }
    this.terminated = true;
    this.sensitiveState.clearAll();
    this.tokens.clear();

    if (!redirect) return Promise.resolve(true);
    if (this.termination !== null) return this.termination;
    if (this.router.url === '/login') return Promise.resolve(true);

    this.termination = this.router
      .navigateByUrl('/login')
      .catch(() => false)
      .finally(() => {
        this.termination = null;
      });
    return this.termination;
  }
}
