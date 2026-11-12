import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { RUNTIME_CONFIG } from '../../../core/config/runtime-config';
import { ScheduledCareApiService } from './scheduled-care-api.service';
import type { Appointment } from './scheduled-care.models';

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
    appointment.flush({
      appointmentId: 'appointment-9',
      sourceBookingRequestId: 'request-1',
      version: 1,
      status: 'CONFIRMED',
      doctor: { doctorId: 'doctor-1', displayName: 'Dr Test', specialty: null },
      subject: { subjectType: 'SELF', familyMemberId: null, displayName: 'Patient', relationship: null },
      cabinet: {
        practiceLocationId: 'cabinet-1', name: 'Cabinet', address: '', city: '',
        governorate: '', timezone: 'Africa/Tunis',
      },
      slot: {
        start: '2026-11-09T09:20:00Z', end: '2026-11-09T09:40:00Z',
        timezone: 'Africa/Tunis', durationMinutes: 20,
      },
      quotedPrice: null,
      confirmedAt: '2026-11-09T01:38:01Z',
      createdAt: '2026-11-09T01:38:01Z',
      updatedAt: '2026-11-09T01:38:01Z',
      cancellation: null,
      intakeStatus: null,
      availableActions: [],
    });
  });

  it('normalizes a direct Practice Patient appointment with its authoritative agenda overview', () => {
    let result: Appointment | undefined;
    api.getAppointment('91af3821-24cb-4e0f-8ab8-f6f49b4be009', {
      resourceType: 'APPOINTMENT',
      requestId: null,
      appointmentId: '91af3821-24cb-4e0f-8ab8-f6f49b4be009',
      sourceBookingRequestId: null,
      version: 0,
      status: 'CONFIRMED',
      doctor: { displayName: 'Dr Certification', specialty: 'Médecine générale' },
      subject: {
        subjectType: 'PRACTICE_PATIENT',
        displayName: 'Phase3 Certification',
        relationship: 'PRACTICE_PATIENT',
      },
      cabinet: {
        name: 'Cabinet Tunis', address: '1 rue Test', city: 'Tunis',
        governorate: 'Tunis', timezone: 'Africa/Tunis',
      },
      start: '2026-11-09T09:20:00Z',
      end: '2026-11-09T09:40:00Z',
      timezone: 'Africa/Tunis',
      responseDeadline: null,
      cancellation: null,
      intakeStatus: null,
      availableActions: ['CANCEL_APPOINTMENT'],
      sortAt: '2026-11-09T09:20:00Z',
      updatedAt: '2026-11-09T01:38:01.167300Z',
    }).subscribe((appointment) => { result = appointment; });

    const request = http.expectOne(
      '/api/v1/appointments/91af3821-24cb-4e0f-8ab8-f6f49b4be009',
    );
    request.flush({
      id: '91af3821-24cb-4e0f-8ab8-f6f49b4be009',
      doctorId: 'a7783496-d568-4dd6-a496-00551256f34f',
      patientId: null,
      patientName: 'Phase3 Certification',
      startTime: '2026-11-09T09:20:00Z',
      endTime: '2026-11-09T09:40:00Z',
      status: 'CONFIRMED',
      source: 'PRACTICE_PATIENT',
      notes: null,
      quotedPriceTnd: 100,
      startedAt: null,
      completedAt: null,
      createdAt: '2026-11-09T01:38:01.167300Z',
      subjectType: 'PRACTICE_PATIENT',
      practicePatientId: '46fef143-78d8-4ad4-9241-19cce9170ed4',
    });

    expect(result).toMatchObject({
      appointmentId: '91af3821-24cb-4e0f-8ab8-f6f49b4be009',
      sourceBookingRequestId: null,
      version: 0,
      status: 'CONFIRMED',
      doctor: {
        doctorId: 'a7783496-d568-4dd6-a496-00551256f34f',
        displayName: 'Dr Certification',
      },
      subject: { subjectType: 'PRACTICE_PATIENT', displayName: 'Phase3 Certification' },
      cabinet: { name: 'Cabinet Tunis', timezone: 'Africa/Tunis' },
      slot: { start: '2026-11-09T09:20:00Z', durationMinutes: 20 },
      quotedPrice: { amount: 100, currency: 'TND' },
      practicePatient: {
        practicePatientId: '46fef143-78d8-4ad4-9241-19cce9170ed4',
      },
    });
  });

  it('keeps a flat appointment read-only when no authoritative version is available', () => {
    let version: number | null | undefined;
    api.getAppointment('appointment-legacy').subscribe((appointment) => {
      version = appointment.version;
    });
    http.expectOne('/api/v1/appointments/appointment-legacy').flush({
      id: 'appointment-legacy',
      doctorId: 'doctor-1',
      patientId: null,
      patientName: 'Patient externe',
      startTime: '2026-11-09T09:20:00Z',
      endTime: '2026-11-09T09:40:00Z',
      status: 'CONFIRMED',
      source: 'PRACTICE_PATIENT',
      notes: null,
      quotedPriceTnd: null,
      createdAt: '2026-11-09T01:38:01Z',
      subjectType: 'PRACTICE_PATIENT',
      practicePatientId: 'practice-1',
    });
    expect(version).toBeNull();
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
    let cancelled: { version: number | null; status: string; availableActions: readonly string[] } | null = null;
    api.cancelAppointment('appointment-1', 3, 'DOCTOR_UNAVAILABLE', 'cancel-key').subscribe((value) => (cancelled = value));
    const decline = http.expectOne('/api/v1/doctor/booking-requests/request-1/decline');
    const cancel = http.expectOne('/api/v1/appointments/appointment-1/cancel');
    expect(decline.request.body).toEqual({ expectedVersion: 2, reasonCode: 'SCHEDULE_CONFLICT' });
    expect(decline.request.headers.get('Idempotency-Key')).toBe('decline-key');
    expect(cancel.request.body).toEqual({ expectedVersion: 3, reasonCode: 'DOCTOR_UNAVAILABLE' });
    expect(cancel.request.headers.get('Idempotency-Key')).toBe('cancel-key');
    decline.flush({});
    // G-1 P3b: an appointment that did not come from a booking request answers with the GET shape.
    cancel.flush({
      id: 'appointment-1', doctorId: 'doctor-1', patientId: null, patientName: 'Marwa Mechergui',
      startTime: '2026-11-12T08:00:00Z', endTime: '2026-11-12T08:30:00Z', status: 'CANCELLED',
      source: 'PRACTICE_PATIENT', notes: null, quotedPriceTnd: null, startedAt: null, completedAt: null,
      createdAt: '2026-11-01T08:00:00Z', subjectType: 'PRACTICE_PATIENT', practicePatientId: 'chart-1', version: 4,
    });
    expect(cancelled).toEqual(expect.objectContaining({ status: 'CANCELLED', version: 4, availableActions: [] }));
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
