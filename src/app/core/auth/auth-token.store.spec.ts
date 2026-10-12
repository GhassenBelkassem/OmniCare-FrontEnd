import { TestBed } from '@angular/core/testing';

import { LoginSession } from './auth.models';
import { AUTH_SESSION_STORAGE_KEY, AuthTokenStore } from './auth-token.store';

describe('AuthTokenStore', () => {
  beforeEach(() => {
    TestBed.resetTestingModule();
    sessionStorage.clear();
  });

  afterEach(() => {
    sessionStorage.clear();
  });

  it('keeps the opaque session in memory and clears it atomically', () => {
    const store = TestBed.inject(AuthTokenStore);
    expect(store.authState()).toBe('unknown');
    store.setSession(session());

    expect(store.authenticated()).toBe(true);
    expect(store.user()?.role).toBe('ADMIN');
    expect(store.accessToken()).toBe('opaque-access');

    store.clear();

    expect(store.authenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(store.user()).toBeNull();
  });

  it('restores a same-tab session for validation without treating it as authenticated yet', () => {
    TestBed.inject(AuthTokenStore).setSession(session({ accessToken: 'persisted-access' }));

    TestBed.resetTestingModule();
    const hydratedStore = TestBed.inject(AuthTokenStore);

    expect(hydratedStore.authState()).toBe('unknown');
    expect(hydratedStore.restoreStoredSession()).toBe(true);
    expect(hydratedStore.authenticated()).toBe(false);
    expect(hydratedStore.accessToken()).toBe('persisted-access');
    expect(hydratedStore.user()?.role).toBe('ADMIN');
  });

  it('restores clinic staff credentials without resolving the security context prematurely', () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session({
      accessToken: 'clinic-staff-access',
      user: { id: 'clinic-user-1', role: 'CLINIC_ASSISTANT', mustChangePassword: false },
    })));

    const store = TestBed.inject(AuthTokenStore);

    expect(store.restoreStoredSession()).toBe(true);
    expect(store.authenticated()).toBe(false);
    expect(store.accessToken()).toBe('clinic-staff-access');
    expect(store.user()?.role).toBe('CLINIC_ASSISTANT');
  });

  it('drops malformed or refresh-expired stored sessions', () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify({
      accessToken: 'stale-access',
      tokenType: 'Bearer',
      expiresAt: '2999-08-05T12:10:00Z',
      refreshToken: 'stale-refresh',
      refreshExpiresAt: '2000-08-06T00:00:00Z',
      user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    }));

    const store = TestBed.inject(AuthTokenStore);

    expect(store.restoreStoredSession()).toBe(false);
    expect(store.authenticated()).toBe(false);
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('rejects a stored session whose role is not in the implemented dashboard contract', () => {
    sessionStorage.setItem(
      AUTH_SESSION_STORAGE_KEY,
      JSON.stringify({
        ...session(),
        user: { id: 'secretary-1', role: 'SECRETARY', mustChangePassword: false },
      }),
    );

    const store = TestBed.inject(AuthTokenStore);

    expect(store.restoreStoredSession()).toBe(false);
    expect(store.authenticated()).toBe(false);
    expect(store.user()).toBeNull();
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });
});

function session(overrides: Partial<LoginSession> = {}): LoginSession {
  return {
    accessToken: 'opaque-access',
    tokenType: 'Bearer',
    expiresAt: '2999-08-05T12:10:00Z',
    refreshToken: 'opaque-refresh',
    refreshExpiresAt: '2999-08-06T00:00:00Z',
    user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    ...overrides,
  };
}
