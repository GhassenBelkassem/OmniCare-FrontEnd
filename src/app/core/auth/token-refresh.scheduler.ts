import { DestroyRef, Injectable, effect, inject } from '@angular/core';

import { AUTH_MODE } from './auth-mode';
import { AuthService } from './auth.service';
import { AuthTokenStore } from './auth-token.store';

/** Refresh this long before the access token expires. */
export const REFRESH_AHEAD_MS = 60_000;

/**
 * G-1 D5: refreshes the doctor's access token about a minute before it expires, so the widgets
 * never meet a 401 (the interceptor's refresh-on-401 stays as the fallback). Each new session
 * reschedules; a failed refresh is left to the interceptor and the session-termination flow.
 */
@Injectable({ providedIn: 'root' })
export class TokenRefreshScheduler {
  private readonly tokens = inject(AuthTokenStore);
  private readonly auth = inject(AuthService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    inject(DestroyRef).onDestroy(() => this.cancel());
    effect(() => {
      const expiresAt = this.tokens.expiresAt();
      const authenticated = this.tokens.authenticated();
      this.cancel();
      if (!authenticated || expiresAt === null || AUTH_MODE.staticDemo) return;
      const due = Date.parse(expiresAt) - REFRESH_AHEAD_MS - Date.now();
      if (Number.isNaN(due)) return;
      this.timer = setTimeout(() => {
        this.timer = null;
        this.auth.refreshSession().subscribe({ error: () => undefined });
      }, Math.max(0, due));
    });
  }

  /** Starts the scheduler (called once at bootstrap). */
  start(): void {
    // The effect above does the work; injecting the service is enough.
  }

  private cancel(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
