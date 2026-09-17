import { HttpErrorResponse, HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from './auth.interceptor';
import { AuthTokenStore } from './auth-token.store';

function setup(): { http: HttpClient; controller: HttpTestingController; tokens: AuthTokenStore } {
  const tokens = TestBed.inject(AuthTokenStore);
  return {
    http: TestBed.inject(HttpClient),
    controller: TestBed.inject(HttpTestingController),
    tokens,
  };
}

describe('authInterceptor', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([authInterceptor])), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('attaches the bearer token to regular api requests', () => {
    const { http, controller, tokens } = setup();
    tokens.setSession({
      accessToken: 'token-1',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: '2026-09-20T00:00:00Z',
      refreshExpiresAt: '2026-11-19T00:00:00Z',
      user: { id: 'u1', role: 'PATIENT', mustChangePassword: false },
    });

    http.get('/api/v1/patient/requests').subscribe();

    const request = controller.expectOne('/api/v1/patient/requests');
    expect(request.request.headers.get('Authorization')).toBe('Bearer token-1');
    request.flush({});
  });

  it('does not attach the bearer token to the login endpoint', () => {
    const { http, controller, tokens } = setup();
    tokens.setSession({
      accessToken: 'stale-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: '2026-09-20T00:00:00Z',
      refreshExpiresAt: '2026-11-19T00:00:00Z',
      user: { id: 'u1', role: 'PATIENT', mustChangePassword: false },
    });

    http
      .post('/api/v1/auth/login', { identifier: 'patient@omnicare.local', password: 'secret' })
      .subscribe();

    const request = controller.expectOne('/api/v1/auth/login');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not attach the bearer token to otp, refresh, signup and google auth endpoints', () => {
    const { http, controller, tokens } = setup();
    tokens.setSession({
      accessToken: 'stale-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: '2026-09-20T00:00:00Z',
      refreshExpiresAt: '2026-11-19T00:00:00Z',
      user: { id: 'u1', role: 'PATIENT', mustChangePassword: false },
    });

    const urls = [
      '/api/v1/auth/login/phone/initiate',
      '/api/v1/auth/login/phone/verify',
      '/api/v1/auth/refresh',
      '/api/v1/auth/signup/phone/initiate',
      '/api/v1/auth/signup/complete',
      '/api/v1/auth/google/initiate',
      '/api/v1/auth/google/complete',
    ];

    for (const url of urls) {
      http.post(url, {}).subscribe();
      const request = controller.expectOne(url);
      expect(request.request.headers.has('Authorization')).toBe(false);
      request.flush({});
    }
  });

  it('still protects authenticated endpoints like logout and devices', () => {
    const { http, controller, tokens } = setup();
    tokens.setSession({
      accessToken: 'token-2',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: '2026-09-20T00:00:00Z',
      refreshExpiresAt: '2026-11-19T00:00:00Z',
      user: { id: 'u1', role: 'DOCTOR', mustChangePassword: false },
    });

    for (const url of ['/api/v1/auth/logout', '/api/v1/auth/devices', '/api/v1/auth/me']) {
      http.post(url, {}).subscribe();
      const request = controller.expectOne(url);
      expect(request.request.headers.get('Authorization')).toBe('Bearer token-2');
      request.flush({});
    }
  });

  it('clears the stored session when a request fails with 401', () => {
    const { http, controller, tokens } = setup();
    tokens.setSession({
      accessToken: 'dead-token',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: '2026-09-20T00:00:00Z',
      refreshExpiresAt: '2026-11-19T00:00:00Z',
      user: { id: 'u1', role: 'PATIENT', mustChangePassword: false },
    });

    http.get('/api/v1/patient/requests').subscribe({
      error: () => undefined,
    });

    const request = controller.expectOne('/api/v1/patient/requests');
    expect(request.request.headers.get('Authorization')).toBe('Bearer dead-token');
    request.flush({ code: 'AUTH_SESSION_INVALID' }, { status: 401, statusText: 'Unauthorized' });

    expect(tokens.authenticated()).toBe(false);
    expect(tokens.accessToken()).toBeNull();
  });

  it('keeps the session for non-401 errors', () => {
    const { http, controller, tokens } = setup();
    tokens.setSession({
      accessToken: 'token-3',
      refreshToken: 'refresh-1',
      tokenType: 'Bearer',
      expiresAt: '2026-09-20T00:00:00Z',
      refreshExpiresAt: '2026-11-19T00:00:00Z',
      user: { id: 'u1', role: 'PATIENT', mustChangePassword: false },
    });

    http.get('/api/v1/patient/requests').subscribe({
      error: (error: HttpErrorResponse) => expect(error.status).toBe(500),
    });

    const request = controller.expectOne('/api/v1/patient/requests');
    request.flush({}, { status: 500, statusText: 'Server Error' });

    expect(tokens.authenticated()).toBe(true);
  });
});
