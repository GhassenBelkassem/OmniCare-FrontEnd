import { HttpErrorResponse } from '@angular/common/http';
import { PLATFORM_ID, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AuthTokenStore } from '../../../core/auth/auth-token.store';
import type { ScheduledCareEvent } from '../../../core/realtime/live-event.models';
import { RealtimeService } from '../../../core/realtime/realtime.service';
import { ScheduledCareApiService } from './scheduled-care-api.service';
import { ScheduledCareFacade } from './scheduled-care.facade';
import type { Appointment, BookingRequest, DoctorHomeSummary } from './scheduled-care.models';

function bookingRequest(
  overrides: Partial<BookingRequest> = {},
): BookingRequest {
  return {
    requestId: 'request-1',
    version: 3,
    status: 'PENDING_DOCTOR',
    subject: { subjectType: 'SELF', familyMemberId: null, displayName: 'Amira Test', relationship: 'Patient' },
    cabinet: {
      practiceLocationId: 'cabinet-1',
      name: 'Cabinet Tunis',
      address: '1 rue Test',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    originalRequestedSlot: { start: '2026-10-12T08:00:00Z', end: '2026-10-12T08:30:00Z' },
    proposedSlot: null,
    activeSlot: { start: '2026-10-12T08:00:00Z', end: '2026-10-12T08:30:00Z', durationMinutes: 30 },
    createdAt: '2026-10-08T08:00:00Z',
    responseDeadline: '2026-10-09T08:00:00Z',
    patientResponseDeadline: null,
    confirmedAppointmentId: null,
    cancellation: null,
    expiredAt: null,
    expiryReason: null,
    slotReleased: false,
    availableActions: ['ACCEPT_REQUEST', 'PROPOSE_NEW_TIME', 'DECLINE_REQUEST'],
    updatedAt: '2026-10-08T08:00:00Z',
    ...overrides,
  };
}

function appointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    appointmentId: 'appointment-1',
    sourceBookingRequestId: 'request-1',
    version: 1,
    status: 'CONFIRMED',
    doctor: { doctorId: 'doctor-1', displayName: 'Dr Test', specialty: 'Médecine générale' },
    subject: { subjectType: 'SELF', familyMemberId: null, displayName: 'Amira Test', relationship: 'Patient' },
    cabinet: {
      practiceLocationId: 'cabinet-1',
      name: 'Cabinet Tunis',
      address: '1 rue Test',
      city: 'Tunis',
      governorate: 'Tunis',
      timezone: 'Africa/Tunis',
    },
    slot: { start: '2026-10-12T08:00:00Z', end: '2026-10-12T08:30:00Z', durationMinutes: 30, timezone: 'Africa/Tunis' },
    quotedPrice: null,
    confirmedAt: '2026-10-08T08:10:00Z',
    createdAt: '2026-10-08T08:00:00Z',
    updatedAt: '2026-10-08T08:10:00Z',
    cancellation: null,
    intakeStatus: null,
    availableActions: ['CANCEL_APPOINTMENT'],
    ...overrides,
  };
}

const home: DoctorHomeSummary = {
  generatedAt: '2026-10-08T08:00:00Z',
  pendingRequestCount: 1,
  nextPendingRequest: null,
  nextConfirmedAppointment: null,
};

describe('ScheduledCareFacade', () => {
  let events: Subject<ScheduledCareEvent>;
  let connectionEpoch: ReturnType<typeof signal<number>>;
  let api: {
    getDoctorHomeSummary: ReturnType<typeof vi.fn>;
    getDoctorBookingRequest: ReturnType<typeof vi.fn>;
    acceptBookingRequest: ReturnType<typeof vi.fn>;
    proposeBookingTime: ReturnType<typeof vi.fn>;
    declineBookingRequest: ReturnType<typeof vi.fn>;
    getAppointment: ReturnType<typeof vi.fn>;
    cancelAppointment: ReturnType<typeof vi.fn>;
    getAvailability: ReturnType<typeof vi.fn>;
  };
  let facade: ScheduledCareFacade;

  beforeEach(() => {
    events = new Subject<ScheduledCareEvent>();
    connectionEpoch = signal(0);
    api = {
      getDoctorHomeSummary: vi.fn(() => of(home)),
      getDoctorBookingRequest: vi.fn(() => of(bookingRequest())),
      acceptBookingRequest: vi.fn(() => of({
        request: bookingRequest({ status: 'FULFILLED', availableActions: [], confirmedAppointmentId: 'appointment-1' }),
        appointment: appointment(),
      })),
      proposeBookingTime: vi.fn(() => of(bookingRequest({ status: 'PENDING_PATIENT_TIME_CONFIRMATION', version: 4, availableActions: [] }))),
      declineBookingRequest: vi.fn(() => of(bookingRequest({ status: 'CANCELLED_BY_DOCTOR', version: 4, availableActions: [] }))),
      getAppointment: vi.fn(() => of(appointment())),
      cancelAppointment: vi.fn(() => of(appointment({ status: 'CANCELLED', version: 2, availableActions: [] }))),
      getAvailability: vi.fn(() => of({ doctorId: 'doctor-1', practiceLocationId: 'cabinet-1', timezone: 'Africa/Tunis', generatedAt: '', slots: [] })),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: PLATFORM_ID, useValue: 'browser' },
        { provide: ScheduledCareApiService, useValue: api },
        {
          provide: RealtimeService,
          useValue: { scheduledCareEvents$: events, connectionEpoch },
        },
        {
          provide: AuthTokenStore,
          useValue: { user: signal({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false }) },
        },
      ],
    });
    facade = TestBed.inject(ScheduledCareFacade);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads the authoritative Home summary', () => {
    facade.loadHome();
    expect(facade.home()).toBe(home);
    expect(facade.home()?.pendingRequestCount).toBe(1);
  });

  it('keeps an authoritative empty Home summary distinct from loading', () => {
    api.getDoctorHomeSummary.mockReturnValueOnce(of({
      ...home,
      pendingRequestCount: 0,
      nextPendingRequest: null,
      nextConfirmedAppointment: null,
    }));
    facade.loadHome();
    expect(facade.homeLoading()).toBe(false);
    expect(facade.home()?.pendingRequestCount).toBe(0);
    expect(facade.home()?.nextPendingRequest).toBeNull();
  });

  it('exposes a safe retryable Home error', () => {
    api.getDoctorHomeSummary.mockReturnValueOnce(throwError(() => new Error('raw failure')));
    facade.loadHome();
    expect(facade.homeLoading()).toBe(false);
    expect(facade.homeError()).toBe('Impossible de charger les rendez-vous planifiés.');
    expect(facade.homeError()).not.toContain('raw failure');
  });

  it('uses server availableActions as the command gate', () => {
    api.getDoctorBookingRequest.mockReturnValueOnce(of(bookingRequest({ availableActions: [] })));
    facade.openRequest('request-1');
    facade.acceptRequest();
    expect(api.acceptBookingRequest).not.toHaveBeenCalled();
  });

  it('retains one idempotency key across an unknown accept outcome', () => {
    api.acceptBookingRequest.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Network error' })),
    );
    facade.openRequest('request-1');

    facade.acceptRequest();
    facade.acceptRequest();

    expect(api.acceptBookingRequest).toHaveBeenCalledTimes(2);
    expect(api.acceptBookingRequest.mock.calls[0]?.[2]).toBe(
      api.acceptBookingRequest.mock.calls[1]?.[2],
    );
    expect(facade.commandOutcomeUnknown()).toBe(true);
  });

  it('retains the proposal key for the same exact slot after transport loss', () => {
    api.proposeBookingTime.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    const slot = { start: '2026-10-13T09:00:00Z', end: '2026-10-13T09:30:00Z', durationMinutes: 30 };
    facade.openRequest('request-1');
    facade.proposeTime(slot);
    facade.proposeTime(slot);
    expect(api.proposeBookingTime.mock.calls[0]?.[2]).toBe(
      api.proposeBookingTime.mock.calls[1]?.[2],
    );
  });

  it('retains the decline key for the same controlled decision after transport loss', () => {
    api.declineBookingRequest.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    facade.openRequest('request-1');
    facade.declineRequest('SCHEDULE_CONFLICT');
    facade.declineRequest('SCHEDULE_CONFLICT');
    expect(api.declineBookingRequest.mock.calls[0]?.[3]).toBe(
      api.declineBookingRequest.mock.calls[1]?.[3],
    );
  });

  it('retains the appointment cancellation key after transport loss', () => {
    api.cancelAppointment.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0 })),
    );
    facade.openAppointment('appointment-1');
    facade.cancelAppointment('DOCTOR_UNAVAILABLE');
    facade.cancelAppointment('DOCTOR_UNAVAILABLE');
    expect(api.cancelAppointment.mock.calls[0]?.[3]).toBe(
      api.cancelAppointment.mock.calls[1]?.[3],
    );
  });

  it('updates from the accept response without aliasing request and appointment IDs', () => {
    facade.openRequest('request-1');
    facade.acceptRequest();
    expect(facade.activeRequest()?.requestId).toBe('request-1');
    expect(facade.activeRequest()?.confirmedAppointmentId).toBe('appointment-1');
    expect(facade.activeRequest()?.requestId).not.toBe(facade.activeRequest()?.confirmedAppointmentId);
  });

  it('refetches without retrying the mutation after a version conflict', () => {
    api.getDoctorBookingRequest
      .mockReturnValueOnce(of(bookingRequest()))
      .mockReturnValueOnce(of(bookingRequest({ version: 4 })));
    api.acceptBookingRequest.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { errorCode: 'VERSION_CONFLICT' } })),
    );
    facade.openRequest('request-1');
    facade.acceptRequest();
    expect(api.acceptBookingRequest).toHaveBeenCalledOnce();
    expect(facade.activeRequest()?.version).toBe(4);
  });

  it('renders server-materialized expiry after REQUEST_EXPIRED', () => {
    api.getDoctorBookingRequest
      .mockReturnValueOnce(of(bookingRequest()))
      .mockReturnValueOnce(of(bookingRequest({
        status: 'EXPIRED',
        version: 4,
        expiredAt: '2026-10-09T08:00:00Z',
        expiryReason: 'DOCTOR_RESPONSE_DEADLINE',
        slotReleased: true,
        availableActions: [],
      })));
    api.acceptBookingRequest.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 409, error: { errorCode: 'REQUEST_EXPIRED' } })),
    );
    facade.openRequest('request-1');
    facade.acceptRequest();
    expect(facade.activeRequest()?.status).toBe('EXPIRED');
    expect(facade.activeRequest()?.availableActions).toEqual([]);
  });

  it('submits a selected authoritative slot with the latest version and cabinet', () => {
    facade.openRequest('request-1');
    facade.proposeTime({ start: '2026-10-13T09:00:00Z', end: '2026-10-13T09:30:00Z', durationMinutes: 30 });
    expect(api.proposeBookingTime.mock.calls[0]?.[1]).toEqual({
      expectedVersion: 3,
      practiceLocationId: 'cabinet-1',
      proposedSlot: { start: '2026-10-13T09:00:00Z', end: '2026-10-13T09:30:00Z' },
    });
    expect(facade.activeRequest()?.status).toBe('PENDING_PATIENT_TIME_CONFIRMATION');
  });

  it('reconciles request and availability after a proposal slot race', () => {
    api.proposeBookingTime.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { errorCode: 'SLOT_NO_LONGER_AVAILABLE' },
      })),
    );
    facade.openRequest('request-1');
    facade.proposeTime({ start: '2026-10-13T09:00:00Z', end: '2026-10-13T09:30:00Z', durationMinutes: 30 });
    expect(facade.activeRequest()?.status).toBe('PENDING_DOCTOR');
    expect(api.getAvailability).toHaveBeenCalledOnce();
  });

  it('requires the cancellation action and sends a controlled reason', () => {
    facade.openAppointment('appointment-1');
    facade.cancelAppointment('CABINET_UNAVAILABLE');
    expect(api.cancelAppointment.mock.calls[0]?.slice(0, 3)).toEqual([
      'appointment-1', 1, 'CABINET_UNAVAILABLE',
    ]);
    expect(facade.activeAppointment()?.status).toBe('CANCELLED');
  });

  it('treats realtime as invalidation and refetches visible REST state', () => {
    facade.loadHome();
    facade.openRequest('request-1');
    api.getDoctorHomeSummary.mockClear();
    api.getDoctorBookingRequest.mockClear();
    const before = facade.projectionInvalidationEpoch();

    events.next({
      eventId: 'event-1',
      eventType: 'REQUEST_UPDATED',
      resourceType: 'BOOKING_REQUEST',
      resourceId: 'request-1',
      version: 4,
      occurredAt: '2026-10-08T09:00:00Z',
    });

    expect(api.getDoctorHomeSummary).toHaveBeenCalledOnce();
    expect(api.getDoctorBookingRequest).toHaveBeenCalledWith('request-1');
    expect(facade.projectionInvalidationEpoch()).toBe(before + 1);
  });

  it('resyncs bounded visible state on reconnect', () => {
    facade.loadHome();
    api.getDoctorHomeSummary.mockClear();
    const before = facade.projectionInvalidationEpoch();
    connectionEpoch.set(1);
    TestBed.flushEffects();
    expect(api.getDoctorHomeSummary).toHaveBeenCalledOnce();
    expect(facade.projectionInvalidationEpoch()).toBe(before + 1);
  });

  it('resyncs through REST when the browser tab becomes visible', () => {
    facade.loadHome();
    api.getDoctorHomeSummary.mockClear();
    const before = facade.projectionInvalidationEpoch();
    Object.defineProperty(document, 'visibilityState', { configurable: true, value: 'visible' });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(api.getDoctorHomeSummary).toHaveBeenCalledOnce();
    expect(facade.projectionInvalidationEpoch()).toBe(before + 1);
  });
});
