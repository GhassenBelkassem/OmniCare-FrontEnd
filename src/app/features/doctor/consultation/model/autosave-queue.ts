import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';

import { normalizeHttpError, type AppHttpError } from '../../../../core/http/app-http-error';
import { isVersionConflict } from './consultation-errors';
import type { FieldErrors } from './consultation-form';

/**
 * - `idle`: nothing to send (saved, or nothing typed yet);
 * - `pending`: a change is waiting for the debounce;
 * - `saving`: one request in flight;
 * - `retrying`: network / 5xx / 503, a retry is scheduled (backoff or Retry-After);
 * - `offline`: the browser is offline; resumes on `online`;
 * - `blocked`: client validation fails, nothing was sent;
 * - `invalid`: the server rejected the value with field errors;
 * - `conflict`: 409 version conflict, the draft is kept;
 * - `finalized`: the consultation is closed (409 CONSULTATION_FINALIZED);
 * - `failed`: another error (shown by code).
 */
export type AutosaveState =
  | 'idle' | 'pending' | 'saving' | 'retrying' | 'offline' | 'blocked' | 'invalid' | 'conflict' | 'finalized' | 'failed';

export interface AutosaveTask<T> {
  /** Client Hard rules. A non-empty result means the value is not sent. */
  validate(value: T): FieldErrors;
  /** True when there is nothing worth sending (e.g. an empty note, a blank row). */
  isEmpty?(value: T): boolean;
  /** Sends the value. Must reuse `idempotencyKey` for the same value across retries. */
  send(value: T, idempotencyKey: string): Promise<void>;
  /** Server field errors → page field keys (French, from the client catalog). */
  mapFieldErrors(error: AppHttpError): FieldErrors;
}

export interface AutosaveOptions {
  readonly debounceMs?: number;
  readonly isOnline?: () => boolean;
  readonly now?: () => number;
  readonly keyPrefix?: string;
}

export const AUTOSAVE_DEBOUNCE_MS = 1500;
const MAX_BACKOFF_MS = 30_000;

/**
 * One save queue per resource: debounced, at most one request in flight, and every change made
 * while a request is in flight is merged into the next request (the latest snapshot wins).
 */
export class AutosaveQueue<T> {
  readonly state = signal<AutosaveState>('idle');
  readonly lastSavedAt = signal<number | null>(null);
  readonly fieldErrors = signal<FieldErrors>({});
  readonly error = signal<AppHttpError | null>(null);

  private latest: T | null = null;
  private latestFingerprint: string | null = null;
  private savedFingerprint: string | null = null;
  private operation: { readonly fingerprint: string; readonly key: string } | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private rerun = false;
  private attempt = 0;
  private destroyed = false;
  private readonly debounceMs: number;
  private readonly isOnline: () => boolean;
  private readonly now: () => number;
  private readonly keyPrefix: string;

  constructor(private readonly task: AutosaveTask<T>, options: AutosaveOptions = {}) {
    this.debounceMs = options.debounceMs ?? AUTOSAVE_DEBOUNCE_MS;
    this.isOnline = options.isOnline ?? (() => globalThis.navigator?.onLine ?? true);
    this.now = options.now ?? (() => Date.now());
    this.keyPrefix = options.keyPrefix ?? 'autosave';
  }

  /** The value as loaded from the server: nothing to send. */
  setBaseline(value: T): void {
    this.clearTimers();
    this.latest = value;
    this.latestFingerprint = fingerprint(value);
    this.savedFingerprint = this.latestFingerprint;
    this.operation = null;
    this.attempt = 0;
    this.fieldErrors.set({});
    this.error.set(null);
    this.state.set('idle');
  }

  /** A change: (re)starts the debounce. */
  schedule(value: T): void {
    if (this.destroyed) return;
    this.latest = value;
    this.latestFingerprint = fingerprint(value);
    if (this.state() === 'finalized') return;
    if (this.state() === 'conflict') return;
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (!this.hasUnsaved()) {
      this.debounceTimer = null;
      if (this.inFlight === null) {
        this.fieldErrors.set({});
        this.state.set('idle');
      }
      return;
    }
    if (this.inFlight === null && this.state() !== 'retrying' && this.state() !== 'offline') this.state.set('pending');
    this.debounceTimer = setTimeout(() => {
      this.debounceTimer = null;
      void this.run();
    }, this.debounceMs);
  }

  /** Sends now (no debounce, no backoff wait) and resolves once the queue is settled. */
  async flush(): Promise<void> {
    if (this.destroyed) return;
    this.clearTimers();
    await this.run();
    // A change merged during the flight was sent by the same run; nothing else to wait for.
  }

  /** Called when the browser comes back online. */
  resume(): void {
    if (this.state() === 'offline' || this.state() === 'retrying') void this.flush();
  }

  hasUnsaved(): boolean {
    return this.latestFingerprint !== null && this.latestFingerprint !== this.savedFingerprint;
  }

  /** Something is not on the server yet, or is being sent. */
  isBusy(): boolean {
    return this.inFlight !== null || this.debounceTimer !== null || this.retryTimer !== null;
  }

  /** Stops timers and waits for the request in flight (used before a discard). */
  async settle(): Promise<void> {
    this.clearTimers();
    if (this.inFlight !== null) await this.inFlight;
  }

  /** Re-validates the current value (e.g. after the rules' context changed). */
  revalidate(): void {
    if (this.latest === null || !this.hasUnsaved()) return;
    this.schedule(this.latest);
  }

  destroy(): void {
    this.destroyed = true;
    this.clearTimers();
  }

  private run(): Promise<void> {
    if (this.inFlight !== null) {
      this.rerun = true;
      return this.inFlight;
    }
    const flight = this.loop().finally(() => {
      if (this.inFlight === flight) this.inFlight = null;
    });
    this.inFlight = flight;
    return flight;
  }

  private async loop(): Promise<void> {
    do {
      this.rerun = false;
      if (this.destroyed || this.latest === null || !this.hasUnsaved()) {
        if (!this.destroyed && this.state() !== 'conflict' && this.state() !== 'finalized') this.state.set('idle');
        return;
      }
      const value = this.latest;
      const valueFingerprint = this.latestFingerprint!;
      const clientErrors = this.task.validate(value);
      if (Object.keys(clientErrors).length > 0) {
        this.fieldErrors.set(clientErrors);
        this.state.set('blocked');
        return;
      }
      if (this.task.isEmpty?.(value)) {
        this.fieldErrors.set({});
        this.state.set('idle');
        return;
      }
      if (!this.isOnline()) {
        this.state.set('offline');
        return;
      }
      if (this.operation === null || this.operation.fingerprint !== valueFingerprint) {
        this.operation = { fingerprint: valueFingerprint, key: `${this.keyPrefix}:${globalThis.crypto.randomUUID()}` };
      }
      this.state.set('saving');
      try {
        await this.task.send(value, this.operation.key);
        if (this.destroyed) return;
        this.savedFingerprint = valueFingerprint;
        this.operation = null;
        this.attempt = 0;
        this.lastSavedAt.set(this.now());
        this.fieldErrors.set({});
        this.error.set(null);
        this.state.set(this.hasUnsaved() && this.debounceTimer !== null ? 'pending' : 'idle');
      } catch (raw: unknown) {
        if (this.destroyed) return;
        this.onFailure(raw);
        return;
      }
    } while (this.rerun || (this.hasUnsaved() && this.debounceTimer === null && this.state() === 'idle'));
  }

  private onFailure(raw: unknown): void {
    const error = normalizeHttpError(raw);
    this.error.set(error);
    if (isRetryable(raw, error)) {
      // Same value, same Idempotency-Key: a lost response cannot create a duplicate.
      const delay = error.retryAfterSeconds !== null
        ? Math.min(error.retryAfterSeconds * 1000, MAX_BACKOFF_MS)
        : Math.min(2000 * 2 ** this.attempt, MAX_BACKOFF_MS);
      this.attempt += 1;
      if (!this.isOnline()) {
        this.state.set('offline');
        return;
      }
      this.state.set('retrying');
      this.retryTimer = setTimeout(() => {
        this.retryTimer = null;
        void this.run();
      }, delay);
      return;
    }
    this.operation = null;
    this.attempt = 0;
    if (error.code === 'CONSULTATION_FINALIZED' || error.code === 'CONSULTATION_ALREADY_COMPLETED') {
      this.state.set('finalized');
    } else if (isVersionConflict(error.code)) {
      this.state.set('conflict');
    } else if (error.status === 400 || error.status === 422) {
      const mapped = this.task.mapFieldErrors(error);
      this.fieldErrors.set(mapped);
      this.state.set('invalid');
    } else {
      this.state.set('failed');
    }
  }

  private clearTimers(): void {
    if (this.debounceTimer !== null) clearTimeout(this.debounceTimer);
    if (this.retryTimer !== null) clearTimeout(this.retryTimer);
    this.debounceTimer = null;
    this.retryTimer = null;
  }
}

export function isRetryable(raw: unknown, error: AppHttpError): boolean {
  if (!(raw instanceof HttpErrorResponse)) return false;
  return error.status === 0 || error.status === 408 || error.status === 429 || error.status >= 500;
}

function fingerprint(value: unknown): string {
  return JSON.stringify(value);
}
