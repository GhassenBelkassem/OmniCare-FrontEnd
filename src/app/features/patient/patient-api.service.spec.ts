import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { authInterceptor } from '../../core/auth/auth.interceptor';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RUNTIME_CONFIG } from '../../core/config/runtime-config';
import { PatientApiService } from './patient-api.service';

describe('PatientApiService', () => {
  let service: PatientApiService;
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
      accessToken: 'patient-access-token',
      tokenType: 'Bearer',
      expiresAt: '2026-08-05T12:10:00Z',
      refreshToken: 'patient-refresh-token',
      refreshExpiresAt: '2026-08-06T00:00:00Z',
      user: { id: 'patient-1', role: 'PATIENT', mustChangePassword: false },
    });
    service = TestBed.inject(PatientApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('authorizes the available doctors request with the in-memory access token', () => {
    service.availableDoctors(36.8065, 10.1815, 20).subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/urgent-requests/available-doctors',
    );
    expect(request.request.headers.get('Authorization')).toBe('Bearer patient-access-token');
    expect(request.request.params.get('lat')).toBe('36.8065');
    expect(request.request.params.get('lng')).toBe('10.1815');
    expect(request.request.params.get('radius')).toBe('20');
    request.flush([]);
  });

  it('loads slots for a doctor over a window', () => {
    service.slots('doctor-1', '2026-08-13T00:00:00.000Z', '2026-08-20T00:00:00.000Z').subscribe();
    const request = http.expectOne(
      (candidate) => candidate.url === '/api/v1/appointments/availability/slots',
    );
    expect(request.request.params.get('doctorId')).toBe('doctor-1');
    expect(request.request.params.get('from')).toBe('2026-08-13T00:00:00.000Z');
    expect(request.request.params.get('to')).toBe('2026-08-20T00:00:00.000Z');
    request.flush([]);
  });

  it('loads the doctor directory with the access token', () => {
    service.doctors().subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/doctors');
    expect(request.request.method).toBe('GET');
    expect(request.request.headers.get('Authorization')).toBe('Bearer patient-access-token');
    request.flush([]);
  });

  it('books an appointment by posting the exact slot instants', () => {
    service
      .book({
        doctorId: 'doctor-1',
        startTime: '2026-08-13T09:00:00',
        endTime: '2026-08-13T09:30:00',
        notes: 'Suivi',
      })
      .subscribe();
    const request = http.expectOne('/api/v1/appointments');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      doctorId: 'doctor-1',
      startTime: '2026-08-13T09:00:00',
      endTime: '2026-08-13T09:30:00',
      notes: 'Suivi',
    });
    request.flush({});
  });

  it('loads the patient appointments for a period', () => {
    service.appointments('from-iso', 'to-iso').subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/appointments');
    expect(request.request.params.get('from')).toBe('from-iso');
    expect(request.request.params.get('to')).toBe('to-iso');
    request.flush([]);
  });

  it('cancels an appointment', () => {
    service.cancelAppointment('appt-1').subscribe();
    const request = http.expectOne('/api/v1/appointments/appt-1/cancel');
    expect(request.request.method).toBe('PATCH');
    request.flush({});
  });

  it('creates an urgent request broadcast without target selection', () => {
    service
      .createUrgentRequest({
        patientLatitude: 36.8,
        patientLongitude: 10.18,
        visitPreference: 'HOME_VISIT',
        notes: 'Douleur',
      })
      .subscribe();
    const request = http.expectOne('/api/v1/urgent-requests');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      patientLatitude: 36.8,
      patientLongitude: 10.18,
      visitPreference: 'HOME_VISIT',
      notes: 'Douleur',
    });
    request.flush({});
  });

  it('loads a single urgent request', () => {
    service.urgentRequest('urgent-1').subscribe();
    const request = http.expectOne('/api/v1/urgent-requests/urgent-1');
    expect(request.request.method).toBe('GET');
    request.flush({});
  });

  it('loads the accepted offers of an urgent request', () => {
    service.urgentOffers('urgent-1').subscribe();
    const request = http.expectOne('/api/v1/urgent-requests/urgent-1/offers');
    expect(request.request.method).toBe('GET');
    request.flush([]);
  });

  it('selects a doctor for an urgent request', () => {
    service.selectDoctor('urgent-1', 'offer-1').subscribe();
    const request = http.expectOne('/api/v1/urgent-requests/urgent-1/select');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({ offerId: 'offer-1' });
    request.flush({});
  });

  it('loads the patient profile without medical data', () => {
    service.profile().subscribe();
    const request = http.expectOne((candidate) => candidate.url === '/api/v1/profile');
    expect(request.request.params.get('includeMedical')).toBe('false');
    request.flush({});
  });

  it('updates the profile', () => {
    service.updateProfile({ firstName: 'Noura', notificationAppointments: false }).subscribe();
    const request = http.expectOne('/api/v1/profile');
    expect(request.request.method).toBe('PATCH');
    expect(request.request.body).toEqual({
      firstName: 'Noura',
      notificationAppointments: false,
    });
    request.flush({});
  });

  it('changes the password', () => {
    service
      .changePassword({ currentPassword: 'old-password', newPassword: 'new-password-123' })
      .subscribe();
    const request = http.expectOne('/api/v1/auth/password/change');
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      currentPassword: 'old-password',
      newPassword: 'new-password-123',
    });
    request.flush(null);
  });
});
