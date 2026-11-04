import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ClinicalRecordStore } from './clinical-record.store';
import { PrescriptionApiService } from './prescription-api.service';
import type { PrescriptionResponse } from './prescription.models';
import { PrescriptionStore } from './prescription.store';

const C123 = '11111111-1111-4111-8111-111111111111';
const ITEM = '22222222-2222-4222-8222-222222222222';
const V1: PrescriptionResponse = {
  prescriptionId: '33333333-3333-4333-8333-333333333333', prescriptionVersion: 1,
  clinicalRecordVersion: 5, schemaVersion: 2, status: 'DRAFT', finalized: false,
  signedAt: null, signatureAlgorithm: null, medicationDecision: 'MEDICATION_PRESCRIBED',
  prescription: { medications: [{ itemId: ITEM, replacesItemId: null, medicationCode: null,
    name: 'Medicine', strength: null, dose: { amount: 1, unit: 'tablet' }, route: 'ORAL',
    frequency: { timesPerDay: 2, text: null }, duration: null, quantity: null, instructions: null }],
    generalInstructions: null },
};

describe('PrescriptionStore', () => {
  const user = signal<AuthenticatedUser | null>({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
  let events: Subject<ScheduledCareEvent>;
  let read: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;
  let finalize: ReturnType<typeof vi.fn>;
  let store: PrescriptionStore;

  beforeEach(async () => {
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    events = new Subject(); read = vi.fn().mockReturnValue(of(V1)); save = vi.fn(); finalize = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: PrescriptionApiService, useValue: { read, save, finalize } },
      { provide: ClinicalRecordStore, useValue: { authoritative: signal({ clinicalRecordVersion: 5 }), dirty: signal(false) } },
      { provide: RealtimeService, useValue: { scheduledCareEvents$: events } },
      { provide: AuthTokenStore, useValue: { user } },
    ] });
    store = TestBed.inject(PrescriptionStore); store.attach(C123); TestBed.flushEffects();
    await vi.waitFor(() => expect(store.authoritative()?.prescriptionVersion).toBe(1));
  });

  afterEach(() => TestBed.resetTestingModule());

  it('saves with prescription CAS and advances only after success', async () => {
    store.setDraft({ ...store.draft(), generalInstructions: 'Review' });
    save.mockReturnValue(of({ ...V1, prescriptionVersion: 2, prescription: store.draft() }));
    await store.save();
    expect(save).toHaveBeenCalledWith(C123, 1, expect.objectContaining({ generalInstructions: 'Review' }), expect.any(String));
    expect(store.authoritative()?.prescriptionVersion).toBe(2); expect(store.dirty()).toBe(false);
  });

  it('preserves the volatile draft and idempotency key after ambiguous failure', async () => {
    store.setDraft({ ...store.draft(), generalInstructions: 'Keep me' });
    save.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of({ ...V1, prescriptionVersion: 2, prescription: store.draft() }));
    await store.save(); const key = save.mock.calls[0][3];
    expect(store.draft().generalInstructions).toBe('Keep me');
    await store.save(); expect(save.mock.calls[1][3]).toBe(key);
  });

  it('protects a dirty draft from conflict and realtime overwrite', async () => {
    store.setDraft({ ...store.draft(), generalInstructions: 'Local draft' });
    save.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409,
      error: { code: 'PRESCRIPTION_VERSION_CONFLICT' } })));
    await store.save();
    events.next({ eventId: 'event-1', eventType: 'PRESCRIPTION_UPDATED', resourceType: 'PRESCRIPTION',
      resourceId: C123, version: 2, occurredAt: '2026-10-26T10:00:00Z' });
    expect(store.conflict()).toBe(true); expect(store.newerVersionAvailable()).toBe(true);
    expect(store.draft().generalInstructions).toBe('Local draft'); expect(read).toHaveBeenCalledTimes(1);
  });

  it('clean realtime refetches and finalization uses the clinical record version', async () => {
    read.mockReturnValueOnce(of({ ...V1, prescriptionVersion: 2 }));
    events.next({ eventId: 'event-2', eventType: 'PRESCRIPTION_UPDATED', resourceType: 'PRESCRIPTION',
      resourceId: C123, version: 2, occurredAt: '2026-10-26T10:00:00Z' });
    await vi.waitFor(() => expect(store.authoritative()?.prescriptionVersion).toBe(2));
    finalize.mockReturnValue(of({ ...V1, prescriptionVersion: 2, status: 'ACTIVE', finalized: true }));
    await store.finalize();
    expect(finalize).toHaveBeenCalledWith(C123, 2, 5, expect.any(String));
    expect(store.authoritative()?.finalized).toBe(true);
  });

  it('clears prescription PHI on logout/account change', () => {
    user.set(null); TestBed.flushEffects();
    expect(store.authoritative()).toBeNull(); expect(store.draft().medications).toEqual([]);
  });
});
