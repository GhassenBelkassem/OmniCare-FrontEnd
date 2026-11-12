import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { normalizeHttpError, type AppHttpError } from '../../../core/http/app-http-error';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { ActiveConsultation } from '../active-consultation.models';
import { ActiveConsultationStore } from '../active-consultation.store';
import { ArtifactApiService } from '../artifact-api.service';
import { ClinicalOrderApiService } from '../clinical-order-api.service';
import { PrescriptionApiService } from '../prescription-api.service';
import { ConsultationSessionStore } from './consultation-session.store';
import {
  CONFLICT_MESSAGE,
  consultationErrorMessage,
  readinessItem,
  type ChecklistTarget,
  type ReadinessItem,
} from './model/consultation-errors';
import {
  MESSAGES,
  NOTE_PATHS,
  isBlankLine,
  validateNoteForFinish,
  type CertificateType,
  type FieldErrors,
} from './model/consultation-form';

export type FinishPhase =
  | 'idle' | 'saving' | 'signing-prescription' | 'validating-orders' | 'signing-documents' | 'closing' | 'pending' | 'done';

export interface ChecklistItem {
  readonly target: ChecklistTarget;
  readonly label: string;
  readonly done: boolean;
}

export const FINISH_POLL_TIMEOUT_MS = 120_000;
const POLLED_CODES = new Set(['FINISH_IN_PROGRESS', 'MRS_CONTEXT_PENDING', 'FINISH_RECONCILIATION_REQUIRED']);
const CERTIFICATES: readonly CertificateType[] = ['SICK_LEAVE_CERTIFICATE', 'MEDICAL_CERTIFICATE'];

const PHASE_LABELS: Readonly<Record<FinishPhase, string>> = {
  idle: 'Terminer la consultation',
  saving: 'Enregistrement…',
  'signing-prescription': 'Signature de l’ordonnance…',
  'validating-orders': 'Validation des examens…',
  'signing-documents': 'Signature des documents…',
  closing: 'Clôture…',
  pending: 'Clôture en cours…',
  done: 'Consultation terminée',
};

/**
 * « Terminer »: flush every save, check the four required items, then (after confirmation) sign
 * the prescription, validate each order, sign each document, read readiness and finish. Every
 * step is idempotent, so a failure midway leaves the consultation open and « Terminer » can run
 * again. 409 FINISH_IN_PROGRESS / 503 pending is never a success: the status is polled.
 */
@Injectable()
export class ConsultationFinishFlow {
  private readonly session = inject(ConsultationSessionStore);
  private readonly consultations = inject(ActiveConsultationApiService);
  private readonly activeConsultation = inject(ActiveConsultationStore);
  private readonly prescriptionApi = inject(PrescriptionApiService);
  private readonly orderApi = inject(ClinicalOrderApiService);
  private readonly artifactApi = inject(ArtifactApiService);
  private readonly keys = new Map<string, string>();
  private destroyed = false;
  private wakeUp: (() => void) | null = null;

  readonly phase = signal<FinishPhase>('idle');
  readonly attempted = signal(false);
  readonly confirmOpen = signal(false);
  readonly missing = signal<readonly ReadinessItem[]>([]);
  readonly error = signal<string | null>(null);
  readonly busy = computed(() => this.phase() !== 'idle' && this.phase() !== 'done');
  /** The server stopped the closure after its retries (support alerted): nothing left for the doctor to do. */
  readonly closureFailed = computed(() => {
    const consultation = this.session.consultation();
    return consultation?.status === 'FINALIZING' && consultation.finishState === 'FAILED';
  });
  /** Polling ran out without an outcome: « Reprendre la clôture » re-sends finish (idempotent). */
  readonly canResume = signal(false);
  readonly buttonLabel = computed(() => PHASE_LABELS[this.phase()]);

  /** Finish-only rules (the four required items). Shown after a « Terminer » attempt. */
  readonly finishErrors = computed<FieldErrors>(() => {
    const errors: Record<string, string> = { ...validateNoteForFinish(this.session.note()) };
    if (this.session.note().medicationDecision === 'MEDICATION_PRESCRIBED' && this.session.lines().every(isBlankLine)) {
      errors['prescription.medications'] = MESSAGES.medicationsRequired;
    }
    return errors;
  });

  readonly checklist = computed<readonly ChecklistItem[]>(() => {
    const note = this.session.note();
    const errors = { ...this.session.clientErrors(), ...this.finishErrors() };
    const has = (predicate: (key: string) => boolean): boolean => Object.keys(errors).some(predicate);
    return [
      { target: 'motif', label: 'Motif de consultation', done: !has((key) => key === NOTE_PATHS.chiefComplaint) },
      { target: 'diagnostic', label: 'Diagnostic', done: !has((key) => key === NOTE_PATHS.diagnosis) },
      {
        target: 'traitement',
        label: 'Décision de traitement',
        done: note.medicationDecision !== null && !has((key) => key === NOTE_PATHS.medicationDecision || key.startsWith('prescription')),
      },
      {
        target: 'suivi',
        label: 'Suivi',
        done: note.followUp !== null && !has((key) => key.startsWith('clinicalRecord.followUp')),
      },
    ];
  });

  constructor() {
    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.wakeUp?.();
    });
  }

  /**
   * Step 1–2: flush, then check. Opens the confirmation when everything is there. Returns false
   * when the page must show what is missing (the page scrolls to the first invalid field).
   */
  async requestFinish(): Promise<boolean> {
    if (this.busy()) return false;
    this.error.set(null);
    this.missing.set([]);
    this.phase.set('saving');
    try {
      await this.session.flushAll();
    } finally {
      this.phase.set('idle');
    }
    this.attempted.set(true);
    if (this.session.conflict()) {
      this.error.set(CONFLICT_MESSAGE);
      return false;
    }
    const states = this.session.queueStates();
    if (states.some((state) => state === 'retrying' || state === 'offline' || state === 'failed' || state === 'saving')) {
      this.error.set('Certaines modifications ne sont pas encore enregistrées. Réessayez dans un instant.');
      return false;
    }
    const missing = this.checklist().filter((item) => !item.done);
    const otherErrors = Object.keys({ ...this.session.clientErrors(), ...this.session.serverErrors() }).length > 0;
    if (missing.length > 0 || otherErrors) {
      this.missing.set(missing.length > 0 ? missing : [{ label: 'Champs à corriger', target: 'motif' }]);
      return false;
    }
    this.confirmOpen.set(true);
    return true;
  }

  cancelConfirm(): void {
    this.confirmOpen.set(false);
  }

  /** Steps 4–7, after the confirmation. */
  async confirmFinish(): Promise<void> {
    if (this.busy()) return;
    this.confirmOpen.set(false);
    this.error.set(null);
    this.missing.set([]);
    try {
      const id = this.session.requireId();
      await this.signPrescription(id);
      await this.validateOrders(id);
      await this.signDocuments(id);

      this.phase.set('closing');
      const current = await firstValueFrom(this.consultations.get(id));
      this.session.consultation.set(current);
      if (current.status === 'COMPLETED') return this.complete(current);
      if (current.status === 'FINALIZING') return await this.pollUntilClosed(2);

      if (!(await this.readinessOk(id))) return;
      const operation = `finish:${current.version}:${this.session.noteVersion}`;
      const result = await firstValueFrom(this.consultations.finish(
        id, current.version, this.session.noteVersion, this.key(operation),
      ));
      this.keys.delete(operation);
      if (result.status === 'COMPLETED') return this.complete(result);
      return await this.pollUntilClosed(2);
    } catch (raw: unknown) {
      await this.onFailure(raw);
    }
  }

  /** Polls the consultation until COMPLETED (2 minutes at most). Also used when the page opens in FINALIZING. */
  async pollUntilClosed(retryAfterSeconds: number | null): Promise<void> {
    const id = this.session.requireId();
    this.canResume.set(false);
    if (this.closureFailed()) {
      this.phase.set('idle');
      return;
    }
    this.phase.set('pending');
    const deadline = Date.now() + FINISH_POLL_TIMEOUT_MS;
    const interval = Math.max(1, retryAfterSeconds ?? 2) * 1000;
    while (!this.destroyed && Date.now() < deadline) {
      await this.sleep(interval);
      if (this.destroyed) return;
      try {
        const consultation = await firstValueFrom(this.consultations.get(id));
        this.session.consultation.set(consultation);
        if (consultation.status === 'COMPLETED') return this.complete(consultation);
        if (consultation.status === 'FINALIZING' && consultation.finishState === 'FAILED') {
          this.session.stopAutosave();
          this.phase.set('idle');
          this.error.set(null);
          return;
        }
        if (consultation.status === 'ABORTED') {
          this.phase.set('idle');
          this.error.set(consultationErrorMessage('CONSULTATION_ABORTED'));
          return;
        }
        if (consultation.status === 'IN_PROGRESS') {
          // The server rolled back: the consultation is open again, « Terminer » can be retried.
          this.phase.set('idle');
          this.error.set(consultationErrorMessage(null));
          return;
        }
      } catch {
        // Keep polling until the deadline: a read failure is not an outcome.
      }
    }
    if (this.destroyed) return;
    this.phase.set('idle');
    this.error.set('La clôture prend plus de temps que prévu.');
    this.canResume.set(this.session.consultation()?.status === 'FINALIZING');
  }

  /**
   * « Reprendre la clôture » (page reopened in FINALIZING): re-sends finish with the same key, without
   * the clinical-record read (refused in FINALIZING) — the server resumes with the versions it
   * captured at the first « Terminer ». Never offered once the closure has failed.
   */
  async resumeClosure(): Promise<void> {
    const current = this.session.consultation();
    if (this.busy() || current === null || current.status !== 'FINALIZING' || this.closureFailed()) return;
    this.error.set(null);
    this.canResume.set(false);
    this.phase.set('closing');
    const operation = `resume:${current.version}`;
    try {
      const result = await firstValueFrom(this.consultations.finish(current.consultationId, current.version, null, this.key(operation)));
      this.keys.delete(operation);
      if (result.status === 'COMPLETED') return this.complete(result);
      this.session.consultation.set(result);
      await this.pollUntilClosed(2);
    } catch (raw: unknown) {
      const error = normalizeHttpError(raw);
      if (!isAmbiguous(raw)) this.keys.delete(operation);
      if (error.code !== null && POLLED_CODES.has(error.code)) {
        await this.pollUntilClosed(error.retryAfterSeconds);
        return;
      }
      this.phase.set('idle');
      if (error.code === 'CONSULTATION_FINISH_FAILED') {
        try {
          this.session.consultation.set(await firstValueFrom(this.consultations.get(current.consultationId)));
        } catch {
          this.error.set(consultationErrorMessage(error));
        }
        return;
      }
      this.error.set(consultationErrorMessage(error));
      this.canResume.set(true);
    }
  }

  private async signPrescription(id: string): Promise<void> {
    if (this.session.note().medicationDecision !== 'MEDICATION_PRESCRIBED' || this.session.prescriptionSigned()) return;
    const prescription = this.session.prescription();
    if (prescription === null || prescription.status !== 'DRAFT') return;
    this.phase.set('signing-prescription');
    const operation = `rx:${prescription.prescriptionVersion}:${this.session.noteVersion}`;
    const signed = await firstValueFrom(this.prescriptionApi.finalize(
      id, prescription.prescriptionVersion, this.session.noteVersion, this.key(operation),
    ));
    this.keys.delete(operation);
    this.session.prescription.set(signed);
  }

  private async validateOrders(id: string): Promise<void> {
    const drafts = this.session.orders().filter((row) => row.server?.status === 'DRAFT');
    if (drafts.length === 0) return;
    this.phase.set('validating-orders');
    for (const row of drafts) {
      const order = row.server!;
      const operation = `order:${order.clinicalOrderId}:${order.clinicalOrderVersion}`;
      const finalized = await firstValueFrom(this.orderApi.finalize(id, order, this.key(operation)));
      this.keys.delete(operation);
      this.session.setOrderServer(row.key, finalized);
    }
  }

  private async signDocuments(id: string): Promise<void> {
    const drafts = CERTIFICATES
      .map((type) => ({ type, server: this.session.certificates()[type]?.server ?? null }))
      .filter((entry) => entry.server?.status === 'DRAFT');
    if (drafts.length === 0) return;
    this.phase.set('signing-documents');
    for (const { type, server } of drafts) {
      const operation = `artifact:${server!.artifactId}:${server!.artifactVersion}`;
      const signed = await firstValueFrom(this.artifactApi.finalize(id, server!, this.key(operation)));
      this.keys.delete(operation);
      this.session.setCertificateServer(type, signed);
    }
  }

  private async readinessOk(id: string): Promise<boolean> {
    const readiness = await firstValueFrom(this.consultations.finishReadiness(id, this.session.noteVersion));
    if (readiness.ready) return true;
    this.missing.set(dedupe(readiness.missing.map(readinessItem)));
    this.phase.set('idle');
    return false;
  }

  private async onFailure(raw: unknown): Promise<void> {
    const error = normalizeHttpError(raw);
    if (!isAmbiguous(raw)) this.forgetKeys();
    if (error.code !== null && POLLED_CODES.has(error.code)) {
      await this.pollUntilClosed(error.retryAfterSeconds);
      return;
    }
    this.phase.set('idle');
    if (error.code === 'CONSULTATION_NOT_READY_TO_FINISH') {
      try {
        if (await this.readinessOk(this.session.requireId())) this.error.set(consultationErrorMessage(error));
      } catch {
        this.error.set(consultationErrorMessage(error));
      }
      return;
    }
    if (error.status === 400 || error.status === 422) {
      this.error.set('Certains champs sont à corriger.');
      return;
    }
    this.error.set(consultationErrorMessage(error as AppHttpError));
  }

  private complete(consultation: ActiveConsultation): void {
    this.session.consultation.set(consultation);
    this.session.stopAutosave();
    this.keys.clear();
    this.phase.set('done');
    void this.activeConsultation.refresh().catch(() => undefined);
  }

  /** Same operation, same Idempotency-Key, until a definite outcome. */
  private key(operation: string): string {
    let key = this.keys.get(operation);
    if (key === undefined) {
      key = `consultation-${operation.split(':')[0]}:${globalThis.crypto.randomUUID()}`;
      this.keys.set(operation, key);
    }
    return key;
  }

  private forgetKeys(): void {
    this.keys.clear();
  }

  private sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        this.wakeUp = null;
        resolve();
      }, milliseconds);
      this.wakeUp = () => {
        clearTimeout(timer);
        resolve();
      };
    });
  }
}

function isAmbiguous(raw: unknown): boolean {
  return raw instanceof HttpErrorResponse && (raw.status === 0 || raw.status >= 500);
}

function dedupe(items: readonly ReadinessItem[]): readonly ReadinessItem[] {
  const seen = new Set<string>();
  return items.filter((item) => (seen.has(item.label) ? false : (seen.add(item.label), true)));
}
