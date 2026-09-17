import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { DoctorNotificationApiService } from './doctor-notification-api.service';

describe('DoctorNotificationApiService', () => {
  let service: DoctorNotificationApiService;
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
      accessToken: 'doctor-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'doctor-refresh-token',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false },
    });
    service = TestBed.inject(DoctorNotificationApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the notification list with the access token', () => {
    service.list().subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/notifications');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({
      items: [
        {
          id: 'n-1',
          type: 'URGENT_REQUEST_OFFER',
          priority: 'CRITICAL',
          category: 'URGENT_REQUESTS',
          titleFr: 'Nouvelle demande urgente',
          bodyFr: 'Hedi Bouazizi vous attend.',
          titleAr: '',
          bodyAr: '',
          deepLinkPayload: null,
          read: false,
          createdAt: '2026-08-06T09:00:00Z',
        },
      ],
      page: 0,
      pageSize: 20,
      totalElements: 1,
      unreadCount: 1,
    });
  });

  it('loads the unread count', () => {
    service.unreadCount().subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/notifications/unread-count',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ unreadCount: 3 });
  });

  it('marks a single notification as read via POST', () => {
    service.markRead('n-1').subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/notifications/n-1/read',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush(null);
  });

  it('marks all notifications as read via POST', () => {
    service.markAllRead().subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/notifications/read-all',
    );
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ updated: 2 });
  });
});
