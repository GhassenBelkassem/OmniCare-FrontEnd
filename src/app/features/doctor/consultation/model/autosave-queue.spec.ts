import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutosaveQueue, type AutosaveTask } from './autosave-queue';

interface Deferred {
  readonly resolve: () => void;
  readonly reject: (error: unknown) => void;
}

function setup(validate: (value: string) => Record<string, string> = () => ({})) {
  const calls: { value: string; key: string }[] = [];
  const pending: Deferred[] = [];
  const task: AutosaveTask<string> = {
    validate,
    send: (value, key) => {
      calls.push({ value, key });
      return new Promise<void>((resolve, reject) => pending.push({ resolve, reject }));
    },
    mapFieldErrors: () => ({ field: 'Valeur non valide.' }),
  };
  const queue = new AutosaveQueue(task, { isOnline: () => true });
  return { queue, calls, pending };
}

const settle = () => vi.advanceTimersByTimeAsync(0);

describe('AutosaveQueue', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('debounces 1.5 s after the last change', async () => {
    const { queue, calls } = setup();
    queue.schedule('a');
    await vi.advanceTimersByTimeAsync(1000);
    queue.schedule('ab');
    await vi.advanceTimersByTimeAsync(1400);
    expect(calls).toEqual([]);
    expect(queue.state()).toBe('pending');
    await vi.advanceTimersByTimeAsync(100);
    expect(calls.map((call) => call.value)).toEqual(['ab']);
    expect(queue.state()).toBe('saving');
  });

  it('keeps one request in flight and merges the changes made meanwhile into the next one', async () => {
    const { queue, calls, pending } = setup();
    queue.schedule('v1');
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls).toHaveLength(1);
    queue.schedule('v2');
    queue.schedule('v3');
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls).toHaveLength(1);
    pending[0].resolve();
    await settle();
    expect(calls.map((call) => call.value)).toEqual(['v1', 'v3']);
    pending[1].resolve();
    await settle();
    expect(queue.state()).toBe('idle');
    expect(queue.hasUnsaved()).toBe(false);
  });

  it('flush sends immediately and waits for the result', async () => {
    const { queue, calls, pending } = setup();
    queue.schedule('x');
    const flushed = queue.flush();
    await settle();
    expect(calls).toHaveLength(1);
    pending[0].resolve();
    await flushed;
    expect(queue.state()).toBe('idle');
    expect(queue.lastSavedAt()).not.toBeNull();
  });

  it('keeps the draft on a 409 version conflict and stops sending', async () => {
    const { queue, calls, pending } = setup();
    queue.schedule('mine');
    await vi.advanceTimersByTimeAsync(1500);
    pending[0].reject(new HttpErrorResponse({ status: 409, error: { errorCode: 'CLINICAL_RECORD_VERSION_CONFLICT' } }));
    await settle();
    expect(queue.state()).toBe('conflict');
    expect(queue.hasUnsaved()).toBe(true);
    queue.schedule('mine, more');
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);
    expect(queue.hasUnsaved()).toBe(true);
  });

  it('retries a 503 after Retry-After with the same Idempotency-Key', async () => {
    const { queue, calls, pending } = setup();
    queue.schedule('value');
    await vi.advanceTimersByTimeAsync(1500);
    pending[0].reject(new HttpErrorResponse({
      status: 503, error: { errorCode: 'MRS_UNAVAILABLE' }, headers: new HttpHeaders({ 'Retry-After': '3' }),
    }));
    await settle();
    expect(queue.state()).toBe('retrying');
    await vi.advanceTimersByTimeAsync(2900);
    expect(calls).toHaveLength(1);
    await vi.advanceTimersByTimeAsync(100);
    expect(calls).toHaveLength(2);
    expect(calls[1].key).toBe(calls[0].key);
    pending[1].resolve();
    await settle();
    expect(queue.state()).toBe('idle');
  });

  it('backs off on a network error', async () => {
    const { queue, calls, pending } = setup();
    queue.schedule('value');
    await vi.advanceTimersByTimeAsync(1500);
    pending[0].reject(new HttpErrorResponse({ status: 0 }));
    await settle();
    expect(queue.state()).toBe('retrying');
    await vi.advanceTimersByTimeAsync(2000);
    expect(calls).toHaveLength(2);
  });

  it('does not send a value that fails the client rules, and saves once it is fixed', async () => {
    const { queue, calls, pending } = setup((value): Record<string, string> => (value.length > 3 ? { field: 'Texte trop long.' } : {}));
    queue.schedule('toolong');
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls).toEqual([]);
    expect(queue.state()).toBe('blocked');
    queue.schedule('ok');
    await vi.advanceTimersByTimeAsync(1500);
    expect(calls.map((call) => call.value)).toEqual(['ok']);
    pending[0].resolve();
    await settle();
    expect(queue.state()).toBe('idle');
  });

  it('shows server field errors on 400 and waits for the next change', async () => {
    const { queue, pending } = setup();
    queue.schedule('value');
    await vi.advanceTimersByTimeAsync(1500);
    pending[0].reject(new HttpErrorResponse({ status: 400, error: { errorCode: 'VALIDATION_ERROR' } }));
    await settle();
    expect(queue.state()).toBe('invalid');
    expect(queue.fieldErrors()).toEqual({ field: 'Valeur non valide.' });
  });

  it('stops after the consultation is finalized', async () => {
    const { queue, calls, pending } = setup();
    queue.schedule('value');
    await vi.advanceTimersByTimeAsync(1500);
    pending[0].reject(new HttpErrorResponse({ status: 409, error: { errorCode: 'CONSULTATION_FINALIZED' } }));
    await settle();
    expect(queue.state()).toBe('finalized');
    queue.schedule('again');
    await vi.advanceTimersByTimeAsync(5000);
    expect(calls).toHaveLength(1);
  });
});
