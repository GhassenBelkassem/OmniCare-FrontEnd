import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { WaitingRoomDemoStore } from './waiting-room-demo.store';

function createStore(): WaitingRoomDemoStore {
  TestBed.configureTestingModule({ providers: [WaitingRoomDemoStore] });
  return TestBed.inject(WaitingRoomDemoStore);
}

describe('WaitingRoomDemoStore', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => TestBed.resetTestingModule());

  it('records check-in time and calculates waiting from actual arrival', () => {
    const store = createStore();
    expect(store.markArrived('demo-waiting-lucas').ok).toBe(true);
    store.advanceClock(7);
    const lucas = store.patients().find(({ id }) => id === 'demo-waiting-lucas');
    expect(lucas?.checkedInAt).toBe('11:20');
    expect(lucas && store.waitMinutes(lucas)).toBe(7);
  });

  it('calls the next eligible patient by appointment then arrival time', () => {
    const store = createStore();
    const result = store.callNext();
    expect(result.patientId).toBe('demo-waiting-marie');
    expect(store.patients().find(({ id }) => id === result.patientId)?.queueStatus).toBe('CALLED');
  });

  it('skips an expected patient who has not checked in', () => {
    const store = createStore();
    expect(store.waitingQueue().some(({ id }) => id === 'demo-waiting-lucas')).toBe(false);
    expect(store.suggestedPatient()?.id).toBe('demo-waiting-marie');
  });

  it('adds a late arrival to the eligible queue without changing the active consultation', () => {
    const store = createStore();
    expect(store.markArrived('demo-waiting-lucas').ok).toBe(true);
    expect(store.waitingQueue().some(({ id }) => id === 'demo-waiting-lucas')).toBe(true);
    expect(store.activeConsultation()?.id).toBe('demo-waiting-pierre');
  });

  it('allows a manual call out of recommendation order', () => {
    const store = createStore();
    expect(store.callPatient('demo-waiting-claire').ok).toBe(true);
    expect(store.patients().find(({ id }) => id === 'demo-waiting-claire')?.queueStatus).toBe('CALLED');
    expect(store.patients().find(({ id }) => id === 'demo-waiting-marie')?.queueStatus).toBe('WAITING');
  });

  it('prevents overlapping patient calls', () => {
    const store = createStore();
    expect(store.callPatient('demo-waiting-marie').ok).toBe(true);
    expect(store.callPatient('demo-waiting-claire').ok).toBe(false);
    expect(store.patients().find(({ id }) => id === 'demo-waiting-claire')?.queueStatus).toBe('WAITING');
  });

  it('marks a missed call and permits requeue', () => {
    const store = createStore();
    store.callPatient('demo-waiting-marie');
    expect(store.markMissedCall('demo-waiting-marie').ok).toBe(true);
    expect(store.requeue('demo-waiting-marie').ok).toBe(true);
    expect(store.patients().find(({ id }) => id === 'demo-waiting-marie')?.queueStatus).toBe('WAITING');
  });

  it('prevents a second active consultation', () => {
    const store = createStore();
    store.callPatient('demo-waiting-marie');
    const result = store.startConsultation('demo-waiting-marie');
    expect(result.ok).toBe(false);
    expect(result.message).toContain('Pierre Moreau');
  });

  it('completes the active simulated consultation', () => {
    const store = createStore();
    expect(store.completeConsultation('demo-waiting-pierre').ok).toBe(true);
    const pierre = store.patients().find(({ id }) => id === 'demo-waiting-pierre');
    expect(pierre?.queueStatus).toBe('COMPLETED');
    expect(pierre?.appointmentStatus).toBe('COMPLETED');
  });

  it('marks no-show only through an explicit valid action', () => {
    const store = createStore();
    expect(store.confirmNoShow('demo-waiting-lucas').ok).toBe(true);
    expect(store.patients().find(({ id }) => id === 'demo-waiting-lucas')?.appointmentStatus).toBe('NO_SHOW');
    expect(store.confirmNoShow('demo-waiting-lucas').ok).toBe(false);
  });

  it('adds walk-ins after scheduled waiting patients', () => {
    const store = createStore();
    const result = store.addExistingWalkIn('practice-amira');
    expect(result.ok).toBe(true);
    expect(store.waitingQueue().at(-1)?.id).toBe('walk-in-practice-amira');
    expect(store.patients().find(({ id }) => id === result.patientId)?.appointmentTime).toBeNull();
  });

  it('restores persisted demo state after service recreation and can reset it', () => {
    const first = createStore();
    first.markArrived('demo-waiting-lucas');
    TestBed.resetTestingModule();
    const restored = createStore();
    expect(restored.patients().find(({ id }) => id === 'demo-waiting-lucas')?.queueStatus).toBe('WAITING');
    restored.reset();
    expect(restored.patients().find(({ id }) => id === 'demo-waiting-lucas')?.queueStatus).toBe('EXPECTED');
  });

  it('rejects invalid and repeated transitions without mutating state', () => {
    const store = createStore();
    expect(store.startConsultation('demo-waiting-lucas').ok).toBe(false);
    expect(store.markArrived('demo-waiting-lucas').ok).toBe(true);
    expect(store.markArrived('demo-waiting-lucas').ok).toBe(false);
    expect(store.patients().find(({ id }) => id === 'demo-waiting-lucas')?.queueStatus).toBe('WAITING');
  });
});
