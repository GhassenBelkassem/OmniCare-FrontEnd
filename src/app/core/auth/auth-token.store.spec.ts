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

  it('persists the session for same-tab reloads', () => {
    TestBed.inject(AuthTokenStore).setSession(session({ accessToken: 'persisted-access' }));

    TestBed.resetTestingModule();
    const hydratedStore = TestBed.inject(AuthTokenStore);

    expect(hydratedStore.authenticated()).toBe(true);
    expect(hydratedStore.accessToken()).toBe('persisted-access');
    expect(hydratedStore.user()?.role).toBe('ADMIN');
  });

  it('hydrates clinic staff sessions returned by the backend', () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session({
      accessToken: 'clinic-staff-access',
      user: { id: 'clinic-user-1', role: 'CLINIC_ASSISTANT', mustChangePassword: false },
    })));

    const store = TestBed.inject(AuthTokenStore);

    expect(store.authenticated()).toBe(true);
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

    expect(store.authenticated()).toBe(false);
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
