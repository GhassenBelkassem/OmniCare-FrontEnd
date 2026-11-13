import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthService } from './auth.service';
import { AuthTokenStore } from './auth-token.store';
import { REFRESH_AHEAD_MS, TokenRefreshScheduler } from './token-refresh.scheduler';

describe('TokenRefreshScheduler (G-1 D5)', () => {
  beforeEach(() => vi.useFakeTimers({ now: new Date('2026-11-13T10:00:00Z') }));
  afterEach(() => { vi.useRealTimers(); TestBed.resetTestingModule(); });

  it('refreshes about a minute before the access token expires, and reschedules on a new session', () => {
    const expiresAt = signal<string | null>('2026-11-13T10:15:00Z');
    const authenticated = signal(true);
    const auth = { refreshSession: vi.fn(() => of({})) };
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthTokenStore, useValue: { expiresAt, authenticated } },
        { provide: AuthService, useValue: auth },
      ],
    });
    TestBed.inject(TokenRefreshScheduler).start();
    TestBed.tick();

    vi.advanceTimersByTime(15 * 60_000 - REFRESH_AHEAD_MS - 1);
    expect(auth.refreshSession).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);

    // The refresh brought a new expiry: scheduled again; a signed-out session schedules nothing.
    expiresAt.set('2026-11-13T10:30:00Z');
    TestBed.tick();
    authenticated.set(false);
    TestBed.tick();
    vi.advanceTimersByTime(30 * 60_000);
    expect(auth.refreshSession).toHaveBeenCalledTimes(1);
  });
});
