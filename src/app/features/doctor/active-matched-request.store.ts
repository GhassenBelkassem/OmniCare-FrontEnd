import { Injectable, computed, signal } from '@angular/core';

/**
 * Tracks urgent requests this doctor is currently MATCHED to (the patient
 * picked one of their accepted offers). Updated from live REQUEST_MATCHED /
 * REQUEST_CANCELLED / REQUEST_EXPIRED events and hydrated from REST at
 * startup. Drives the doctor GPS location push.
 */
@Injectable({ providedIn: 'root' })
export class ActiveMatchedRequestStore {
  private readonly _requestIds = signal<ReadonlySet<string>>(new Set<string>());

  readonly requestIds = this._requestIds.asReadonly();
  readonly hasActive = computed(() => this._requestIds().size > 0);

  markMatched(requestId: string): void {
    this._requestIds.update((current) => {
      if (current.has(requestId)) return current;
      const next = new Set(current);
      next.add(requestId);
      return next;
    });
  }

  markClosed(requestId: string): void {
    this._requestIds.update((current) => {
      if (!current.has(requestId)) return current;
      const next = new Set(current);
      next.delete(requestId);
      return next;
    });
  }

  /** Replaces the whole set from a REST hydration pass. */
  reset(requestIds: readonly string[]): void {
    this._requestIds.set(new Set(requestIds));
  }
}
