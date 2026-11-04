import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ClinicalRecordApiService } from './clinical-record-api.service';
import type { ClinicalRecordResponse } from './clinical-record.models';
import { ClinicalRecordStore } from './clinical-record.store';

const C123 = '11111111-1111-4111-8111-111111111111';
const V3: ClinicalRecordResponse = {
  clinicalRecordVersion: 3,
  schemaVersion: 2,
  clinicalRecord: {
    chiefComplaint: 'reason',
    history: { presentIllness: null, relevantMedicalHistory: null, relevantDentalHistory: null },
    clinicalFindings: [], diagnoses: [], assessment: null, treatmentPlan: [],
    followUp: { required: false, recommendedAt: null, decision: null }, notes: null,
    medicationDecision: null,
  },
};

describe('ClinicalRecordStore', () => {
  const user = signal<AuthenticatedUser | null>({
    id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false,
  });
  let events: Subject<ScheduledCareEvent>;
  let read: ReturnType<typeof vi.fn>;
  let save: ReturnType<typeof vi.fn>;
  let store: ClinicalRecordStore;

  beforeEach(async () => {
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
    events = new Subject<ScheduledCareEvent>();
    read = vi.fn().mockReturnValue(of(V3));
    save = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ClinicalRecordApiService, useValue: { read, save } },
      { provide: RealtimeService, useValue: { scheduledCareEvents$: events } },
      { provide: AuthTokenStore, useValue: { user } },
    ] });
    store = TestBed.inject(ClinicalRecordStore);
    TestBed.flushEffects();
    store.attach(C123);
    await vi.waitFor(() => expect(store.authoritative()?.clinicalRecordVersion).toBe(3));
  });

  afterEach(() => TestBed.resetTestingModule());

  it('uses the MRS version and advances only after a successful save', async () => {
    store.setDraft({ ...store.draft(), notes: 'local note' });
    const v4 = { ...V3, clinicalRecordVersion: 4, clinicalRecord: store.draft() };
    save.mockReturnValue(of(v4));

    await store.save();

    expect(save).toHaveBeenCalledWith(C123, 3, expect.objectContaining({ notes: 'local note' }), expect.any(String));
    expect(store.authoritative()?.clinicalRecordVersion).toBe(4);
    expect(store.dirty()).toBe(false);
  });

  it('preserves exact medication and follow-up decisions in the save request', async () => {
    store.setDraft({
      ...store.draft(),
      medicationDecision: 'MEDICATION_PRESCRIBED',
      followUp: { required: true, recommendedAt: null, decision: 'FOLLOW_UP_AS_NEEDED' },
    });
    save.mockReturnValue(of({ ...V3, clinicalRecordVersion: 4, clinicalRecord: store.draft() }));

    await store.save();

    expect(save.mock.calls[0][2]).toEqual(expect.objectContaining({
      medicationDecision: 'MEDICATION_PRESCRIBED',
      followUp: { required: true, recommendedAt: null, decision: 'FOLLOW_UP_AS_NEEDED' },
    }));
  });

  it('retains safe backend field errors for the clinical authoring UI', async () => {
    store.setDraft({ ...store.draft(), assessment: 'draft' });
    save.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 400,
      error: {
        code: 'VALIDATION_ERROR',
        fieldErrors: { clinicalRecord: 'One or more clinical record fields are invalid.' },
      },
    })));

    await store.save();

    expect(store.fieldErrors()).toEqual({
      clinicalRecord: 'One or more clinical record fields are invalid.',
    });
    expect(store.draft().assessment).toBe('draft');
  });

  it('retries an ambiguous transport failure with the same key and keeps the draft', async () => {
    store.setDraft({ ...store.draft(), assessment: 'unsaved assessment' });
    save.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of({ ...V3, clinicalRecordVersion: 4, clinicalRecord: store.draft() }));

    await store.save();
    const firstKey = save.mock.calls[0][3];
    expect(store.draft().assessment).toBe('unsaved assessment');
    expect(store.authoritative()?.clinicalRecordVersion).toBe(3);

    await store.save();
    expect(save.mock.calls[1][3]).toBe(firstKey);
    expect(store.authoritative()?.clinicalRecordVersion).toBe(4);
  });

  it('keeps dirty input on conflict and does not overwrite it on realtime invalidation', async () => {
    store.setDraft({ ...store.draft(), notes: 'keep me' });
    save.mockReturnValue(throwError(() => new HttpErrorResponse({
      status: 409, error: { code: 'CLINICAL_RECORD_VERSION_CONFLICT' },
    })));

    await store.save();
    events.next({
      eventId: 'event-1', eventType: 'CONSULTATION_UPDATED', resourceType: 'CONSULTATION',
      resourceId: C123, version: 4, occurredAt: '2026-10-25T10:00:00Z',
    });

    expect(store.conflict()).toBe(true);
    expect(store.newerVersionAvailable()).toBe(true);
    expect(store.draft().notes).toBe('keep me');
    expect(read).toHaveBeenCalledTimes(1);
  });

  it('compares realtime hints only with the clinical record version', () => {
    events.next({
      eventId: 'event-stale', eventType: 'CONSULTATION_UPDATED', resourceType: 'CONSULTATION',
      resourceId: C123, version: 3, occurredAt: '2026-10-25T10:00:00Z',
    });

    expect(read).toHaveBeenCalledTimes(1);
    expect(store.newerVersionAvailable()).toBe(false);
  });

  it('refetches a clean record on a newer clinical invalidation', async () => {
    read.mockReturnValueOnce(of({ ...V3, clinicalRecordVersion: 4 }));
    events.next({
      eventId: 'event-new', eventType: 'CONSULTATION_UPDATED', resourceType: 'CONSULTATION',
      resourceId: C123, version: 4, occurredAt: '2026-10-25T10:00:00Z',
    });

    await vi.waitFor(() => expect(store.authoritative()?.clinicalRecordVersion).toBe(4));
    expect(read).toHaveBeenCalledTimes(2);
  });

  it('clears clinical data on logout', () => {
    user.set(null);
    TestBed.flushEffects();
    expect(store.authoritative()).toBeNull();
    expect(store.draft().notes).toBeNull();
  });

  it('clears clinical data on account and route changes', async () => {
    store.setDraft({ ...store.draft(), notes: 'volatile' });
    user.set({ id: 'doctor-2', role: 'DOCTOR', mustChangePassword: false });
    TestBed.flushEffects();
    expect(store.authoritative()).toBeNull();
    expect(store.draft().notes).toBeNull();

    store.attach('22222222-2222-4222-8222-222222222222');
    await vi.waitFor(() => expect(store.authoritative()?.clinicalRecordVersion).toBe(3));
    expect(store.draft().notes).toBeNull();
  });
});
