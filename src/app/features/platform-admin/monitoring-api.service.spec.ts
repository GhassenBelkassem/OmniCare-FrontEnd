import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { MonitoringApiService } from './monitoring-api.service';

/**
 * The client only ever talks to the platform API. These tests are the guard that a
 * monitoring infrastructure URL (Prometheus, Alertmanager, Elasticsearch, Kibana, Tempo)
 * can never reach the browser: every request must target `/api/v1/admin/monitoring/**`
 * and carry the administrator's bearer token.
 */
describe('MonitoringApiService', () => {
  let service: MonitoringApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    const tokens = TestBed.inject(AuthTokenStore);
    tokens.setSession({
      accessToken: 'admin-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'admin-refresh-token',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'admin-1', role: 'ADMIN', mustChangePassword: false },
    });
    service = TestBed.inject(MonitoringApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('reads the overview from the secured admin monitoring endpoint', () => {
    service.getOverview().subscribe();

    const request = http.expectOne('/api/v1/admin/monitoring/overview');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer admin-access-token');
    request.flush({ overallStatus: 'HEALTHY' });
  });

  it('asks for a bounded performance window', () => {
    service.getPerformance('15m').subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/performance');
    expect(request.request.params.get('window')).toBe('15m');
    request.flush({ window: '15m' });
  });

  it('reads operations and alerts from their own endpoints', () => {
    service.getOperations().subscribe();
    service.getAlerts().subscribe();

    http.expectOne('/api/v1/admin/monitoring/operations').flush({ groups: [] });
    http.expectOne('/api/v1/admin/monitoring/alerts').flush({ active: [] });
  });

  it('sends the request-history filters as closed-set query parameters', () => {
    service
      .searchRequests({
        window: '24h',
        outcome: 'SERVER_ERROR',
        onlyFailed: true,
        onlySlow: false,
        endpoint: '/api/v1/admin',
        requestId: 'abc12345',
        sort: 'duration',
        direction: 'desc',
        pageSize: 25,
        cursor: 'opaque-cursor',
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests');
    expect(request.request.params.get('window')).toBe('24h');
    expect(request.request.params.get('outcome')).toBe('SERVER_ERROR');
    expect(request.request.params.get('onlyFailed')).toBe('true');
    expect(request.request.params.get('onlySlow')).toBe('false');
    expect(request.request.params.get('endpoint')).toBe('/api/v1/admin');
    expect(request.request.params.get('requestId')).toBe('abc12345');
    expect(request.request.params.get('sort')).toBe('duration');
    expect(request.request.params.get('direction')).toBe('desc');
    expect(request.request.params.get('pageSize')).toBe('25');
    expect(request.request.params.get('cursor')).toBe('opaque-cursor');
    request.flush({ items: [] });
  });

  it('omits blank filters and a missing cursor so the backend applies its own defaults', () => {
    service
      .searchRequests({
        window: '1h',
        outcome: 'ALL',
        onlyFailed: false,
        onlySlow: false,
        endpoint: '   ',
        requestId: '',
        sort: 'occurredAt',
        direction: 'desc',
        pageSize: 25,
        cursor: null,
      })
      .subscribe();

    const request = http.expectOne((candidate) => candidate.url === '/api/v1/admin/monitoring/requests');
    expect(request.request.params.has('endpoint')).toBe(false);
    expect(request.request.params.has('requestId')).toBe(false);
    expect(request.request.params.has('cursor')).toBe(false);
    expect(request.request.params.get('window')).toBe('1h');
    request.flush({ items: [] });
  });

  it('escapes the request identifier in the detail lookup', () => {
    service.getRequestDetail('a/b c').subscribe();

    const request = http.expectOne('/api/v1/admin/monitoring/requests/a%2Fb%20c');
    expect(request.request.method).toBe('GET');
    request.flush({ requestId: 'a/b c' });
  });

  it('normalises a missing technical detail into an all-absent detail instead of null', () => {
    let detail: any;
    service.getRequestDetail('abc12345').subscribe((response) => (detail = response));

    http.expectOne('/api/v1/admin/monitoring/requests/abc12345').flush({ requestId: 'abc12345', detail: null });

    expect(detail?.detail.traceAvailable).toBe(false);
    expect(detail?.detail.logsAvailable).toBe(false);
    expect(detail?.detail.userRole).toBeNull();
  });
});
