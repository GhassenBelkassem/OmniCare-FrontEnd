import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { MedicalRecordApiService } from './medical-record-api.service';
import type { DoctorMedicalRecordWorkspace } from './medical-record.models';
import { MedicalRecordStore } from './medical-record.store';

const WORKSPACE: DoctorMedicalRecordWorkspace = {
  consultation: {
    consultationId: 'c123',
    status: 'IN_PROGRESS',
    medicalAccessStatus: 'ACTIVE',
    version: 2,
  },
  access: {
    state: 'ACTIVE',
    expiresAt: '2026-10-23T09:00:00Z',
    sections: {
      ESSENTIAL_INFORMATION: 'AUTHORIZED',
      CURRENT_MEDICATIONS: 'AUTHORIZED',
      CONSULTATION_SUMMARIES: 'AUTHORIZED',
      DOCUMENTS: 'DEFERRED',
    },
  },
  essentialInformation: {
    bloodType: 'O+',
    allergies: ['canonical allergy'],
    criticalConditions: ['canonical condition'],
  },
  currentMedications: [{
    recordVersion: 1,
    status: 'ACTIVE',
    name: 'canonical medication',
    code: null,
    strength: null,
    doseAmount: null,
    doseUnit: null,
    dosageText: null,
    route: null,
    timesPerDay: null,
    frequencyText: null,
    startedAt: null,
    expectedEndAt: null,
  }],
  consultationSummaries: {
    items: [],
    nextCursor: null,
  },
  documents: { state: 'DEFERRED' },
};

describe('MedicalRecordStore', () => {
  const user = signal<AuthenticatedUser | null>(null);
  const connectionEpoch = signal(0);
  let events: Subject<ScheduledCareEvent>;
  let getWorkspace: ReturnType<typeof vi.fn>;
  let store: MedicalRecordStore;

  beforeEach(() => {
    user.set(null);
    connectionEpoch.set(0);
    events = new Subject<ScheduledCareEvent>();
    getWorkspace = vi.fn().mockReturnValue(of(WORKSPACE));
    TestBed.configureTestingModule({
      providers: [
        { provide: MedicalRecordApiService, useValue: { getWorkspace } },
        {
          provide: RealtimeService,
          useValue: { scheduledCareEvents$: events, connectionEpoch },
        },
        { provide: AuthTokenStore, useValue: { user } },
      ],
    });
    store = TestBed.inject(MedicalRecordStore);
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
  });

  afterEach(() => TestBed.resetTestingModule());

  it('loads the real mapped sections into volatile state', async () => {
    store.attach('c123');
    await vi.waitFor(() => expect(store.workspace()).toEqual(WORKSPACE));
    expect(store.workspace()?.essentialInformation?.allergies).toEqual(['canonical allergy']);
    expect(store.workspace()?.currentMedications[0]?.name).toBe('canonical medication');
  });

  it.each([
    'CLINICAL_ACCESS_REQUIRED',
    'CLINICAL_ACCESS_EXPIRED',
    'CLINICAL_ACCESS_REVOKED',
    'MRS_UNAVAILABLE',
  ] as const)('clears PHI and exposes %s without mock fallback', async (errorCode) => {
    getWorkspace
      .mockReturnValueOnce(of(WORKSPACE))
      .mockReturnValueOnce(throwError(() => new HttpErrorResponse({ error: { errorCode } })));
    store.attach('c123');
    await vi.waitFor(() => expect(store.workspace()).toEqual(WORKSPACE));

    await store.refresh();

    expect(store.workspace()).toBeNull();
    expect(store.failure()).toBe(errorCode);
  });

  it('clears before CLINICAL_ACCESS_CHANGED refetch and on account switch', async () => {
    const second = new Subject<DoctorMedicalRecordWorkspace>();
    getWorkspace.mockReturnValueOnce(of(WORKSPACE)).mockReturnValueOnce(second);
    store.attach('c123');
    await vi.waitFor(() => expect(store.workspace()).toEqual(WORKSPACE));

    events.next({
      eventId: 'access-2',
      eventType: 'CLINICAL_ACCESS_CHANGED',
      resourceType: 'CONSULTATION',
      resourceId: 'c123',
      version: 3,
      occurredAt: '2026-10-22T10:00:00Z',
    });
    expect(store.workspace()).toBeNull();

    second.next(WORKSPACE);
    second.complete();
    await vi.waitFor(() => expect(store.workspace()).toEqual(WORKSPACE));
    user.set({ id: 'doctor-2', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    expect(store.workspace()).toBeNull();
  });

  it('refetches on realtime reconnect and clears on logout', async () => {
    store.attach('c123');
    await vi.waitFor(() => expect(getWorkspace).toHaveBeenCalledOnce());
    connectionEpoch.update((value) => value + 1);
    TestBed.flushEffects();
    await vi.waitFor(() => expect(getWorkspace).toHaveBeenCalledTimes(2));

    user.set(null);
    TestBed.flushEffects();
    expect(store.workspace()).toBeNull();
  });
});
