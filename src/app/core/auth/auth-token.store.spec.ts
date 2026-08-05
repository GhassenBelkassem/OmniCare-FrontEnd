import { TestBed } from '@angular/core/testing';

import { AuthTokenStore } from './auth-token.store';

describe('AuthTokenStore', () => {
  it('keeps the opaque session in memory and clears it atomically', () => {
    const store = TestBed.inject(AuthTokenStore);
    store.setSession({
      accessToken: 'opaque-access',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'opaque-refresh',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    });

    expect(store.authenticated()).toBe(true);
    expect(store.user()?.role).toBe('ADMIN');
    expect(store.accessToken()).toBe('opaque-access');

    store.clear();

    expect(store.authenticated()).toBe(false);
    expect(store.accessToken()).toBeNull();
    expect(store.refreshToken()).toBeNull();
    expect(store.user()).toBeNull();
  });
});
