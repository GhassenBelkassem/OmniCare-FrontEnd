import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

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
  let store: ActiveConsultationStore;

  beforeEach(() => {
    user.set(null);
    connectionEpoch.set(0);
    events = new Subject<ScheduledCareEvent>();
    getActive = vi.fn().mockReturnValue(of(C123));
    TestBed.configureTestingModule({
      providers: [
        { provide: ActiveConsultationApiService, useValue: { getActive } },
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
});
