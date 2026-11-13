import { HttpErrorResponse } from '@angular/common/http';
import { type MonoTypeOperatorFunction, defer, retry, throwError, timer } from 'rxjs';

import { normalizeHttpError } from '../../../../core/http/app-http-error';

/** How long a read may wait for MRS to receive the consultation's care context. */
export const CONTEXT_PENDING_BUDGET_MS = 10_000;
const MIN_WAIT_MS = 500;
const MAX_WAIT_MS = 2_000;

/** 503 MRS_CONTEXT_PENDING: the care context is on its way to MRS, not an outage. */
export function isContextPending(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 503
    && normalizeHttpError(error).code === 'MRS_CONTEXT_PENDING';
}

/**
 * G-1 D5: right after « Démarrer », MRS may not have the care context yet. Re-read, honouring the
 * server's Retry-After (0.5 to 2 s), for up to {@link CONTEXT_PENDING_BUDGET_MS}, before letting
 * the error through (« indisponible »). Any other error is passed on at once.
 */
export function retryWhileContextPending<T>(budgetMs = CONTEXT_PENDING_BUDGET_MS): MonoTypeOperatorFunction<T> {
  return (source) => defer(() => {
    let waited = 0;
    return source.pipe(retry({
      delay: (error: unknown) => {
        if (!isContextPending(error)) return throwError(() => error);
        const advised = (normalizeHttpError(error).retryAfterSeconds ?? 1) * 1000;
        const wait = Math.min(MAX_WAIT_MS, Math.max(MIN_WAIT_MS, advised));
        if (waited + wait > budgetMs) return throwError(() => error);
        waited += wait;
        return timer(wait);
      },
    }));
  });
}
