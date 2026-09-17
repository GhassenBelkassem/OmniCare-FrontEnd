import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { DoctorUrgentApiService } from './doctor-urgent-api.service';

describe('DoctorUrgentApiService', () => {
  let service: DoctorUrgentApiService;
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
    service = TestBed.inject(DoctorUrgentApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('loads the urgent availability status with the access token', () => {
    service.getStatus().subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/availability',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ availableForUrgent: false });
  });

  it('toggles the urgent availability via PATCH', () => {
    service
      .toggle({
        acceptsHomeVisits: true,
        acceptsCabinetVisits: true,
        currentLatitude: 36.8065,
        currentLongitude: 10.1815,
      })
      .subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/availability',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      acceptsHomeVisits: true,
      acceptsCabinetVisits: true,
      currentLatitude: 36.8065,
      currentLongitude: 10.1815,
    });
    request.flush({
      acceptsHomeVisits: true,
      acceptsCabinetVisits: true,
      availableForUrgent: true,
      currentLatitude: 36.8065,
      currentLongitude: 10.1815,
    });
  });

  it('loads the incoming pending offers with the access token', () => {
    service.incoming().subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/incoming',
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush([
      {
        offerId: 'offer-1',
        requestId: 'request-1',
        doctorId: 'doctor-1',
        status: 'PENDING',
        sentAt: '2026-08-06T09:00:00Z',
        respondedAt: null,
        patientName: 'Hedi Bouazizi',
        patientLatitude: 36.8065,
        patientLongitude: 10.1815,
        visitPreference: 'HOME_VISIT',
        notes: 'Douleur abdominale',
      },
    ]);
  });

  it('accepts an offer via PATCH on the offer endpoint', () => {
    service.accept('offer-1').subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/offers/offer-1/accept',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ offerId: 'offer-1', status: 'ACCEPTED' });
  });

  it('declines an offer via PATCH on the offer endpoint', () => {
    service.decline('offer-1').subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/offers/offer-1/decline',
    );
    expect(request.request.method).toBe('PATCH');
    expect(request.request.headers.get('Authorization')).toBe('Bearer doctor-access-token');
    request.flush({ offerId: 'offer-1', status: 'DECLINED' });
  });
});
