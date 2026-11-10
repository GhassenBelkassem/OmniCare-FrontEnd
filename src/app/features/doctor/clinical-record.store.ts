import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { normalizeHttpError } from '../../core/http/app-http-error';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { ClinicalRecordApiService } from './clinical-record-api.service';
import {
  EMPTY_CLINICAL_RECORD,
  type ClinicalRecordPayload,
  type ClinicalRecordResponse,
} from './clinical-record.models';
import { validateClinicalRecord } from './clinical-record.validation';

interface PendingSave {
  readonly key: string;
  readonly fingerprint: string;
}

@Injectable({ providedIn: 'root' })
export class ClinicalRecordStore {
  private readonly api = inject(ClinicalRecordApiService);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authoritativeState = signal<ClinicalRecordResponse | null>(null);
  private readonly draftState = signal<ClinicalRecordPayload>(EMPTY_CLINICAL_RECORD);
  private consultationId: string | null = null;
  private ownerId: string | null = null;
  private generation = 0;
  private pendingSave: PendingSave | null = null;

  readonly authoritative = this.authoritativeState.asReadonly();
  readonly draft = this.draftState.asReadonly();
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly failure = signal<string | null>(null);
  readonly fieldErrors = signal<Readonly<Record<string, string>>>({});
  readonly conflict = signal(false);
  readonly newerVersionAvailable = signal(false);
  readonly dirty = computed(() => {
    const authoritative = this.authoritativeState();
    return authoritative !== null && fingerprint(authoritative.clinicalRecord) !== fingerprint(this.draftState());
  });

  constructor() {
    this.realtime.scheduledCareEvents$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((event) => this.onInvalidation(event));
    effect(() => {
      const user = this.tokens.user();
      const doctorId = user?.role === 'DOCTOR' ? user.id : null;
      if (doctorId === this.ownerId) return;
      this.ownerId = doctorId;
      this.clear();
    });
  }

  attach(consultationId: string): void {
    if (this.consultationId === consultationId) return;
    this.clear();
    this.consultationId = consultationId;
    void this.refresh();
  }

  setDraft(value: ClinicalRecordPayload): void {
    const nextFingerprint = fingerprint(value);
    if (this.pendingSave !== null && this.pendingSave.fingerprint !== nextFingerprint) {
      this.pendingSave = null;
    }
    this.draftState.set(value);
    this.failure.set(null);
    this.fieldErrors.set({});
  }

  async refresh(): Promise<void> {
    const consultationId = this.consultationId;
    if (consultationId === null || this.loading()) return;
    const generation = this.generation;
    this.loading.set(true);
    this.failure.set(null);
    this.fieldErrors.set({});
    try {
      const record = await firstValueFrom(this.api.read(consultationId));
      if (generation !== this.generation || consultationId !== this.consultationId) return;
      this.authoritativeState.set(record);
      this.draftState.set(record.clinicalRecord);
      this.conflict.set(false);
      this.newerVersionAvailable.set(false);
      this.pendingSave = null;
    } catch (error: unknown) {
      if (generation === this.generation) this.failure.set(errorCode(error));
    } finally {
      if (generation === this.generation) this.loading.set(false);
    }
  }

  async save(): Promise<void> {
    const consultationId = this.consultationId;
    const authoritative = this.authoritativeState();
    if (consultationId === null || authoritative === null || this.saving() || !this.dirty()) return;
    const draft = this.draftState();
    const validationErrors = validateClinicalRecord(draft);
    if (Object.keys(validationErrors).length > 0) {
      this.failure.set('VALIDATION_ERROR');
      this.fieldErrors.set(validationErrors);
      this.conflict.set(false);
      return;
    }
    const draftFingerprint = fingerprint(draft);
    if (this.pendingSave === null || this.pendingSave.fingerprint !== draftFingerprint) {
      this.pendingSave = { key: operationKey(), fingerprint: draftFingerprint };
    }
    const operation = this.pendingSave;
    const generation = this.generation;
    this.saving.set(true);
    this.failure.set(null);
    this.fieldErrors.set({});
    this.conflict.set(false);
    try {
      const saved = await firstValueFrom(this.api.save(
        consultationId,
        authoritative.clinicalRecordVersion,
        draft,
        operation.key,
      ));
      if (generation !== this.generation || consultationId !== this.consultationId) return;
      this.authoritativeState.set(saved);
      this.draftState.set(saved.clinicalRecord);
      this.pendingSave = null;
      this.newerVersionAvailable.set(false);
    } catch (error: unknown) {
      if (generation !== this.generation) return;
      const code = errorCode(error);
      this.failure.set(code);
      this.fieldErrors.set(validationFieldErrors(error));
      if (code === 'CLINICAL_RECORD_VERSION_CONFLICT') this.conflict.set(true);
      if (!isAmbiguous(error)) this.pendingSave = null;
    } finally {
      if (generation === this.generation) this.saving.set(false);
    }
  }

  clear(): void {
    this.generation += 1;
    this.consultationId = null;
    this.authoritativeState.set(null);
    this.draftState.set(EMPTY_CLINICAL_RECORD);
    this.loading.set(false);
    this.saving.set(false);
    this.failure.set(null);
    this.fieldErrors.set({});
    this.conflict.set(false);
    this.newerVersionAvailable.set(false);
    this.pendingSave = null;
  }

  private onInvalidation(event: ScheduledCareEvent): void {
    if (event.eventType !== 'CONSULTATION_UPDATED' || event.resourceType !== 'CONSULTATION'
      || event.resourceId !== this.consultationId) return;
    const authoritative = this.authoritativeState();
    if (authoritative !== null && event.version <= authoritative.clinicalRecordVersion) return;
    if (this.dirty() || this.saving()) {
      this.newerVersionAvailable.set(true);
      return;
    }
    void this.refresh();
  }
}

function fingerprint(value: ClinicalRecordPayload): string {
  return JSON.stringify(value);
}

function operationKey(): string {
  return `clinical-save:${globalThis.crypto.randomUUID()}`;
}

function errorCode(error: unknown): string {
  return normalizeHttpError(error).code ?? 'MRS_UNAVAILABLE';
}

function validationFieldErrors(error: unknown): Readonly<Record<string, string>> {
  return normalizeHttpError(error).fieldErrors;
}

function isAmbiguous(error: unknown): boolean {
  return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500);
}
