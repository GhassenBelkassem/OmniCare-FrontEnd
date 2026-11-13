import { DestroyRef, Injectable, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { HttpErrorResponse } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { MedicalRecordApiService } from './medical-record-api.service';
import type {
  DoctorMedicalRecordWorkspace,
  MedicalRecordFailureCode,
} from './medical-record.models';
import { retryWhileContextPending } from './consultation/model/context-pending-retry';

@Injectable({ providedIn: 'root' })
export class MedicalRecordStore {
  private readonly api = inject(MedicalRecordApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly valueState = signal<DoctorMedicalRecordWorkspace | null>(null);
  private ownerId: string | null = null;
  private consultationId: string | null = null;
  private generation = 0;
  private inFlight: Promise<void> | null = null;
  private refreshPending = false;

  readonly workspace = this.valueState.asReadonly();
  readonly loading = signal(false);
  readonly failure = signal<MedicalRecordFailureCode | null>(null);

  constructor() {
    this.realtime.scheduledCareEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onInvalidation(event));

    let epoch = this.realtime.connectionEpoch();
    effect(() => {
      const next = this.realtime.connectionEpoch();
      if (next === epoch) return;
      epoch = next;
      if (this.consultationId !== null) void this.refresh();
    });

    effect(() => {
      const user = this.tokens.user();
      const doctorId = user?.role === 'DOCTOR' ? user.id : null;
      if (doctorId === this.ownerId) return;
      this.ownerId = doctorId;
      this.clear();
    });
  }

  attach(consultationId: string): void {
    if (this.ownerId === null) return;
    if (this.consultationId === consultationId) {
      if (this.workspace() === null && !this.loading() && this.failure() === null) {
        void this.refresh();
      }
      return;
    }
    this.clear();
    this.consultationId = consultationId;
    void this.refresh();
  }

  refresh(): Promise<void> {
    const consultationId = this.consultationId;
    if (consultationId === null || this.ownerId === null) return Promise.resolve();
    if (this.inFlight !== null) {
      this.refreshPending = true;
      return this.inFlight;
    }
    const generation = this.generation;
    this.loading.set(true);
    this.failure.set(null);
    // G-1 D5: same wait as the consultation reads while MRS receives the care context.
    const request = firstValueFrom(this.api.getWorkspace(consultationId).pipe(retryWhileContextPending()))
      .then((workspace) => {
        if (generation !== this.generation || this.consultationId !== consultationId) return;
        this.valueState.set(workspace);
      })
      .catch((error: unknown) => {
        if (generation !== this.generation || this.consultationId !== consultationId) return;
        this.valueState.set(null);
        this.failure.set(problemCode(error));
      })
      .finally(() => {
        if (this.inFlight !== request) return;
        this.inFlight = null;
        this.loading.set(false);
        if (this.refreshPending && this.consultationId !== null) {
          this.refreshPending = false;
          void this.refresh();
        }
      });
    this.inFlight = request;
    return request;
  }

  clear(): void {
    this.generation += 1;
    this.consultationId = null;
    this.valueState.set(null);
    this.failure.set(null);
    this.loading.set(false);
    this.refreshPending = false;
  }

  private onInvalidation(event: ScheduledCareEvent): void {
    if (
      event.eventType !== 'CLINICAL_ACCESS_CHANGED' ||
      event.resourceType !== 'CONSULTATION' ||
      this.consultationId === null ||
      event.resourceId !== this.consultationId
    ) {
      return;
    }
    // Clear PHI before the authoritative re-read so revocation is immediate.
    const consultationId = this.consultationId;
    this.clear();
    this.consultationId = consultationId;
    void this.refresh();
  }
}

function problemCode(error: unknown): MedicalRecordFailureCode {
  if (!(error instanceof HttpErrorResponse) || typeof error.error !== 'object' || error.error === null) {
    return 'UNKNOWN';
  }
  const code = (error.error as Record<string, unknown>)['errorCode'];
  return isFailureCode(code) ? code : 'UNKNOWN';
}

function isFailureCode(value: unknown): value is MedicalRecordFailureCode {
  return typeof value === 'string' && [
    'CLINICAL_ACCESS_REQUIRED',
    'CLINICAL_ACCESS_EXPIRED',
    'CLINICAL_ACCESS_REVOKED',
    'MRS_UNAVAILABLE',
    'MRS_CONTEXT_PENDING',
    'MRS_CONTEXT_FAILED',
    'PROFESSIONAL_NOT_ELIGIBLE',
    'CLINICAL_SUBJECT_UNAVAILABLE',
  ].includes(value);
}
