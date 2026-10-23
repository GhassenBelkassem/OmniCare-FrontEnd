import { describe, expect, it } from 'vitest';

import { activeSlot } from './scheduled-care-prototype.models';
import {
  ScheduledCarePrototypeStore,
  slotsOverlapInCabinet,
} from './scheduled-care-prototype.store';

describe('ScheduledCarePrototypeStore', () => {
  it('does not expose fixture records until prototype mode is explicitly enabled', () => {
    const store = new ScheduledCarePrototypeStore();

    expect(store.enabled()).toBe(false);
    expect(store.records()).toEqual([]);
    expect(store.cabinets()).toEqual([]);
  });

  it('accepts a pending request as a confirmed appointment', () => {
    const store = new ScheduledCarePrototypeStore();
    store.enablePrototype();
    const request = store.pendingDoctor()[0];

    store.accept(request.id);

    expect(store.record(request.id)?.status).toBe('CONFIRMED');
    expect(store.record(request.id)?.kind).toBe('APPOINTMENT');
  });

  it('proposes only a structured free slot and waits for the patient', () => {
    const store = new ScheduledCarePrototypeStore();
    store.enablePrototype();
    const request = store.pendingDoctor()[0];
    const replacement = store.availableSlots(request.cabinet.id)[0];

    store.propose(request.id, replacement);

    const updated = store.record(request.id);
    expect(updated?.status).toBe('PENDING_PATIENT_TIME_CONFIRMATION');
    expect(updated?.proposedSlot?.id).toBe(replacement.id);
    expect(updated?.patientResponseDeadline).not.toBeNull();
  });

  it('requires a reason before a doctor cancellation', () => {
    const store = new ScheduledCarePrototypeStore();
    store.enablePrototype();
    const request = store.pendingDoctor()[0];

    store.decline(request.id, '   ');
    expect(store.record(request.id)?.status).toBe('PENDING_DOCTOR');

    store.decline(request.id, 'Indisponibilité exceptionnelle');
    expect(store.record(request.id)?.status).toBe('CANCELLED_BY_DOCTOR');
    expect(store.record(request.id)?.cancellationReason).toBe('Indisponibilité exceptionnelle');
  });

  it('rejects an unavailable or cross-Cabinet proposal', () => {
    const store = new ScheduledCarePrototypeStore();
    store.enablePrototype();
    const request = store.pendingDoctor()[0];
    const original = store.record(request.id);

    store.propose(request.id, {
      id: 'invalid-cross-cabinet',
      cabinetId: 'cabinet-ariana',
      start: request.requestedSlot.start,
      end: request.requestedSlot.end,
    });
    expect(store.record(request.id)).toBe(original);

    const heldProposal = activeSlot(store.record('scheduled-request-sami')!);
    const colliding = store
      .availableSlots('cabinet-ariana')
      .find(
        (candidate) => candidate.start === heldProposal.start && candidate.end === heldProposal.end,
      );
    expect(colliding).toBeUndefined();
  });

  it('detects held-slot collisions by Cabinet and interval', () => {
    const base = {
      id: 'base',
      cabinetId: 'cabinet-a',
      start: '2026-10-08T09:00:00.000Z',
      end: '2026-10-08T09:30:00.000Z',
    };

    expect(
      slotsOverlapInCabinet(base, {
        ...base,
        id: 'partial-overlap',
        start: '2026-10-08T09:15:00.000Z',
        end: '2026-10-08T09:45:00.000Z',
      }),
    ).toBe(true);
    expect(
      slotsOverlapInCabinet(base, {
        ...base,
        id: 'adjacent',
        start: '2026-10-08T09:30:00.000Z',
        end: '2026-10-08T10:00:00.000Z',
      }),
    ).toBe(false);
    expect(
      slotsOverlapInCabinet(base, {
        ...base,
        id: 'other-cabinet',
        cabinetId: 'cabinet-b',
        start: '2026-10-08T09:15:00.000Z',
        end: '2026-10-08T09:45:00.000Z',
      }),
    ).toBe(false);
  });

  it('does not transition terminal records through doctor actions', () => {
    const store = new ScheduledCarePrototypeStore();
    store.enablePrototype();
    const request = store.pendingDoctor()[0];
    store.decline(request.id, 'Indisponible');
    const cancelled = store.record(request.id);

    store.accept(request.id);
    store.cancelByDoctor(request.id, 'Encore');
    expect(store.record(request.id)).toBe(cancelled);
  });
});
