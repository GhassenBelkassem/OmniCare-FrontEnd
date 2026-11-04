import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { UrgentCabinetClinicalApiService } from './urgent-cabinet-clinical-api.service';
import type { UrgentCabinetClinicalCommitment } from './urgent-cabinet-clinical.models';
import { UrgentCabinetClinicalStore } from './urgent-cabinet-clinical.store';

const READY: UrgentCabinetClinicalCommitment = {
  commitmentId: 'commitment-1',
  requestId: 'request-1',
  practiceLocationId: 'cabinet-1',
  status: 'ACTIVE',
  revision: 4,
  arrivalVerifiedAt: '2026-10-28T09:05:00Z',
  capacityBinding: 'DEFERRED_CLINICAL_BUSY',
  clinicalStartReady: true,
  consultationId: null,
  consultationStatus: null,
  clinicalStartedAt: null,
  completedAt: null,
  allowedActions: ['START_CONSULTATION'],
  evaluatedAt: '2026-10-28T09:06:00Z',
};

describe('UrgentCabinetClinicalStore', () => {
  const user = signal<AuthenticatedUser | null>(null);
  let list: ReturnType<typeof vi.fn>;
  let protectedIntake: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    user.set(null);
    list = vi.fn().mockReturnValue(of([READY]));
    protectedIntake = vi.fn().mockReturnValue(of({
      requestId: 'request-1',
      bodyAreaCodes: ['CHEST'],
      painScore: 7,
      shortDescription: 'Douleur brève',
    }));
    TestBed.configureTestingModule({
      providers: [
        { provide: AuthTokenStore, useValue: { user } },
        { provide: UrgentCabinetClinicalApiService, useValue: { list, protectedIntake } },
        {
          provide: RealtimeService,
          useValue: { scheduledCareEvents$: new Subject<ScheduledCareEvent>() },
        },
      ],
    });
  });

  afterEach(() => TestBed.resetTestingModule());

  it('exposes only backend-authoritative arrived Start readiness', async () => {
    const store = TestBed.inject(UrgentCabinetClinicalStore);
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();

    await vi.waitFor(() => expect(store.actionable()?.commitmentId).toBe('commitment-1'));
    expect(store.waiting()).toBeNull();
    expect(store.protectedIntake()?.commitmentId).toBe('commitment-1');
  });

  it('keeps a deferred busy responsibility visible without a Start action', async () => {
    list.mockReturnValue(of([{ ...READY, clinicalStartReady: false, allowedActions: [] }]));
    const store = TestBed.inject(UrgentCabinetClinicalStore);
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();

    await vi.waitFor(() => expect(store.waiting()?.commitmentId).toBe('commitment-1'));
    expect(store.actionable()).toBeNull();
  });
});
