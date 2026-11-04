import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { RealtimeService } from '../../core/realtime/realtime.service';
import type { ScheduledCareEvent } from '../../core/realtime/live-event.models';
import { ClinicalRecordStore } from './clinical-record.store';
import { PrescriptionApiService } from './prescription-api.service';
import { EMPTY_PRESCRIPTION, type PrescriptionContent, type PrescriptionResponse } from './prescription.models';

interface Pending { readonly key: string; readonly fingerprint: string; }

@Injectable({ providedIn: 'root' })
export class PrescriptionStore {
  private readonly api = inject(PrescriptionApiService);
  private readonly clinical = inject(ClinicalRecordStore);
  private readonly realtime = inject(RealtimeService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly destroyRef = inject(DestroyRef);
  private consultationId: string | null = null;
  private ownerId: string | null = this.currentDoctorId();
  private generation = 0;
  private pendingSave: Pending | null = null;
  private pendingFinalize: Pending | null = null;
  readonly authoritative = signal<PrescriptionResponse | null>(null);
  readonly draft = signal<PrescriptionContent>(EMPTY_PRESCRIPTION);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly finalizing = signal(false);
  readonly failure = signal<string | null>(null);
  readonly conflict = signal(false);
  readonly newerVersionAvailable = signal(false);
  readonly dirty = computed(() => fingerprint(this.draft()) !== fingerprint(this.authoritative()?.prescription ?? EMPTY_PRESCRIPTION));

  constructor() {
    this.realtime.scheduledCareEvents$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((event) => this.invalidate(event));
    effect(() => { const owner = this.currentDoctorId(); if (owner !== this.ownerId) { this.ownerId = owner; this.clear(); } });
  }
  attach(id: string): void { if (id === this.consultationId) return; this.clear(); this.consultationId = id; void this.refresh(); }
  setDraft(value: PrescriptionContent): void { if (this.pendingSave?.fingerprint !== fingerprint(value)) this.pendingSave = null; this.draft.set(value); this.failure.set(null); }
  async refresh(force = false): Promise<void> {
    const id = this.consultationId; if (id === null || this.loading()) return;
    if (!force && (this.dirty() || this.saving())) { this.newerVersionAvailable.set(true); return; }
    const generation = this.generation; this.loading.set(true); this.failure.set(null);
    try { const value = await firstValueFrom(this.api.read(id)); if (generation !== this.generation) return; this.authoritative.set(value); this.draft.set(value.prescription ?? EMPTY_PRESCRIPTION); this.conflict.set(false); this.newerVersionAvailable.set(false); this.pendingSave = null; }
    catch (error: unknown) { if (generation === this.generation) this.failure.set(code(error)); }
    finally { if (generation === this.generation) this.loading.set(false); }
  }
  async save(): Promise<void> {
    const id = this.consultationId; const current = this.authoritative(); if (id === null || current === null || this.saving() || !this.dirty() || current.finalized || current.status === 'ACTIVE') return;
    const fp = fingerprint(this.draft()); if (this.pendingSave === null || this.pendingSave.fingerprint !== fp) this.pendingSave = { key: operationKey('prescription-save'), fingerprint: fp };
    const pending = this.pendingSave; const generation = this.generation; this.saving.set(true); this.failure.set(null); this.conflict.set(false);
    try { const saved = await firstValueFrom(this.api.save(id, current.prescriptionVersion, this.draft(), pending.key)); if (generation !== this.generation) return; this.authoritative.set(saved); this.draft.set(saved.prescription ?? EMPTY_PRESCRIPTION); this.pendingSave = null; this.newerVersionAvailable.set(false); }
    catch (error: unknown) { if (generation !== this.generation) return; const failure = code(error); this.failure.set(failure); this.conflict.set(failure === 'PRESCRIPTION_VERSION_CONFLICT'); if (!ambiguous(error)) this.pendingSave = null; }
    finally { if (generation === this.generation) this.saving.set(false); }
  }
  async finalize(): Promise<void> {
    const id = this.consultationId; const current = this.authoritative(); const clinical = this.clinical.authoritative();
    if (id === null || current === null || clinical === null || current.finalized || current.status !== 'DRAFT' || this.draft().medications.length === 0 || this.dirty() || this.finalizing()) return;
    const fp = `${current.prescriptionVersion}:${clinical.clinicalRecordVersion}`; if (this.pendingFinalize === null || this.pendingFinalize.fingerprint !== fp) this.pendingFinalize = { key: operationKey('prescription-finalize'), fingerprint: fp };
    const operation = this.pendingFinalize; const generation = this.generation; this.finalizing.set(true); this.failure.set(null);
    try { const saved = await firstValueFrom(this.api.finalize(id, current.prescriptionVersion, clinical.clinicalRecordVersion, operation.key)); if (generation !== this.generation) return; this.authoritative.set(saved); this.draft.set(saved.prescription ?? EMPTY_PRESCRIPTION); this.pendingFinalize = null; }
    catch (error: unknown) { if (generation !== this.generation) return; const failure = code(error); this.failure.set(failure); this.conflict.set(failure === 'PRESCRIPTION_VERSION_CONFLICT' || failure === 'CLINICAL_RECORD_VERSION_CONFLICT'); if (!ambiguous(error)) this.pendingFinalize = null; }
    finally { if (generation === this.generation) this.finalizing.set(false); }
  }
  clear(): void { this.generation++; this.consultationId = null; this.authoritative.set(null); this.draft.set(EMPTY_PRESCRIPTION); this.loading.set(false); this.saving.set(false); this.finalizing.set(false); this.failure.set(null); this.conflict.set(false); this.newerVersionAvailable.set(false); this.pendingSave = null; this.pendingFinalize = null; }
  private currentDoctorId(): string | null { const user = this.tokens.user(); return user?.role === 'DOCTOR' ? user.id : null; }
  private invalidate(event: ScheduledCareEvent): void { if (event.resourceType !== 'PRESCRIPTION' || event.resourceId !== this.consultationId || (event.eventType !== 'PRESCRIPTION_UPDATED' && event.eventType !== 'PRESCRIPTION_FINALIZED')) return; if (this.dirty() || this.saving()) { this.newerVersionAvailable.set(true); return; } void this.refresh(); }
}
function fingerprint(value: PrescriptionContent): string { return JSON.stringify(value); }
function operationKey(prefix: string): string { return `${prefix}:${globalThis.crypto.randomUUID()}`; }
function code(error: unknown): string { if (error instanceof HttpErrorResponse && error.error !== null && typeof error.error === 'object') { const body = error.error as { code?: unknown; errorCode?: unknown }; const value = body.errorCode ?? body.code; if (typeof value === 'string' && value.length <= 80) return value; } return 'MRS_UNAVAILABLE'; }
function ambiguous(error: unknown): boolean { return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500); }
