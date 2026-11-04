import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import type { AuthenticatedUser } from '../../core/auth/auth.models';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { RealtimeService } from '../../core/realtime/realtime.service';
import { ClinicalOrderApiService } from './clinical-order-api.service';
import type { ClinicalOrder } from './clinical-order.models';
import { ClinicalOrderStore } from './clinical-order.store';

const C123 = '11111111-1111-4111-8111-111111111111';
const O1: ClinicalOrder = { clinicalOrderId: '22222222-2222-4222-8222-222222222222', consultationId: C123,
  category: 'LAB', status: 'DRAFT', clinicalOrderVersion: 1, schemaVersion: 1,
  definition: { requestedExamination: 'CBC', requestedStudy: null, targetSpecialty: null } };

describe('ClinicalOrderStore', () => {
  const user = signal<AuthenticatedUser | null>({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false });
  let events: Subject<ScheduledCareEvent>; let list: ReturnType<typeof vi.fn>; let create: ReturnType<typeof vi.fn>;
  let update: ReturnType<typeof vi.fn>; let finalize: ReturnType<typeof vi.fn>; let store: ClinicalOrderStore;
  beforeEach(async () => {
    user.set({ id: 'doctor-1', role: 'DOCTOR', mustChangePassword: false }); events = new Subject();
    list = vi.fn().mockReturnValue(of({ orders: [O1] })); create = vi.fn(); update = vi.fn(); finalize = vi.fn();
    TestBed.configureTestingModule({ providers: [
      { provide: ClinicalOrderApiService, useValue: { list, create, update, finalize } },
      { provide: RealtimeService, useValue: { scheduledCareEvents$: events } },
      { provide: AuthTokenStore, useValue: { user } },
    ] });
    store = TestBed.inject(ClinicalOrderStore); store.attach(C123); TestBed.flushEffects();
    await vi.waitFor(() => expect(store.orders().length).toBe(1));
  });
  afterEach(() => TestBed.resetTestingModule());

  it.each([['LAB','CBC'],['IMAGING','Chest X-ray'],['REFERRAL','Cardiology']] as const)('creates %s through the canonical API', async (category, value) => {
    store.beginCreate(category); store.setValue(value);
    const saved: ClinicalOrder = { ...O1, clinicalOrderId: crypto.randomUUID(), category,
      definition: { requestedExamination: category === 'LAB' ? value : null, requestedStudy: category === 'IMAGING' ? value : null, targetSpecialty: category === 'REFERRAL' ? value : null } };
    create.mockReturnValue(of(saved)); await store.save();
    expect(create).toHaveBeenCalledWith(C123, category, saved.definition, expect.any(String));
    expect(store.orders().some((order) => order.clinicalOrderId === saved.clinicalOrderId)).toBe(true);
  });

  it('updates with the authoritative order version and finalizes immutably', async () => {
    store.beginEdit(O1); store.setValue('CBC and differential');
    const v2 = { ...O1, clinicalOrderVersion: 2, definition: store.editor()!.draft }; update.mockReturnValue(of(v2));
    await store.save(); expect(update.mock.calls[0][1].clinicalOrderVersion).toBe(1);
    const finalOrder = { ...v2, status: 'FINALIZED' as const, clinicalOrderVersion: 3 }; finalize.mockReturnValue(of(finalOrder));
    await store.finalize(v2); expect(store.orders()[0].status).toBe('FINALIZED'); expect(store.orders()[0].clinicalOrderVersion).toBe(3);
  });

  it('preserves dirty input on conflict and realtime invalidation', async () => {
    store.beginEdit(O1); store.setValue('keep this');
    update.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'CLINICAL_ORDER_VERSION_CONFLICT' } })));
    await store.save(); events.next({ eventId:'event-1', eventType:'CLINICAL_ORDER_UPDATED', resourceType:'CLINICAL_ORDER', resourceId:O1.clinicalOrderId, version:2, occurredAt:'2026-10-25T10:00:00Z' });
    expect(store.conflict()).toBe(true); expect(store.newerVersionAvailable()).toBe(true);
    expect(store.editor()?.draft.requestedExamination).toBe('keep this'); expect(list).toHaveBeenCalledTimes(1);
  });

  it('retries an ambiguous save with the same key', async () => {
    store.beginEdit(O1); store.setValue('CBC updated');
    update.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 }))).mockReturnValueOnce(of({ ...O1, clinicalOrderVersion: 2, definition: store.editor()!.draft }));
    await store.save(); const firstKey = update.mock.calls[0][3]; await store.save(); expect(update.mock.calls[1][3]).toBe(firstKey);
  });

  it('retries ambiguous finalization with the same key', async () => {
    finalize.mockReturnValueOnce(throwError(() => new HttpErrorResponse({ status: 0 })))
      .mockReturnValueOnce(of({ ...O1, status: 'FINALIZED', clinicalOrderVersion: 2 }));
    await store.finalize(O1); const firstKey = finalize.mock.calls[0][2];
    await store.finalize(O1); expect(finalize.mock.calls[1][2]).toBe(firstKey);
    expect(store.orders()[0].status).toBe('FINALIZED');
  });

  it('refetches when clean and clears PHI on logout', async () => {
    list.mockReturnValueOnce(of({ orders: [{ ...O1, clinicalOrderVersion: 2 }] }));
    events.next({ eventId:'event-2', eventType:'CLINICAL_ORDER_UPDATED', resourceType:'CLINICAL_ORDER', resourceId:O1.clinicalOrderId, version:2, occurredAt:'2026-10-25T10:00:00Z' });
    await vi.waitFor(() => expect(store.orders()[0].clinicalOrderVersion).toBe(2));
    user.set(null); TestBed.flushEffects(); expect(store.orders()).toEqual([]); expect(store.editor()).toBeNull();
  });
});
