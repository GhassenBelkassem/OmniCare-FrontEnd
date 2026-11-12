import { HttpErrorResponse } from '@angular/common/http';
import { DestroyRef, Injectable, computed, effect, inject, signal, untracked } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { firstValueFrom } from 'rxjs';

import { RealtimeService } from '../../../core/realtime/realtime.service';

import { normalizeHttpError } from '../../../core/http/app-http-error';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import { canReadMedicalContext, isExternalOwner, type AccessRequestState, type ActiveConsultation } from '../active-consultation.models';
import { AppointmentApiService } from '../appointment-api.service';
import { ArtifactApiService } from '../artifact-api.service';
import type { ArtifactResponse } from '../artifact.models';
import { ClinicalOrderApiService } from '../clinical-order-api.service';
import type { ClinicalOrder, ClinicalOrderDefinition } from '../clinical-order.models';
import { ClinicalRecordApiService } from '../clinical-record-api.service';
import { EMPTY_CLINICAL_RECORD, type ClinicalRecordPayload } from '../clinical-record.models';
import type { EssentialInformation } from '../medical-record.models';
import { MedicalRecordStore } from '../medical-record.store';
import { PrescriptionApiService } from '../prescription-api.service';
import type { MedicationDecision, PrescriptionResponse } from '../prescription.models';
import { AutosaveQueue, type AutosaveState } from './model/autosave-queue';
import { consultationErrorMessage, mapServerFieldErrors } from './model/consultation-errors';
import {
  EMPTY_CERTIFICATE,
  EMPTY_NOTE_FORM,
  certificatePayload,
  isBlankLine,
  isEmptyNote,
  medicationLinesFromContent,
  newMedicationLine,
  noteFormFromPayload,
  notePayload,
  prescriptionPayload,
  summaryFormFromUpdate,
  todayInTunis,
  validateCertificate,
  validateNoteForSave,
  validateOrder,
  validatePrescription,
  type CertificateForm,
  type CertificateType,
  type FieldErrors,
  type MedicalSummaryForm,
  type MedicationLineForm,
  type NoteForm,
  type OrderRowForm,
} from './model/consultation-form';
import { CONSULTATION_RULES, type OrderCategory } from './model/consultation-rules';

export interface OrderRow {
  readonly key: string;
  readonly server: ClinicalOrder | null;
  readonly form: OrderRowForm;
}

export interface CertificateRow {
  readonly server: ArtifactResponse | null;
  readonly form: CertificateForm;
}

export type SaveIndicator =
  | { readonly kind: 'saving'; readonly label: string }
  | { readonly kind: 'saved'; readonly label: string }
  | { readonly kind: 'retrying'; readonly label: string }
  | { readonly kind: 'offline'; readonly label: string }
  | { readonly kind: 'attention'; readonly label: string };

type LoadState = 'loading' | 'ready' | 'error';

const CERTIFICATE_TYPES: readonly CertificateType[] = ['SICK_LEAVE_CERTIFICATE', 'MEDICAL_CERTIFICATE'];

/**
 * The consultation page's state: one draft per resource, held in memory only, each with its own
 * autosave queue (note, prescription, each order, each document). Provided by the page.
 */
@Injectable()
export class ConsultationSessionStore {
  private readonly consultations = inject(ActiveConsultationApiService);
  private readonly appointments = inject(AppointmentApiService);
  private readonly clinicalApi = inject(ClinicalRecordApiService);
  private readonly prescriptionApi = inject(PrescriptionApiService);
  private readonly orderApi = inject(ClinicalOrderApiService);
  private readonly artifactApi = inject(ArtifactApiService);
  readonly medicalRecord = inject(MedicalRecordStore);
  readonly rules = inject(CONSULTATION_RULES);
  private readonly realtime = inject(RealtimeService);

  private consultationIdValue: string | null = null;
  private noteBase: ClinicalRecordPayload = EMPTY_CLINICAL_RECORD;
  private noteVersionValue = 0;
  private summaryTouched = false;
  private nextRowKey = 0;
  private readonly orderQueues = new Map<string, AutosaveQueue<OrderRowForm>>();
  private readonly certificateQueues = new Map<CertificateType, AutosaveQueue<CertificateForm>>();
  private generation = 0;
  private tick: ReturnType<typeof setInterval> | null = null;

  // --- Consultation ---------------------------------------------------------------------------
  readonly consultation = signal<ActiveConsultation | null>(null);
  readonly consultationError = signal<string | null>(null);
  readonly appointmentStartAt = signal<string | null>(null);
  readonly externalOwner = computed(() => isExternalOwner(this.consultation()));
  readonly canReadContext = computed(() => canReadMedicalContext(this.consultation()));
  /** G-1 D2: the patient revoked the access during this consultation, or it expired. */
  readonly accessRevoked = signal(false);

  // --- Clinical resources ---------------------------------------------------------------------
  readonly loadState = signal<LoadState>('loading');
  readonly note = signal<NoteForm>(EMPTY_NOTE_FORM);
  readonly summaryBaseline = signal<MedicalSummaryForm | null>(null);
  readonly lines = signal<readonly MedicationLineForm[]>([]);
  readonly prescription = signal<PrescriptionResponse | null>(null);
  readonly orders = signal<readonly OrderRow[]>([]);
  readonly ordersRequested = signal(false);
  readonly certificates = signal<Readonly<Record<CertificateType, CertificateRow | null>>>({
    SICK_LEAVE_CERTIFICATE: null,
    MEDICAL_CERTIFICATE: null,
  });
  /** Error of a discard or another explicit action, already in French. */
  readonly actionError = signal<string | null>(null);

  // --- Autosave -------------------------------------------------------------------------------
  readonly noteQueue: AutosaveQueue<NoteForm>;
  readonly prescriptionQueue: AutosaveQueue<readonly MedicationLineForm[]>;
  private readonly queueList = signal<readonly AutosaveQueue<unknown>[]>([]);
  readonly online = signal(globalThis.navigator?.onLine ?? true);
  readonly now = signal(Date.now());

  /** The summary section exists only for the custodian of an external patient. */
  readonly summaryEditable = computed(() => this.externalOwner() && this.summaryBaseline() !== null);

  readonly queueStates = computed<readonly AutosaveState[]>(() => this.queueList().map((queue) => queue.state()));
  readonly conflict = computed(() => this.queueStates().includes('conflict'));
  readonly finalizedElsewhere = computed(() => this.queueStates().includes('finalized'));

  readonly saveIndicator = computed<SaveIndicator>(() => {
    const states = this.queueStates();
    if (!this.online()) return { kind: 'offline', label: 'Hors ligne' };
    if (states.includes('offline')) return { kind: 'offline', label: 'Hors ligne' };
    if (states.includes('retrying')) return { kind: 'retrying', label: 'Non enregistré — nouvelle tentative…' };
    if (states.includes('conflict') || states.includes('failed') || states.includes('finalized')) {
      return { kind: 'attention', label: 'Non enregistré' };
    }
    if (states.includes('saving') || states.includes('pending')) return { kind: 'saving', label: 'Enregistrement…' };
    if (states.includes('blocked') || states.includes('invalid')) {
      return { kind: 'attention', label: 'Non enregistré · champs à corriger' };
    }
    const last = Math.max(0, ...this.queueList().map((queue) => queue.lastSavedAt() ?? 0));
    if (last === 0) return { kind: 'saved', label: 'Enregistré' };
    return { kind: 'saved', label: `Enregistré · ${elapsed(this.now() - last)}` };
  });

  /** Live client errors (save rules). Finish-only rules live in the finish flow. */
  readonly clientErrors = computed<FieldErrors>(() => {
    const errors: Record<string, string> = {
      ...validateNoteForSave(this.note(), todayInTunis(new Date(this.now())), this.summaryEditable()),
    };
    if (this.note().medicationDecision === 'MEDICATION_PRESCRIBED') {
      Object.assign(errors, validatePrescription(this.lines(), this.rules));
    }
    for (const row of this.orders()) {
      for (const [field, message] of Object.entries(validateOrder(row.form))) errors[`order:${row.key}.${field}`] = message;
    }
    for (const type of CERTIFICATE_TYPES) {
      const row = this.certificates()[type];
      if (row === null) continue;
      for (const [field, message] of Object.entries(validateCertificate(type, row.form, this.rules))) {
        errors[`artifact:${type}.${field}`] = message;
      }
    }
    return errors;
  });

  /** Field errors returned by the server on the last save of each resource (always shown). */
  readonly serverErrors = computed<FieldErrors>(() => {
    const errors: Record<string, string> = {};
    for (const queue of this.queueList()) {
      if (queue.state() === 'invalid') Object.assign(errors, queue.fieldErrors());
    }
    return errors;
  });

  /** A failed save that is not a field error (shown by code, never server text). */
  readonly saveFailure = computed<string | null>(() => {
    const failed = this.queueList().find((queue) => queue.state() === 'failed');
    return failed ? consultationErrorMessage(failed.error()) : null;
  });

  constructor() {
    this.noteQueue = new AutosaveQueue<NoteForm>({
      validate: (form) => validateNoteForSave(form, todayInTunis(), this.summaryEditable()),
      isEmpty: (form) => isEmptyNote(this.notePayloadOf(form)),
      send: async (form, key) => {
        const id = this.requireId();
        const saved = await firstValueFrom(this.clinicalApi.save(id, this.noteVersionValue, this.notePayloadOf(form), key));
        this.noteVersionValue = saved.clinicalRecordVersion;
        this.noteBase = saved.clinicalRecord;
      },
      mapFieldErrors: (error) => mapServerFieldErrors(error, { kind: 'note' }, this.rules),
    }, { keyPrefix: 'clinical-save' });

    this.prescriptionQueue = new AutosaveQueue<readonly MedicationLineForm[]>({
      validate: (lines) => validatePrescription(lines, this.rules),
      isEmpty: (lines) => lines.every(isBlankLine) || this.prescriptionSigned(),
      send: async (lines, key) => {
        const id = this.requireId();
        const current = this.prescription();
        const saved = await firstValueFrom(this.prescriptionApi.save(
          id, current?.prescriptionVersion ?? 0, prescriptionPayload(lines, current?.prescription ?? null), key,
        ));
        this.prescription.set(saved);
      },
      mapFieldErrors: (error) => mapServerFieldErrors(error, { kind: 'prescription' }, this.rules),
    }, { keyPrefix: 'prescription-save' });

    this.queueList.set([this.noteQueue, this.prescriptionQueue] as AutosaveQueue<unknown>[]);

    // The patient's current summary is the baseline of the summary section (custodian only).
    effect(() => {
      const workspace = this.medicalRecord.workspace();
      const owner = this.externalOwner();
      untracked(() => {
        const authorized = workspace?.access.sections['ESSENTIAL_INFORMATION'] === 'AUTHORIZED';
        const baseline = owner && authorized && workspace ? summaryFromEssential(workspace.essentialInformation) : null;
        this.summaryBaseline.set(baseline);
        if (baseline !== null && !this.summaryTouched && this.loadState() === 'ready') {
          // Same payload as before (the saved update is carried over), so typed text stays unsaved.
          const clean = !this.noteQueue.hasUnsaved();
          this.note.update((form) => ({ ...form, summary: summaryFormFromUpdate(this.noteBase.medicalSummaryUpdate ?? null, baseline) }));
          if (clean) this.noteQueue.setBaseline(this.note());
          else this.noteQueue.schedule(this.note());
        }
      });
    });

    effect(() => {
      const consultation = this.consultation();
      untracked(() => {
        if (consultation && canReadMedicalContext(consultation)) this.medicalRecord.attach(consultation.consultationId);
        else this.medicalRecord.clear();
      });
    });

    // G-1 D2: the patient's answer, a revoke or an expiry changes the access live (no reload).
    this.realtime.scheduledCareEvents$
      .pipe(takeUntilDestroyed(inject(DestroyRef)))
      .subscribe((event) => {
        if (event.eventType === 'CLINICAL_ACCESS_CHANGED' && event.resourceType === 'CONSULTATION'
          && event.resourceId === this.consultationIdValue) {
          void this.refreshAccess();
        }
      });

    const online = (): void => {
      this.online.set(true);
      for (const queue of this.queueList()) queue.resume();
    };
    const offline = (): void => this.online.set(false);
    globalThis.addEventListener?.('online', online);
    globalThis.addEventListener?.('offline', offline);
    this.tick = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => {
      globalThis.removeEventListener?.('online', online);
      globalThis.removeEventListener?.('offline', offline);
      if (this.tick !== null) clearInterval(this.tick);
      this.destroyAllQueues();
      this.medicalRecord.clear();
      this.generation += 1;
    });
  }

  get consultationId(): string | null {
    return this.consultationIdValue;
  }

  get noteVersion(): number {
    return this.noteVersionValue;
  }

  // --- Loading --------------------------------------------------------------------------------

  async load(consultationId: string): Promise<void> {
    this.consultationIdValue = consultationId;
    await this.loadConsultation();
    const consultation = this.consultation();
    if (consultation?.status === 'IN_PROGRESS') await this.loadClinical();
  }

  async loadConsultation(): Promise<void> {
    const id = this.requireId();
    this.consultationError.set(null);
    try {
      const consultation = await firstValueFrom(this.consultations.get(id));
      this.consultation.set(consultation);
      if (consultation.sourceType === 'SCHEDULED_APPOINTMENT' && this.appointmentStartAt() === null) {
        void firstValueFrom(this.appointments.getAppointment(consultation.sourceId))
          .then((appointment) => this.appointmentStartAt.set(appointment.startTime))
          .catch(() => undefined);
      }
    } catch (error: unknown) {
      this.consultationError.set(normalizeHttpError(error).code ?? 'UNKNOWN');
    }
  }

  /**
   * G-1 D2: re-reads the consultation after an access change. Only the access projection and the
   * request state are taken; the clinical drafts are untouched. Losing a readable access while
   * the consultation is in progress is shown as « accès retiré ».
   */
  async refreshAccess(): Promise<void> {
    const before = this.consultation();
    if (!before) return;
    try {
      const fresh = await firstValueFrom(this.consultations.get(before.consultationId));
      const current = this.consultation();
      if (!current || current.consultationId !== fresh.consultationId) return;
      const wasReadable = canReadMedicalContext(current);
      const next: ActiveConsultation = {
        ...current,
        // Request and access changes bump the consultation version: keep it current for finish/abort.
        version: Math.max(current.version, fresh.version),
        access: fresh.access ?? current.access,
        medicalAccessStatus: fresh.medicalAccessStatus,
        accessRequest: fresh.accessRequest ?? null,
      };
      this.consultation.set(next);
      const readable = canReadMedicalContext(next);
      if (readable) this.accessRevoked.set(false);
      else if (wasReadable && next.status === 'IN_PROGRESS') this.accessRevoked.set(true);
    } catch {
      // A failed refresh keeps what is shown; the next event or the medical record read retries.
    }
  }

  /** G-1 D2: a request sent or cancelled from the page. */
  applyAccessRequest(state: AccessRequestState): void {
    this.consultation.update((current) => (current ? { ...current, accessRequest: state } : current));
    // The command bumped the consultation version; re-read it without waiting for the live event.
    void this.refreshAccess();
  }

  /** Re-reads every clinical resource. Drops the in-memory drafts (only after a confirmation). */
  async loadClinical(): Promise<void> {
    const id = this.requireId();
    const generation = ++this.generation;
    this.loadState.set('loading');
    this.actionError.set(null);
    this.resetQueues();
    try {
      const [record, prescription, orders, artifacts] = await Promise.all([
        firstValueFrom(this.clinicalApi.read(id)),
        firstValueFrom(this.prescriptionApi.read(id)),
        firstValueFrom(this.orderApi.list(id)),
        firstValueFrom(this.artifactApi.list(id)),
      ]);
      if (generation !== this.generation) return;
      this.noteBase = record.clinicalRecord;
      this.noteVersionValue = record.clinicalRecordVersion;
      this.summaryTouched = false;
      const baseline = this.summaryBaseline();
      this.note.set(noteFormFromPayload(record.clinicalRecord, summaryFormFromUpdate(null, baseline ?? EMPTY_NOTE_FORM.summary)));
      this.noteQueue.setBaseline(this.note());

      this.prescription.set(prescription);
      const lines = medicationLinesFromContent(prescription.prescription);
      this.lines.set(lines);
      this.prescriptionQueue.setBaseline(lines);

      const rows = orders.orders.map((order) => this.orderRowFromServer(order));
      this.orders.set(rows);
      this.ordersRequested.set(rows.length > 0);
      for (const row of rows) this.createOrderQueue(row);

      const certificates: Record<CertificateType, CertificateRow | null> = { SICK_LEAVE_CERTIFICATE: null, MEDICAL_CERTIFICATE: null };
      for (const artifact of artifacts.artifacts) {
        if (artifact.artifactType !== 'SICK_LEAVE_CERTIFICATE' && artifact.artifactType !== 'MEDICAL_CERTIFICATE') continue;
        const current = certificates[artifact.artifactType];
        if (current?.server && current.server.updatedAt > artifact.updatedAt) continue;
        certificates[artifact.artifactType] = { server: artifact, form: certificateFormFromServer(artifact) };
      }
      this.certificates.set(certificates);
      for (const type of CERTIFICATE_TYPES) if (certificates[type] !== null) this.createCertificateQueue(type, certificates[type]!.form);

      this.refreshQueueList();
      this.loadState.set('ready');
    } catch {
      if (generation === this.generation) this.loadState.set('error');
    }
  }

  // --- Note -----------------------------------------------------------------------------------

  updateNote(patch: Partial<NoteForm>): void {
    if ('summary' in patch) this.summaryTouched = true;
    this.note.update((form) => ({ ...form, ...patch }));
    this.noteQueue.schedule(this.note());
  }

  // --- Treatment ------------------------------------------------------------------------------

  /** True when switching to « Aucun médicament » would drop typed or saved lines. */
  prescriptionHasData(): boolean {
    return this.lines().some((line) => !isBlankLine(line)) || this.prescription()?.status === 'DRAFT';
  }

  prescriptionSigned(): boolean {
    const current = this.prescription();
    return current !== null && (current.finalized || current.status === 'ACTIVE');
  }

  /**
   * Something is signed or validated (prescription, order or document): the consultation can no
   * longer be cancelled, only finished (CTO decision, G-1 P3a). The server enforces the same rule.
   */
  hasSignedItems(): boolean {
    return this.prescriptionSigned()
      || this.orders().some((row) => row.server !== null && row.server.status !== 'DRAFT')
      || Object.values(this.certificates()).some((row) => row !== null && row.server !== null && row.server.status !== 'DRAFT');
  }

  async setMedicationDecision(decision: MedicationDecision): Promise<boolean> {
    if (decision === 'NO_MEDICATION') {
      const discarded = await this.discardPrescription();
      if (!discarded) return false;
    } else if (this.lines().length === 0) {
      this.lines.set([newMedicationLine(globalThis.crypto.randomUUID())]);
    }
    this.updateNote({ medicationDecision: decision });
    return true;
  }

  addMedicationLine(): void {
    if (this.lines().length >= this.rules.maxMedications || this.prescriptionSigned()) return;
    this.setLines([...this.lines(), newMedicationLine(globalThis.crypto.randomUUID())]);
  }

  updateMedicationLine(index: number, patch: Partial<MedicationLineForm>): void {
    this.setLines(this.lines().map((line, position) => (position === index ? { ...line, ...patch } : line)));
  }

  async removeMedicationLine(index: number): Promise<void> {
    const next = this.lines().filter((_, position) => position !== index);
    if (next.every(isBlankLine) && this.prescription()?.status === 'DRAFT') {
      // The server would keep the old lines: clear the draft instead of saving an empty one.
      if (!(await this.discardPrescription())) return;
    }
    this.setLines(next);
  }

  private setLines(lines: readonly MedicationLineForm[]): void {
    if (this.prescriptionSigned()) return;
    this.lines.set(lines);
    this.prescriptionQueue.schedule(lines);
  }

  private async discardPrescription(): Promise<boolean> {
    await this.prescriptionQueue.settle();
    const current = this.prescription();
    if (current !== null && (current.finalized || current.status === 'ACTIVE')) {
      this.actionError.set('L’ordonnance est déjà signée : elle ne peut plus être retirée.');
      return false;
    }
    if (current?.status === 'DRAFT') {
      try {
        const cleared = await firstValueFrom(this.prescriptionApi.discard(
          this.requireId(), current.prescriptionVersion, `prescription-discard:${globalThis.crypto.randomUUID()}`,
        ));
        this.prescription.set(cleared);
      } catch (error: unknown) {
        if (!isNotFound(error)) {
          this.actionError.set(consultationErrorMessage(normalizeHttpError(error)));
          return false;
        }
      }
    }
    this.actionError.set(null);
    this.lines.set([]);
    this.prescriptionQueue.setBaseline([]);
    return true;
  }

  // --- Orders ---------------------------------------------------------------------------------

  ordersHaveData(): boolean {
    return this.orders().some((row) => row.server !== null || row.form.target.trim() !== '');
  }

  async setOrdersRequested(requested: boolean): Promise<boolean> {
    if (requested) {
      this.ordersRequested.set(true);
      if (this.orders().length === 0) this.addOrder('LAB');
      return true;
    }
    for (const row of [...this.orders()]) {
      if (!(await this.removeOrder(row.key))) return false;
    }
    this.ordersRequested.set(false);
    return true;
  }

  addOrder(category: OrderCategory): void {
    const row: OrderRow = { key: this.rowKey(), server: null, form: { category, target: '' } };
    this.orders.update((rows) => [...rows, row]);
    this.createOrderQueue(row);
    this.refreshQueueList();
  }

  updateOrder(key: string, patch: Partial<OrderRowForm>): void {
    const row = this.orders().find((value) => value.key === key);
    if (!row || row.server?.status === 'FINALIZED') return;
    // The type is locked after the first successful save: remove the row and add a new one.
    if (row.server !== null && patch.category !== undefined && patch.category !== row.form.category) return;
    const form = { ...row.form, ...patch };
    this.orders.update((rows) => rows.map((value) => (value.key === key ? { ...value, form } : value)));
    this.orderQueues.get(key)?.schedule(form);
  }

  async removeOrder(key: string): Promise<boolean> {
    const queue = this.orderQueues.get(key);
    await queue?.settle();
    const row = this.orders().find((value) => value.key === key);
    if (!row) return true;
    if (row.server?.status === 'FINALIZED') {
      this.actionError.set('Cette demande d’examen est déjà validée : elle ne peut plus être retirée.');
      return false;
    }
    if (row.server !== null) {
      try {
        await firstValueFrom(this.orderApi.discard(
          this.requireId(), row.server.clinicalOrderId, row.server.clinicalOrderVersion,
          `order-discard:${globalThis.crypto.randomUUID()}`,
        ));
      } catch (error: unknown) {
        if (!isNotFound(error)) {
          this.actionError.set(consultationErrorMessage(normalizeHttpError(error)));
          return false;
        }
      }
    }
    queue?.destroy();
    this.orderQueues.delete(key);
    this.orders.update((rows) => rows.filter((value) => value.key !== key));
    this.refreshQueueList();
    this.actionError.set(null);
    return true;
  }

  /** Replaces a row's server copy (after finalization). */
  setOrderServer(key: string, server: ClinicalOrder): void {
    this.orders.update((rows) => rows.map((row) => (row.key === key ? { ...row, server } : row)));
  }

  private createOrderQueue(row: OrderRow): void {
    const key = row.key;
    const queue = new AutosaveQueue<OrderRowForm>({
      validate: (form) => prefix(`order:${key}.`, validateOrder(form)),
      send: async (form, idempotencyKey) => {
        const id = this.requireId();
        const current = this.orders().find((value) => value.key === key)?.server ?? null;
        const definition = orderDefinition(form);
        const saved = current === null
          ? await firstValueFrom(this.orderApi.create(id, form.category, definition, idempotencyKey))
          : await firstValueFrom(this.orderApi.update(id, { ...current, category: form.category }, definition, idempotencyKey));
        this.setOrderServer(key, saved);
      },
      mapFieldErrors: (error) => mapServerFieldErrors(error, { kind: 'order', rowKey: key }, this.rules),
    }, { keyPrefix: 'order-save' });
    if (row.server !== null) queue.setBaseline(row.form);
    this.orderQueues.set(key, queue);
  }

  // --- Documents ------------------------------------------------------------------------------

  certificateHasData(type: CertificateType): boolean {
    const row = this.certificates()[type];
    return row !== null && (row.server !== null || row.form.statement.trim() !== '' || row.form.startDate !== null || row.form.endDate !== null);
  }

  async setCertificateEnabled(type: CertificateType, enabled: boolean): Promise<boolean> {
    if (enabled) {
      if (this.certificates()[type] !== null) return true;
      const form = type === 'SICK_LEAVE_CERTIFICATE'
        ? { ...EMPTY_CERTIFICATE, startDate: todayInTunis() }
        : EMPTY_CERTIFICATE;
      this.certificates.update((value) => ({ ...value, [type]: { server: null, form } }));
      this.createCertificateQueue(type, null);
      this.refreshQueueList();
      return true;
    }
    const queue = this.certificateQueues.get(type);
    await queue?.settle();
    const row = this.certificates()[type];
    if (row?.server?.status === 'FINALIZED') {
      this.actionError.set('Ce document est déjà signé : il ne peut plus être retiré.');
      return false;
    }
    if (row?.server) {
      try {
        await firstValueFrom(this.artifactApi.discard(
          this.requireId(), row.server.artifactId, row.server.artifactVersion,
          `artifact-discard:${globalThis.crypto.randomUUID()}`,
        ));
      } catch (error: unknown) {
        if (!isNotFound(error)) {
          this.actionError.set(consultationErrorMessage(normalizeHttpError(error)));
          return false;
        }
      }
    }
    queue?.destroy();
    this.certificateQueues.delete(type);
    this.certificates.update((value) => ({ ...value, [type]: null }));
    this.refreshQueueList();
    this.actionError.set(null);
    return true;
  }

  updateCertificate(type: CertificateType, patch: Partial<CertificateForm>): void {
    const row = this.certificates()[type];
    if (row === null || row.server?.status === 'FINALIZED') return;
    const form = { ...row.form, ...patch };
    this.certificates.update((value) => ({ ...value, [type]: { ...row, form } }));
    this.certificateQueues.get(type)?.schedule(form);
  }

  setCertificateServer(type: CertificateType, server: ArtifactResponse): void {
    this.certificates.update((value) => {
      const row = value[type];
      return row === null ? value : { ...value, [type]: { ...row, server } };
    });
  }

  private createCertificateQueue(type: CertificateType, baseline: CertificateForm | null): void {
    const queue = new AutosaveQueue<CertificateForm>({
      validate: (form) => prefix(`artifact:${type}.`, validateCertificate(type, form, this.rules)),
      send: async (form, idempotencyKey) => {
        const id = this.requireId();
        const current = this.certificates()[type]?.server ?? null;
        const definition = certificatePayload(type, form);
        const saved = current === null
          ? await firstValueFrom(this.artifactApi.createCertificate(id, type, definition, idempotencyKey))
          : await firstValueFrom(this.artifactApi.update(id, current.artifactId, current.artifactVersion, definition, idempotencyKey));
        this.setCertificateServer(type, saved);
      },
      mapFieldErrors: (error) => mapServerFieldErrors(error, { kind: 'artifact', type }, this.rules),
    }, { keyPrefix: 'artifact-save' });
    if (baseline !== null) queue.setBaseline(baseline);
    this.certificateQueues.set(type, queue);
  }

  // --- Orchestration helpers ------------------------------------------------------------------

  /** Sends every pending change now and waits for all of them. */
  async flushAll(): Promise<void> {
    await Promise.all(this.queueList().map((queue) => queue.flush()));
  }

  /** Something typed is not on the server yet (router guard, beforeunload, Terminer). */
  hasUnsavedChanges(): boolean {
    return this.queueList().some((queue) => queue.hasUnsaved() || queue.isBusy());
  }

  /** Stops autosave once the consultation is closed. */
  stopAutosave(): void {
    this.destroyAllQueues();
  }

  /** Before a reload: row queues are dropped, the note and prescription queues are reset. */
  private resetQueues(): void {
    for (const queue of this.orderQueues.values()) queue.destroy();
    for (const queue of this.certificateQueues.values()) queue.destroy();
    this.orderQueues.clear();
    this.certificateQueues.clear();
    this.noteQueue.setBaseline(this.note());
    this.prescriptionQueue.setBaseline(this.lines());
    this.refreshQueueList();
  }

  private destroyAllQueues(): void {
    this.noteQueue.destroy();
    this.prescriptionQueue.destroy();
    for (const queue of this.orderQueues.values()) queue.destroy();
    for (const queue of this.certificateQueues.values()) queue.destroy();
  }

  private refreshQueueList(): void {
    this.queueList.set([
      this.noteQueue,
      this.prescriptionQueue,
      ...this.orderQueues.values(),
      ...this.certificateQueues.values(),
    ] as AutosaveQueue<unknown>[]);
  }

  private notePayloadOf(form: NoteForm): ClinicalRecordPayload {
    return notePayload(form, this.noteBase, this.summaryEditable() ? this.summaryBaseline() : null);
  }

  private orderRowFromServer(order: ClinicalOrder): OrderRow {
    const target = order.category === 'LAB'
      ? order.definition.requestedExamination
      : order.category === 'IMAGING' ? order.definition.requestedStudy : order.definition.targetSpecialty;
    return { key: this.rowKey(), server: order, form: { category: order.category, target: target ?? '' } };
  }

  private rowKey(): string {
    this.nextRowKey += 1;
    return `r${this.nextRowKey}`;
  }

  requireId(): string {
    if (this.consultationIdValue === null) throw new Error('consultation not attached');
    return this.consultationIdValue;
  }

  /** Every queue, for the finish flow and tests. */
  queues(): readonly AutosaveQueue<unknown>[] {
    return this.queueList();
  }

  orderQueue(key: string): AutosaveQueue<OrderRowForm> | undefined {
    return this.orderQueues.get(key);
  }

  certificateQueue(type: CertificateType): AutosaveQueue<CertificateForm> | undefined {
    return this.certificateQueues.get(type);
  }
}

export function summaryFromEssential(info: EssentialInformation | null): MedicalSummaryForm {
  const allergies = info?.allergies ?? [];
  const conditions = info?.criticalConditions ?? [];
  return {
    allergies: { status: info?.allergiesStatus ?? (allergies.length > 0 ? 'LIST' : 'UNKNOWN'), items: [...allergies] },
    conditions: { status: info?.conditionsStatus ?? (conditions.length > 0 ? 'LIST' : 'UNKNOWN'), items: [...conditions] },
    bloodType: info?.bloodType ?? 'UNKNOWN',
  };
}

function orderDefinition(form: OrderRowForm): ClinicalOrderDefinition {
  const target = form.target.trim();
  return {
    requestedExamination: form.category === 'LAB' ? target : null,
    requestedStudy: form.category === 'IMAGING' ? target : null,
    targetSpecialty: form.category === 'REFERRAL' ? target : null,
  };
}

function certificateFormFromServer(artifact: ArtifactResponse): CertificateForm {
  const certificate = artifact.definition.certificate ?? {};
  return {
    statement: certificate.statement ?? '',
    startDate: certificate.startDate ?? null,
    endDate: certificate.endDate ?? null,
  };
}

function prefix(path: string, errors: FieldErrors): FieldErrors {
  return Object.fromEntries(Object.entries(errors).map(([field, message]) => [`${path}${field}`, message]));
}

function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}

function elapsed(milliseconds: number): string {
  const seconds = Math.max(0, Math.round(milliseconds / 1000));
  if (seconds < 60) return `il y a ${seconds} s`;
  const minutes = Math.round(seconds / 60);
  return `il y a ${minutes} min`;
}
