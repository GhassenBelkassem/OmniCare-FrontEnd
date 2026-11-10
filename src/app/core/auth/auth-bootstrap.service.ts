import { isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthTokenStore } from './auth-token.store';
import { SessionTerminationService } from './session-termination.service';

/** Resolves browser-stored sessions once before router guards make a decision. */
@Injectable({ providedIn: 'root' })
export class AuthBootstrapService {
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private readonly auth = inject(AuthService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly termination = inject(SessionTerminationService);
  private initialization: Promise<void> | null = null;

  initialize(): Promise<void> {
    if (this.initialization !== null) return this.initialization;
    if (!this.isBrowser) return Promise.resolve();

    this.initialization = this.tokens.restoreStoredSession()
      ? firstValueFrom(this.auth.refreshSession())
          .then((session) => this.tokens.setSession(session))
          .catch(() => this.termination.terminate('INVALID_BOOTSTRAP', false).then(() => undefined))
      : Promise.resolve().then(() => this.tokens.resolveAnonymous());
    return this.initialization;
  }

  whenResolved(): Promise<void> {
    return this.initialize();
  }
}
