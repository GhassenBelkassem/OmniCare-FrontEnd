import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { RUNTIME_CONFIG } from '../config/runtime-config';
import { authInterceptor } from './auth.interceptor';
import { AuthTokenStore } from './auth-token.store';

describe('authInterceptor', () => {
  let http: HttpTestingController;
  let client: HttpClient;
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
    tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'expired-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-07T12:00:00Z',
      refreshToken: 'valid-refresh-token',
      refreshExpiresAt: '2026-08-08T00:00:00Z',
      user: { id: 'clinic-user-1', role: 'CLINIC_ASSISTANT', mustChangePassword: false },
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    sessionStorage.clear();
  });

  it('authorizes protected requests with the access token', () => {
    client.get('/api/v1/me/access').subscribe();

    const request = http.expectOne('/api/v1/me/access');
    expect(request.request.headers.get('Authorization')).toBe('Bearer expired-access-token');
    request.flush({ contractVersion: '1.0', accessFamily: 'CLINIC', resolvedAt: '2026-08-07T12:00:00Z' });
  });

  it('refreshes an expired access token without sending the expired bearer to the refresh endpoint', () => {
    client.get('/api/v1/me/access').subscribe();

    http
      .expectOne('/api/v1/me/access')
      .flush({ code: 'UNAUTHENTICATED', message: 'Session expired.' }, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.headers.has('Authorization')).toBe(false);
    expect(refresh.request.body).toEqual({ refreshToken: 'valid-refresh-token' });
    refresh.flush({
      accessToken: 'new-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-07T12:15:00Z',
      refreshToken: 'rotated-refresh-token',
      refreshExpiresAt: '2026-08-08T00:15:00Z',
      user: { id: 'clinic-user-1', role: 'CLINIC_ASSISTANT', mustChangePassword: false },
    });

    const retry = http.expectOne('/api/v1/me/access');
    expect(retry.request.headers.get('Authorization')).toBe('Bearer new-access-token');
    retry.flush({ contractVersion: '1.0', accessFamily: 'CLINIC', resolvedAt: '2026-08-07T12:15:00Z' });

    expect(tokens.accessToken()).toBe('new-access-token');
    expect(tokens.refreshToken()).toBe('rotated-refresh-token');
  });
});
