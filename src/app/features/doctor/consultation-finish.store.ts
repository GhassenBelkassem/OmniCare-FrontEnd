import { HttpErrorResponse } from '@angular/common/http';
import { Injectable, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ActiveConsultationApiService, type FinishReadiness } from './active-consultation-api.service';
import type { ActiveConsultation } from './active-consultation.models';
import { ClinicalRecordStore } from './clinical-record.store';
import { ActiveConsultationStore } from './active-consultation.store';

@Injectable()
export class ConsultationFinishStore {
  private readonly api = inject(ActiveConsultationApiService);
  private readonly clinical = inject(ClinicalRecordStore);
  private readonly activeConsultation = inject(ActiveConsultationStore);
  private consultationId: string | null = null;
  private operationKey: string | null = null;
  private expectedConsultationVersion: number | null = null;
  private expectedClinicalRecordVersion: number | null = null;
  readonly consultation = signal<ActiveConsultation | null>(null);
  readonly submitting = signal(false);
  readonly reviewing = signal(false);
  readonly readiness = signal<FinishReadiness | null>(null);
  readonly failure = signal<string | null>(null);

  async attach(consultationId: string): Promise<void> {
    this.consultationId = consultationId;
    await this.refresh();
  }

  async refresh(): Promise<void> {
    if (this.consultationId === null) return;
    try { this.consultation.set(await firstValueFrom(this.api.get(this.consultationId))); }
    catch { this.failure.set('CONSULTATION_NOT_FOUND'); }
  }

  async finish(): Promise<void> {
    const consultation = this.consultation();
    const clinical = this.clinical.authoritative();
    if (consultation === null || clinical === null || this.submitting()) return;
    if (this.clinical.dirty()) { this.failure.set('UNSAVED_CLINICAL_CHANGES'); return; }
    if (this.operationKey === null) {
      this.operationKey = `consultation-finish:${globalThis.crypto.randomUUID()}`;
      this.expectedConsultationVersion = consultation.version;
      this.expectedClinicalRecordVersion = clinical.clinicalRecordVersion;
    }
    this.submitting.set(true); this.failure.set(null);
    try {
      const result = await firstValueFrom(this.api.finish(consultation.consultationId,
        this.expectedConsultationVersion!, this.expectedClinicalRecordVersion!, this.operationKey));
      this.consultation.set(result);
      if (result.status === 'COMPLETED') {
        await this.activeConsultation.refresh();
        this.clearOperation();
      }
    } catch (error: unknown) {
      this.failure.set(errorCode(error));
      if (!ambiguous(error)) this.clearOperation();
      await this.refresh();
    } finally { this.submitting.set(false); }
  }

  async review(): Promise<void> {
    const consultation = this.consultation();
    const clinical = this.clinical.authoritative();
    if (consultation === null || clinical === null || this.reviewing()) return;
    if (this.clinical.dirty()) {
      this.failure.set('UNSAVED_CLINICAL_CHANGES');
      this.readiness.set(null);
      return;
    }
    this.reviewing.set(true);
    this.failure.set(null);
    try {
      this.readiness.set(await firstValueFrom(this.api.finishReadiness(
        consultation.consultationId, clinical.clinicalRecordVersion,
      )));
    } catch (error: unknown) {
      this.failure.set(errorCode(error));
      this.readiness.set(null);
    } finally {
      this.reviewing.set(false);
    }
  }

  private clearOperation(): void {
    this.operationKey = null;
    this.expectedConsultationVersion = null;
    this.expectedClinicalRecordVersion = null;
  }
}

function errorCode(error: unknown): string {
  if (error instanceof HttpErrorResponse && error.error !== null && typeof error.error === 'object') {
    const value = error.error as { errorCode?: unknown; code?: unknown };
    const code = typeof value.errorCode === 'string' ? value.errorCode : value.code;
    if (typeof code === 'string' && code.length <= 80) return code;
  }
  return 'FINISH_RECONCILIATION_REQUIRED';
}
function ambiguous(error: unknown): boolean { return error instanceof HttpErrorResponse && (error.status === 0 || error.status >= 500); }
