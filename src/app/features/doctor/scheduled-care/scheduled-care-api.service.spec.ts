import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { ScheduledCareApiService } from './scheduled-care-api.service';

describe('ScheduledCareApiService', () => {
  let api: ScheduledCareApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: RUNTIME_CONFIG, useValue: { apiBaseUrl: '/api/v1' } },
      ],
    });
    api = TestBed.inject(ScheduledCareApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('sends the exact bounded doctor agenda range', () => {
    api.getDoctorScheduledCare('2026-10-01T00:00:00Z', '2026-11-01T00:00:00Z').subscribe();
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/doctor/scheduled-care' &&
        candidate.params.get('from') === '2026-10-01T00:00:00Z' &&
        candidate.params.get('to') === '2026-11-01T00:00:00Z',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ generatedAt: '', from: '', to: '', items: [] });
  });

  it('keeps request and appointment detail endpoints distinct', () => {
    api.getDoctorBookingRequest('request-1').subscribe();
    api.getAppointment('appointment-9').subscribe();
    const request = http.expectOne('/api/v1/doctor/booking-requests/request-1');
    const appointment = http.expectOne('/api/v1/appointments/appointment-9');
    expect(request.request.url).not.toContain('appointment-9');
    expect(appointment.request.url).not.toContain('request-1');
    request.flush({});
    appointment.flush({});
  });

  it('sends accept version and idempotency key', () => {
    api.acceptBookingRequest('request-1', 4, 'accept-key').subscribe();
    const request = http.expectOne('/api/v1/doctor/booking-requests/request-1/accept');
    expect(request.request.method).toBe('POST');
    expect(request.request.headers.get('Idempotency-Key')).toBe('accept-key');
    expect(request.request.body).toEqual({ expectedVersion: 4 });
    request.flush({ request: {}, appointment: {} });
  });

  it('submits an exact real slot in the same cabinet', () => {
    api.proposeBookingTime(
      'request-1',
      {
        expectedVersion: 7,
        practiceLocationId: 'cabinet-1',
        proposedSlot: { start: '2026-10-12T08:00:00Z', end: '2026-10-12T08:30:00Z' },
      },
      'proposal-key',
    ).subscribe();
    const request = http.expectOne('/api/v1/doctor/booking-requests/request-1/proposals');
    expect(request.request.headers.get('Idempotency-Key')).toBe('proposal-key');
    expect(request.request.body).toEqual({
      expectedVersion: 7,
      practiceLocationId: 'cabinet-1',
      proposedSlot: { start: '2026-10-12T08:00:00Z', end: '2026-10-12T08:30:00Z' },
    });
    request.flush({});
  });

  it('uses controlled reasons and versions for decline and cancellation', () => {
    api.declineBookingRequest('request-1', 2, 'SCHEDULE_CONFLICT', 'decline-key').subscribe();
    api.cancelAppointment('appointment-1', 3, 'DOCTOR_UNAVAILABLE', 'cancel-key').subscribe();
    const decline = http.expectOne('/api/v1/doctor/booking-requests/request-1/decline');
    const cancel = http.expectOne('/api/v1/appointments/appointment-1/cancel');
    expect(decline.request.body).toEqual({ expectedVersion: 2, reasonCode: 'SCHEDULE_CONFLICT' });
    expect(decline.request.headers.get('Idempotency-Key')).toBe('decline-key');
    expect(cancel.request.body).toEqual({ expectedVersion: 3, reasonCode: 'DOCTOR_UNAVAILABLE' });
    expect(cancel.request.headers.get('Idempotency-Key')).toBe('cancel-key');
    decline.flush({});
    cancel.flush({});
  });

  it('requests authoritative cabinet-scoped availability', () => {
    api.getAvailability(
      'doctor-1',
      'cabinet-1',
      '2026-10-10T00:00:00Z',
      '2026-10-20T00:00:00Z',
    ).subscribe();
    const request = http.expectOne(
      (candidate) =>
        candidate.url === '/api/v1/appointments/availability/slots' &&
        candidate.params.get('doctorId') === 'doctor-1' &&
        candidate.params.get('practiceLocationId') === 'cabinet-1',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ doctorId: 'doctor-1', practiceLocationId: 'cabinet-1', timezone: 'Africa/Tunis', generatedAt: '', slots: [] });
  });
});
