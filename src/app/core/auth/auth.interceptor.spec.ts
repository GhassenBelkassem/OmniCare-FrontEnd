import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import { AuthTokenStore } from './auth-token.store';
import { authInterceptor } from './auth.interceptor';
import { LoginSession } from './auth.models';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let tokens: AuthTokenStore;

  beforeEach(() => {
    sessionStorage.clear();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(AuthTokenStore);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('attaches the bearer token to protected API requests', () => {
    tokens.setSession(session({ accessToken: 'token-1' }));

    client.get('/api/v1/patient/requests').subscribe();

    const request = http.expectOne('/api/v1/patient/requests');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({});
  });

  it('does not attach the bearer token to anonymous auth endpoints', () => {
    tokens.setSession(session({ accessToken: 'stale-token' }));
    const urls = [
      '/api/v1/auth/login',
      '/api/v1/auth/refresh',
      '/api/v1/auth/google/initiate',
      '/api/v1/auth/google/complete',
    ];

    for (const url of urls) {
      client.post(url, {}).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
  });

  it('still attaches the bearer token to logout, device and session endpoints', () => {
    tokens.setSession(session({ accessToken: 'token-2' }));

    for (const url of ['/api/v1/auth/logout', '/api/v1/auth/devices', '/api/v1/auth/me']) {
      client.post(url, {}).subscribe();
      const request = http.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer token-2');
      request.flush({});
    }
  });

  it('refreshes and retries a protected request after a 401 response', () => {
    tokens.setSession(session({
      accessToken: 'expired-access-token',
      refreshToken: 'valid-refresh-token',
    }));

    client.get('/api/v1/me/access').subscribe();

    http.expectOne('/api/v1/me/access').flush(
      { code: 'UNAUTHENTICATED', message: 'Session expired.' },
      { status: 401, statusText: 'Unauthorized' },
    );

    const refresh = http.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    expect(refresh.request.body).toEqual({ refreshToken: 'valid-refresh-token' });
    refresh.flush(session({
      accessToken: 'new-access-token',
      refreshToken: 'rotated-refresh-token',
    }));

    const retry = http.expectOne('/api/v1/me/access');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retry.flush({ contractVersion: '1.0' });

    expect(tokens.accessToken()).toBe('new-access-token');
    expect(tokens.refreshToken()).toBe('rotated-refresh-token');
  });

  it('does not start a refresh loop for auth lifecycle failures', () => {
    tokens.setSession(session({ accessToken: 'existing-access-token' }));
    let receivedError: HttpErrorResponse | undefined;

    client.post('/api/v1/auth/login', {}).subscribe({
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    const login = http.expectOne('/api/v1/auth/login');
    expect(login.request.headers.has('Authorization')).toBe(false);
    login.flush({}, { status: 401, statusText: 'Unauthorized' });

    http.expectNone('/api/v1/auth/refresh');
    expect(receivedError?.status).toBe(401);
    expect(tokens.authenticated()).toBe(true);
  });

  it('clears the session when refreshing the request fails', () => {
    tokens.setSession(session({
      accessToken: 'expired-access-token',
      refreshToken: 'expired-refresh-token',
    }));

    client.get('/api/v1/patient/requests').subscribe({ error: () => undefined });

    http.expectOne('/api/v1/patient/requests').flush(
      { code: 'UNAUTHENTICATED' },
      { status: 401, statusText: 'Unauthorized' },
    );
    http.expectOne('/api/v1/auth/refresh').flush(
      { code: 'AUTH_SESSION_INVALID' },
      { status: 401, statusText: 'Unauthorized' },
    );

    expect(tokens.authenticated()).toBe(false);
    expect(tokens.accessToken()).toBeNull();
  });

  it('keeps the session for non-401 errors', () => {
    tokens.setSession(session({ accessToken: 'token-3' }));
    let receivedError: HttpErrorResponse | undefined;

    client.get('/api/v1/patient/requests').subscribe({
      error: (error: HttpErrorResponse) => {
        receivedError = error;
      },
    });

    http.expectOne('/api/v1/patient/requests').flush(
      {},
      { status: 500, statusText: 'Server Error' },
    );

    expect(receivedError?.status).toBe(500);
    expect(tokens.authenticated()).toBe(true);
  });
});

function session(overrides: Partial<LoginSession> = {}): LoginSession {
  return {
    accessToken: 'opaque-access',
    tokenType: 'Bearer',
    expiresAt: '2999-08-07T12:15:00Z',
    refreshToken: 'opaque-refresh',
    refreshExpiresAt: '2999-08-08T00:15:00Z',
    user: { id: 'user-1', role: 'PATIENT', mustChangePassword: false },
    ...overrides,
  };
}
