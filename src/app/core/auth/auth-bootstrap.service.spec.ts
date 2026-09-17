import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';

import { AuthService } from './auth.service';
import { AuthBootstrapService } from './auth-bootstrap.service';
import { LoginSession } from './auth.models';
import { AUTH_SESSION_STORAGE_KEY, AuthTokenStore } from './auth-token.store';

describe('AuthBootstrapService', () => {
  const refreshSession = vi.fn();

  beforeEach(() => {
    sessionStorage.clear();
    refreshSession.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthService, useValue: { refreshSession } },
      ],
    });
  });

  afterEach(() => sessionStorage.clear());

  it('begins unknown, validates a restored session once, then resolves authenticated', async () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session()));
    refreshSession.mockReturnValue(of(session({ accessToken: 'refreshed-access' })));
    const tokens = TestBed.inject(AuthTokenStore);

    expect(tokens.authState()).toBe('unknown');
    await TestBed.inject(AuthBootstrapService).initialize();

    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(tokens.authState()).toBe('authenticated');
    expect(tokens.accessToken()).toBe('refreshed-access');
  });

  it('resolves anonymous without a stored session and does not make an auth request', async () => {
    const tokens = TestBed.inject(AuthTokenStore);
    await TestBed.inject(AuthBootstrapService).initialize();

    expect(refreshSession).not.toHaveBeenCalled();
    expect(tokens.authState()).toBe('anonymous');
  });

  it('clears an invalid restored session and settles anonymous without a loop', async () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session()));
    refreshSession.mockReturnValue(throwError(() => new Error('expired')));
    const tokens = TestBed.inject(AuthTokenStore);

    await TestBed.inject(AuthBootstrapService).initialize();

    expect(tokens.authState()).toBe('anonymous');
    expect(sessionStorage.getItem(AUTH_SESSION_STORAGE_KEY)).toBeNull();
  });

  it('shares a pending restoration rather than issuing duplicate refresh requests', async () => {
    sessionStorage.setItem(AUTH_SESSION_STORAGE_KEY, JSON.stringify(session()));
    const pending = new Subject<LoginSession>();
    refreshSession.mockReturnValue(pending);
    const bootstrap = TestBed.inject(AuthBootstrapService);

    const first = bootstrap.initialize();
    const second = bootstrap.whenResolved();
    pending.next(session());
    pending.complete();
    await Promise.all([first, second]);

    expect(refreshSession).toHaveBeenCalledTimes(1);
  });
});

function session(overrides: Partial<LoginSession> = {}): LoginSession {
  return {
    accessToken: 'stored-access', tokenType: 'Bearer', expiresAt: '2999-08-05T12:10:00Z',
    refreshToken: 'stored-refresh', refreshExpiresAt: '2999-08-06T00:00:00Z',
    user: { id: 'clinic-user', role: 'CLINIC_ADMIN', mustChangePassword: false },
    ...overrides,
  };
}
