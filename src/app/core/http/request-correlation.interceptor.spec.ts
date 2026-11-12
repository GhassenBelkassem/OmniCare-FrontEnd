import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { authInterceptor } from '../auth/auth.interceptor';
import { AuthTokenStore } from '../auth/auth-token.store';
import { RUNTIME_CONFIG } from '../config/runtime-config';
import { requestCorrelationInterceptor } from './request-correlation.interceptor';

describe('requestCorrelationInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let tokens: AuthTokenStore;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([requestCorrelationInterceptor, authInterceptor])),
        provideHttpClientTesting(),
        provideRouter([]),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
    tokens = TestBed.inject(AuthTokenStore);
  });

  afterEach(() => http.verify());

  it('adds a UUID only to backend API requests and preserves a valid caller ID', () => {
    client.get('/api/v1/health').subscribe();
    const api = http.expectOne('/api/v1/health');
    expect(api.request.headers.get('X-Request-Id')).toMatch(/^[0-9a-f-]{36}$/i);
    api.flush({});

    const supplied = '44a5c3fb-8f4f-4204-bf42-5f4a7e060ecb';
    client.get('/api/v1/health', { headers: { 'X-Request-Id': supplied } }).subscribe();
    const propagated = http.expectOne('/api/v1/health');
    expect(propagated.request.headers.get('X-Request-Id')).toBe(supplied);
    propagated.flush({});

    client.get('/assets/config.json').subscribe();
    const asset = http.expectOne('/assets/config.json');
    expect(asset.request.headers.has('X-Request-Id')).toBe(false);
    asset.flush({});
  });

  it('retains the same request ID, body, and idempotency key for the one authentication replay', () => {
    tokens.setSession(session('expired', 'refresh-token'));
    client.post('/api/v1/clinical/mutation', { expectedVersion: 7 }, {
      headers: { 'Idempotency-Key': 'operation-1' },
    }).subscribe();

    const initial = http.expectOne('/api/v1/clinical/mutation');
    const requestId = initial.request.headers.get('X-Request-Id');
    initial.flush({}, { status: 401, statusText: 'Unauthorized' });

    const refresh = http.expectOne('/api/v1/auth/refresh');
    expect(refresh.request.headers.get('X-Request-Id')).not.toBe(requestId);
    refresh.flush(session('fresh', 'rotated'));

    const replay = http.expectOne('/api/v1/clinical/mutation');
    expect(replay.request.headers.get('X-Request-Id')).toBe(requestId);
    expect(replay.request.headers.get('Idempotency-Key')).toBe('operation-1');
    expect(replay.request.body).toEqual({ expectedVersion: 7 });
    replay.flush({});
  });

  it('does not refresh or replay a mutation after an ambiguous network failure', () => {
    tokens.setSession(session('access', 'refresh-token'));
    let status: number | undefined;
    client.post('/api/v1/clinical/mutation', {}).subscribe({ error: (error) => { status = error.status; } });
    http.expectOne('/api/v1/clinical/mutation').error(new ProgressEvent('error'));

    http.expectNone('/api/v1/auth/refresh');
    http.expectNone('/api/v1/clinical/mutation');
    expect(status).toBe(0);
  });
});

function session(accessToken: string, refreshToken: string) {
  return {
    accessToken,
    tokenType: 'Bearer' as const,
    expiresAt: '2999-08-07T12:15:00Z',
    refreshToken,
    refreshExpiresAt: '2999-08-08T00:15:00Z',
    user: { id: 'doctor-1', role: 'DOCTOR' as const, mustChangePassword: false },
  };
}
