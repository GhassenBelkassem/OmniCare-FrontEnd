import { signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ActiveConsultationApiService } from './active-consultation-api.service';
import type { ActiveConsultation } from './active-consultation.models';
import { ActiveConsultationStore } from './active-consultation.store';

const C123: ActiveConsultation = {
  consultationId: 'c123',
  sourceType: 'SCHEDULED_APPOINTMENT',
  sourceId: 'appointment-9',
  status: 'IN_PROGRESS',
  medicalAccessStatus: 'NONE',
  version: 1,
  startedAt: '2026-10-22T09:00:00Z',
};

describe('ActiveConsultationStore', () => {
  const user = signal<AuthenticatedUser | null>(null);
  const connectionEpoch = signal(0);
  let events: Subject<ScheduledCareEvent>;
  let getActive: ReturnType<typeof vi.fn>;
  let startScheduled: ReturnType<typeof vi.fn>;
  let startCanonical: ReturnType<typeof vi.fn>;
  let store: ActiveConsultationStore;

  beforeEach(() => {
    user.set(null);
    connectionEpoch.set(0);
    events = new Subject<ScheduledCareEvent>();
    getActive = vi.fn().mockReturnValue(of(C123));
    startScheduled = vi.fn().mockReturnValue(of(C123));
    startCanonical = vi.fn().mockReturnValue(of(C123));
    TestBed.configureTestingModule({
      providers: [
        {
          provide: ActiveConsultationApiService,
          useValue: { getActive, startScheduled, startCanonical },
        },
        {
          provide: RealtimeService,
          useValue: { scheduledCareEvents$: events, connectionEpoch },
        },
        { provide: AuthTokenStore, useValue: { user } },
      ],
    });
    store = TestBed.inject(ActiveConsultationStore);
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads C123 at Doctor startup and clears it on logout', async () => {
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(store.consultationId()).toBe('c123'));

    user.set(null);
    TestBed.flushEffects();
    expect(store.active()).toBeNull();
  });

  it('keeps state empty when Spring returns no active consultation', async () => {
    getActive.mockReturnValue(of(null));
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledOnce());
    expect(store.active()).toBeNull();
  });

  it('cannot be repopulated by an in-flight response after logout detaches it', async () => {
    const response = new Subject<ActiveConsultation>();
    getActive.mockReturnValue(response);
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledOnce());

    store.detach();
    response.next(C123);
    response.complete();

    await Promise.resolve();
    expect(store.active()).toBeNull();
    events.next({
      eventId: 'event-after-logout',
      eventType: 'CONSULTATION_ACTIVATED',
      resourceType: 'CONSULTATION',
      resourceId: 'c123',
      version: 1,
      occurredAt: '2026-10-22T09:00:00Z',
    });
    expect(getActive).toHaveBeenCalledOnce();
  });

  it('deduplicates access invalidation and refetches NONE to ACTIVE', async () => {
    const active = { ...C123, medicalAccessStatus: 'ACTIVE' as const, version: 2 };
    getActive.mockReturnValueOnce(of(C123)).mockReturnValue(of(active));
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(store.active()?.version).toBe(1));

    const event: ScheduledCareEvent = {
      eventId: 'event-1',
      eventType: 'CLINICAL_ACCESS_CHANGED',
      resourceType: 'CONSULTATION',
      resourceId: 'c123',
      version: 2,
      occurredAt: '2026-10-22T09:01:00Z',
    };
    events.next(event);
    events.next(event);

    await vi.waitFor(() => expect(store.active()?.medicalAccessStatus).toBe('ACTIVE'));
    expect(getActive).toHaveBeenCalledTimes(2);
  });

  it('ignores stale version hints and resyncs on reconnect', async () => {
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(store.active()).toEqual(C123));

    events.next({
      eventId: 'event-stale',
      eventType: 'CONSULTATION_UPDATED',
      resourceType: 'CONSULTATION',
      resourceId: 'c123',
      version: 1,
      occurredAt: '2026-10-22T09:02:00Z',
    });
    expect(getActive).toHaveBeenCalledTimes(1);

    connectionEpoch.update((value) => value + 1);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledTimes(2));
  });

  it('starts once for repeated taps and uses the exact Appointment version', async () => {
    const response = new Subject<ActiveConsultation>();
    getActive.mockReturnValue(of(null));
    startScheduled.mockReturnValue(response);
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledOnce());

    const first = store.startScheduledAppointment('appointment-9', 7);
    const second = store.startScheduledAppointment('appointment-9', 7);
    expect(first).toBe(second);
    expect(startScheduled).toHaveBeenCalledOnce();
    expect(startScheduled.mock.calls[0]?.slice(0, 2)).toEqual(['appointment-9', 7]);

    response.next(C123);
    response.complete();
    await expect(first).resolves.toEqual({ kind: 'STARTED', consultation: C123 });
  });

  it('retains the semantic key after an ambiguous empty recovery', async () => {
    getActive.mockReturnValue(of(null));
    startScheduled.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Network error' })),
    );
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledOnce());

    await store.startScheduledAppointment('appointment-9', 7);
    await store.startScheduledAppointment('appointment-9', 7);

    expect(startScheduled).toHaveBeenCalledTimes(2);
    expect(startScheduled.mock.calls[0]?.[2]).toBe(startScheduled.mock.calls[1]?.[2]);
  });

  it('recovers only a matching active scheduled source', async () => {
    const matching = { ...C123, consultationId: 'matching-consultation' };
    getActive.mockReturnValueOnce(of(null)).mockReturnValue(of(matching));
    startScheduled.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 0, statusText: 'Network error' })),
    );
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledOnce());

    await expect(store.startScheduledAppointment('appointment-9', 7)).resolves.toEqual({
      kind: 'RECOVERED',
      consultation: matching,
    });
  });

  it('does not treat another active Consultation as Start success', async () => {
    const other = { ...C123, consultationId: 'other-consultation', sourceId: 'appointment-other' };
    getActive.mockReturnValueOnce(of(null)).mockReturnValue(of(other));
    startScheduled.mockReturnValue(
      throwError(() => new HttpErrorResponse({
        status: 409,
        error: { errorCode: 'CONSULTATION_ALREADY_EXISTS' },
      })),
    );
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledOnce());

    await expect(store.startScheduledAppointment('appointment-9', 7)).resolves.toEqual({
      kind: 'ACTIVE_CONFLICT',
      consultation: other,
    });
    expect(store.startError()).toBe('Une consultation est déjà en cours.');
  });

  it('starts and recovers only the exact Urgent CABINET commitment', async () => {
    const urgent = {
      ...C123,
      consultationId: 'urgent-consultation',
      sourceType: 'URGENT_CABINET' as const,
      sourceId: 'commitment-7',
    };
    getActive.mockReturnValue(of(null));
    startCanonical.mockReturnValue(of(urgent));
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getActive).toHaveBeenCalledOnce());

    await expect(store.startUrgentCabinet('commitment-7', 9)).resolves.toEqual({
      kind: 'STARTED',
      consultation: urgent,
    });
    expect(startCanonical).toHaveBeenCalledWith(
      'URGENT_CABINET', 'commitment-7', 9, expect.any(String),
    );
  });
});
