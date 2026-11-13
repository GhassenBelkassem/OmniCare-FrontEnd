import { HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { firstValueFrom, defer, of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { retryWhileContextPending } from './context-pending-retry';

const pending = () => new HttpErrorResponse({
  status: 503, headers: new HttpHeaders({ 'Retry-After': '2' }), error: { errorCode: 'MRS_CONTEXT_PENDING' },
});

describe('retryWhileContextPending (G-1 D5)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('re-reads while MRS is catching up, honouring Retry-After, then succeeds', async () => {
    let calls = 0;
    const source = defer(() => (++calls < 3 ? throwError(pending) : of('ready')));
    const result = firstValueFrom(source.pipe(retryWhileContextPending()));
    await vi.advanceTimersByTimeAsync(4_000);
    await expect(result).resolves.toBe('ready');
    expect(calls).toBe(3);
  });

  it('gives up after about 10 s and lets the error through (« indisponible »)', async () => {
    let calls = 0;
    const source = defer(() => { calls += 1; return throwError(pending); });
    const result = firstValueFrom(source.pipe(retryWhileContextPending()));
    const settled = result.catch((error: unknown) => error);
    await vi.advanceTimersByTimeAsync(12_000);
    expect(await settled).toBeInstanceOf(HttpErrorResponse);
    expect(calls).toBe(6); // first read + 5 re-reads of 2 s
  });

  it('never retries another error', async () => {
    let calls = 0;
    const failure = new HttpErrorResponse({ status: 503, error: { errorCode: 'MRS_UNAVAILABLE' } });
    const source = defer(() => { calls += 1; return throwError(() => failure); });
    await expect(firstValueFrom(source.pipe(retryWhileContextPending()))).rejects.toBe(failure);
    expect(calls).toBe(1);
  });
});
