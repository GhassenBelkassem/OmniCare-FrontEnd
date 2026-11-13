import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, linkedSignal, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import { OcButton, OcConfirmDialog, OcEmptyState } from '../../../shared/ui';
import type { UnsavedChangesAware } from '../unsaved-changes.guard';
import { ConsultationFinishFlow } from './consultation-finish.flow';
import { ConsultationSectionDirective } from './consultation-section.directive';
import { ConsultationSessionStore } from './consultation-session.store';
import { SickLeaveTemplatePicker } from './sick-leave-template-picker';
import { ConsultationUi } from './consultation-ui';
import { consultationErrorMessage } from './model/consultation-errors';
import {
  NOTE_PATHS,
  addDays,
  todayInTunis,
  type DiagnosisStatus,
  type FollowUpChoice,
  type NoteForm,
} from './model/consultation-form';
import { TEXT_LIMITS, charCount } from './model/consultation-rules';
import { ConsultationHeader } from './sections/consultation-header';
import { DocumentsSection } from './sections/documents-section';
import { FinishCard } from './sections/finish-card';
import { MedicalContextCard } from './sections/medical-context-card';
import { MedicalSummarySection } from './sections/medical-summary-section';
import { OrdersSection } from './sections/orders-section';
import { PatientRecordDrawer } from './record/patient-record-drawer';
import { ContactCompletionDrawer } from './contact-completion-drawer';
import { TreatmentSection } from './sections/treatment-section';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { ConsultationFollowUpOutcome } from '../active-consultation.models';
import { QuickBookingDrawer, type FollowUpBookingContext, type FollowUpSlotChoice } from '../calendar/quick-booking-drawer';
import {
  followUpDateKey,
  followUpOutcomeLine,
  followUpSlotLabel,
  followUpSlotSaveError,
  followUpSlotTakenMessage,
} from './model/follow-up';
import { ConsultationDocuments } from '../documents/consultation-documents';

/** While « Terminer » has not scheduled the follow-up yet: re-read every 2 s, 15 times at most. */
const FOLLOW_UP_POLL_MS = 2_000;
const FOLLOW_UP_POLL_TRIES = 15;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const DIAGNOSIS_STATUSES = [
  { label: 'Provisoire', value: 'PROVISIONAL' },
  { label: 'Confirmé', value: 'CONFIRMED' },
];

const FOLLOW_UPS = [
  { label: 'Aucun suivi', value: 'NO_FOLLOW_UP' },
  { label: 'Si besoin', value: 'FOLLOW_UP_AS_NEEDED' },
  { label: 'Contrôle à une date', value: 'FOLLOW_UP_IN_PERIOD' },
];

/**
 * The consultation, on one page: numbered section cards that appear with the doctor's
 * decisions, autosaved per resource, and « Terminer » in the right column.
 */
@Component({
  selector: 'app-consultation-page',
  imports: [
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzInputModule,
    NzSegmentedModule,
    NzSkeletonModule,
    OcButton,
    OcConfirmDialog,
    OcEmptyState,
    ConsultationHeader,
    ConsultationDocuments,
    ConsultationSectionDirective,
    DocumentsSection,
    FinishCard,
    MedicalContextCard,
    MedicalSummarySection,
    OrdersSection,
    PatientRecordDrawer,
    ContactCompletionDrawer,
    QuickBookingDrawer,
    TreatmentSection,
  ],
  templateUrl: './consultation-page.html',
  styleUrls: ['./sections/consultation-sections.scss', './consultation-page.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [ConsultationSessionStore, ConsultationFinishFlow, ConsultationUi, SickLeaveTemplatePicker],
  host: { '(window:beforeunload)': 'onBeforeUnload($event)' },
})
export class ConsultationPage implements UnsavedChangesAware {
  private readonly route = inject(ActivatedRoute);
  readonly session = inject(ConsultationSessionStore);
  readonly flow = inject(ConsultationFinishFlow);
  readonly ui = inject(ConsultationUi);
  private readonly consultationsApi = inject(ActiveConsultationApiService);
  private readonly destroyRef = inject(DestroyRef);
  private followUpPollTries = 0;
  private followUpPollTimer: ReturnType<typeof setTimeout> | null = null;
  /** The SLOT_TAKEN drawer opens by itself once per consultation; then only on demand. */
  private slotTakenPrompted = false;

  /** G-1 D4: the booking drawer as the follow-up picker (choose) or SLOT_TAKEN rebooking (book). */
  readonly followUpPicker = signal<FollowUpBookingContext | null>(null);
  readonly followUpSlotSaving = signal(false);
  readonly followUpSlotError = signal<string | null>(null);
  readonly followUpSlot = computed(() => this.session.consultation()?.followUpSlot ?? null);
  readonly followUpSlotText = computed(() => {
    const slot = this.followUpSlot();
    return slot ? followUpSlotLabel(slot.start, slot.locationName) : null;
  });
  readonly followUpOutcome = computed(() => this.session.consultation()?.followUp ?? null);
  readonly followUpLine = computed(() => followUpOutcomeLine(this.followUpOutcome()));
  readonly followUpSlotTaken = computed(() => {
    const outcome = this.followUpOutcome();
    return outcome?.status === 'SLOT_TAKEN' ? followUpSlotTakenMessage(outcome) : null;
  });
  /** Cabinet preselected in the picker: the chosen slot's, else the source appointment's. */
  readonly followUpPickerLocationId = computed(() =>
    this.followUpSlot()?.practiceLocationId ?? this.session.consultation()?.sourcePracticeLocationId ?? null);

  readonly consultationId = this.route.snapshot.paramMap.get('id') ?? '';
  readonly validRoute = UUID_PATTERN.test(this.consultationId);
  // Getters, not fields: module constants are read when rendering (see the P2b report, §7).
  get paths(): typeof NOTE_PATHS { return NOTE_PATHS; }
  get limits(): typeof TEXT_LIMITS { return TEXT_LIMITS; }
  readonly diagnosisStatuses = DIAGNOSIS_STATUSES;
  readonly followUps = FOLLOW_UPS;

  readonly note = this.session.note;
  readonly followUpChoice = linkedSignal<FollowUpChoice | null>(() => this.note().followUp);
  readonly today = computed(() => todayInTunis(new Date(this.session.now())));
  readonly followUpFar = computed(() => {
    const date = this.note().followUpDate;
    return this.note().followUp === 'FOLLOW_UP_IN_PERIOD' && date !== null && date > addDays(this.today(), 365);
  });

  /** Section numbers follow what is shown (section 3 exists only for the custodian). */
  readonly numbers = computed(() => {
    const summary = this.session.summaryEditable();
    const base = summary ? 4 : 3;
    return { summary: 3, treatment: base, orders: base + 1, followUp: base + 2, documents: base + 3 };
  });

  readonly consultationErrorText = computed(() => consultationErrorMessage(this.session.consultationError()));

  constructor() {
    if (this.validRoute) void this.start();
    // After « Terminer »: wait briefly for the follow-up outcome, and offer rebooking when the slot was taken.
    effect(() => {
      const consultation = this.session.consultation();
      const outcome = consultation?.followUp ?? null;
      if (consultation?.status !== 'COMPLETED') return;
      if (outcome?.status === 'PENDING') this.scheduleFollowUpPoll();
      if (outcome?.status === 'SLOT_TAKEN' && !this.slotTakenPrompted) {
        this.slotTakenPrompted = true;
        this.openFollowUpRebooking();
      }
    });
    this.destroyRef.onDestroy(() => {
      if (this.followUpPollTimer !== null) clearTimeout(this.followUpPollTimer);
    });
  }

  private async start(): Promise<void> {
    await this.session.load(this.consultationId);
    const consultation = this.session.consultation();
    // FINALIZING: poll for the outcome, unless the closure already failed (nothing to wait for).
    if (consultation?.status === 'FINALIZING' && consultation.finishState !== 'FAILED') await this.flow.pollUntilClosed(2);
  }

  update(patch: Partial<NoteForm>): void {
    this.session.updateNote(patch);
  }

  text(event: Event): string {
    return (event.target as HTMLInputElement | HTMLTextAreaElement).value;
  }

  count(value: string): number {
    return charCount(value);
  }

  setDiagnosisStatus(value: string | number): void {
    this.update({ diagnosisStatus: value as DiagnosisStatus });
  }

  setFollowUp(value: string | number): void {
    const choice = value as FollowUpChoice;
    this.followUpChoice.set(choice);
    this.update({ followUp: choice, followUpDate: choice === 'FOLLOW_UP_IN_PERIOD' ? this.note().followUpDate : null });
    // « Contrôle à une date » opens the slot picker; any other choice drops a chosen slot.
    if (choice === 'FOLLOW_UP_IN_PERIOD') {
      if (this.followUpSlot() === null) this.openFollowUpPicker();
    } else if (this.followUpSlot() !== null) {
      this.clearFollowUpSlot();
    }
  }

  openFollowUpPicker(): void {
    const consultation = this.session.consultation();
    if (!consultation || consultation.status !== 'IN_PROGRESS' || this.followUpSlotSaving()) return;
    this.followUpSlotError.set(null);
    this.followUpPicker.set({ consultationId: consultation.consultationId, patientName: this.patientName(), mode: 'choose' });
  }

  openFollowUpRebooking(): void {
    const consultation = this.session.consultation();
    if (!consultation || consultation.followUp?.status !== 'SLOT_TAKEN') return;
    this.followUpPicker.set({ consultationId: consultation.consultationId, patientName: this.patientName(), mode: 'book' });
  }

  closeFollowUpPicker(): void {
    this.followUpPicker.set(null);
  }

  onFollowUpSlotChosen(choice: FollowUpSlotChoice): void {
    const consultation = this.session.consultation();
    if (!consultation) return;
    this.followUpPicker.set(null);
    this.followUpSlotSaving.set(true);
    this.followUpSlotError.set(null);
    this.consultationsApi
      .saveFollowUpSlot(consultation.consultationId, {
        start: choice.start, end: choice.end, practiceLocationId: choice.practiceLocationId,
      }, consultation.followUpSlot?.version ?? 0, `follow-up-slot:${globalThis.crypto.randomUUID()}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slot) => {
          this.followUpSlotSaving.set(false);
          this.session.consultation.update((current) =>
            current ? { ...current, followUpSlot: { ...slot, locationName: slot.locationName ?? choice.locationName } } : current);
          // The note keeps the date (MRS); the slot itself stays with the consultation (Spring).
          this.update({ followUpDate: followUpDateKey(slot.start) });
        },
        error: (error: unknown) => {
          this.followUpSlotSaving.set(false);
          this.followUpSlotError.set(followUpSlotSaveError(error));
        },
      });
  }

  onFollowUpBooked(outcome: ConsultationFollowUpOutcome): void {
    this.followUpPicker.set(null);
    this.session.consultation.update((current) => (current ? { ...current, followUp: outcome } : current));
  }

  private clearFollowUpSlot(): void {
    const consultation = this.session.consultation();
    if (!consultation) return;
    this.followUpSlotError.set(null);
    this.consultationsApi
      .clearFollowUpSlot(consultation.consultationId, consultation.followUpSlot?.version ?? 0,
        `follow-up-slot-clear:${globalThis.crypto.randomUUID()}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.session.consultation.update((current) => (current ? { ...current, followUpSlot: null } : current)),
        error: () => this.followUpSlotError.set('Le créneau du contrôle n’a pas pu être retiré. Réessayez.'),
      });
  }

  private patientName(): string {
    return this.session.consultation()?.patient?.fullName?.trim() || 'Patient';
  }

  private scheduleFollowUpPoll(): void {
    if (this.followUpPollTimer !== null || this.followUpPollTries >= FOLLOW_UP_POLL_TRIES) return;
    this.followUpPollTimer = setTimeout(() => {
      this.followUpPollTimer = null;
      this.followUpPollTries += 1;
      this.consultationsApi
        .get(this.consultationId)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe({
          next: (fresh) => this.session.consultation.update((current) =>
            current ? { ...current, followUp: fresh.followUp ?? null, followUpSlot: fresh.followUpSlot ?? null } : current),
          error: () => this.scheduleFollowUpPoll(),
        });
    }, FOLLOW_UP_POLL_MS);
  }

  async finish(): Promise<void> {
    const ready = await this.flow.requestFinish();
    // A « Terminer » attempt reveals every section's errors.
    this.ui.revealAll();
    if (!ready && this.flow.missing().length > 0) this.ui.scrollToFirstError();
  }

  async reload(): Promise<void> {
    const confirmed = await this.ui.confirm({
      title: 'Recharger la consultation ?',
      message: 'Vos modifications non enregistrées seront perdues.',
      confirmLabel: 'Recharger',
      destructive: true,
    });
    if (confirmed) await this.session.loadClinical();
  }

  async refreshStatus(): Promise<void> {
    await this.session.loadConsultation();
  }

  retryLoad(): void {
    void this.start();
  }

  canDeactivate(): boolean | Promise<boolean> {
    if (this.session.consultation()?.status !== 'IN_PROGRESS' || !this.session.hasUnsavedChanges()) return true;
    void this.session.flushAll();
    return this.ui.confirm({
      title: 'Quitter la consultation ?',
      message: 'Des modifications ne sont pas encore enregistrées. Elles seront perdues si vous quittez maintenant.',
      confirmLabel: 'Quitter',
      destructive: true,
    });
  }

  onBeforeUnload(event: BeforeUnloadEvent): void {
    if (this.session.consultation()?.status !== 'IN_PROGRESS' || !this.session.hasUnsavedChanges()) return;
    void this.session.flushAll();
    event.preventDefault();
    event.returnValue = '';
  }
}
