import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormsModule, ReactiveFormsModule } from '@angular/forms';
import {
  EMPTY,
  Observable,
  Subject,
  catchError,
  concat,
  debounceTime,
  exhaustMap,
  interval,
  map,
  of,
  switchMap,
  take,
  takeWhile,
} from 'rxjs';

import {
  isAmbiguousMutationOutcome,
  normalizeHttpError,
} from '../../../core/http/app-http-error';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';

import {
  OcAvatar,
  OcButton,
  OcDateField,
  OcIcon,
  OcPatientChip,
  OcSheet,
} from '../../../shared/ui';
import { PracticePatientForm } from '../patients/practice-patient-form';
import type {
  PageDto,
  PracticePatientAppointmentDto,
  PracticePatientDto,
} from '../practice-patient-api.models';
import { PracticePatientApiService } from '../practice-patient-api.service';
import type { AvailabilitySlot } from '../scheduled-care/scheduled-care.models';
import type { PracticeLocationResponse } from '../settings/practice-location-api.models';
import { PracticeLocationApiService } from '../settings/practice-location-api.service';
import { ActiveConsultationApiService } from '../active-consultation-api.service';
import type { ConsultationFollowUpOutcome } from '../active-consultation.models';

/** Patients shown when the search is empty. */
const RECENT_PATIENTS_LIMIT = 5;
/** Server-capped search result count. */
const PATIENT_SEARCH_LIMIT = 20;
const PATIENT_SEARCH_MIN_LENGTH = 2;
const AVAILABILITY_HORIZON_DAYS = 21;
/**
 * G-1 D4: follow-ups reach further (« contrôle dans 6 semaines »). The server bounds it with its
 * own setting (default 90 days) and clamps the request, so a lower server value only leaves
 * the last days without slots.
 */
export const FOLLOW_UP_HORIZON_DAYS = 90;
const SCHEDULING_TIMEZONE = 'Africa/Tunis';
const READINESS_FAST_POLL_MS = 1_500;
const READINESS_FAST_WINDOW_MS = 20_000;
const READINESS_SLOW_POLL_MS = 10_000;

/** What the doctor needs to know about the MRS record; it never gates booking. */
export type MedicalRecordState = 'PREPARING' | 'READY' | 'FAILED';

type BookingDateChoice = 'today' | 'tomorrow' | 'other';

interface SearchRequest {
  readonly generation: number;
  readonly query: string | null;
}

export type PatientListMode = 'recent' | 'results';

interface CalendarPreselection {
  readonly start: string | null;
  readonly practiceLocationId: string | null;
}

interface SearchResult {
  readonly request: SearchRequest;
  readonly page: PageDto<PracticePatientDto> | null;
}

interface PendingBookingCommand {
  readonly fingerprint: string;
  readonly idempotencyKey: string;
}

/**
 * G-1 D4: the drawer as the consultation's follow-up slot picker. The patient is the
 * consultation's (fixed); slots come from the consultation's follow-up availability.
 * `choose`: « Contrôle à une date » (hands the slot back, nothing is booked);
 * `book`: rebooking after SLOT_TAKEN (books it with the same rules as « Terminer »).
 */
export interface FollowUpBookingContext {
  readonly consultationId: string;
  readonly patientName: string;
  readonly mode: 'choose' | 'book';
}

export interface FollowUpSlotChoice {
  readonly start: string;
  readonly end: string;
  readonly practiceLocationId: string;
  readonly locationName: string;
}

interface PendingMrsCommand {
  readonly patientId: string;
  readonly idempotencyKey: string;
}

@Component({
  selector: 'app-quick-booking-drawer',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzRadioModule,
    NzSkeletonModule,
    OcAvatar,
    OcButton,
    OcDateField,
    OcIcon,
    OcPatientChip,
    OcSheet,
    PracticePatientForm,
  ],
  templateUrl: './quick-booking-drawer.html',
  styleUrl: './quick-booking-drawer.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class QuickBookingDrawer {
  private readonly patientsApi = inject(PracticePatientApiService);
  private readonly locationsApi = inject(PracticeLocationApiService);
  private readonly consultationsApi = inject(ActiveConsultationApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private preselection: CalendarPreselection = { start: null, practiceLocationId: null };
  /** Jump to the first day with free slots on the next load (not on refresh). */
  private autoSelectFirstDay = true;
  private readonly searchRequests = new Subject<SearchRequest>();
  private readonly readinessPolls = new Subject<string | null>();
  private polledPatientId: string | null = null;
  private openGeneration = 0;
  private slotsGeneration = 0;
  private wasOpen = false;
  private pendingBookingCommand: PendingBookingCommand | null = null;
  private pendingMrsCommand: PendingMrsCommand | null = null;

  readonly open = input(false);
  /** Opening from a calendar slot: that slot is preselected once availability loads. */
  readonly preselectedStart = input<string | null>(null);
  readonly preselectedPracticeLocationId = input<string | null>(null);
  /** Practice patient to select when the drawer opens (patient chart « Planifier »). */
  readonly preselectedPatientId = input<string | null>(null);
  /** G-1 D4: follow-up mode (consultation slot picker or SLOT_TAKEN rebooking). */
  readonly followUp = input<FollowUpBookingContext | null>(null);
  readonly openChange = output<boolean>();
  readonly appointmentCreated = output<PracticePatientAppointmentDto>();
  readonly followUpSlotChosen = output<FollowUpSlotChoice>();
  readonly followUpBooked = output<ConsultationFollowUpOutcome>();

  readonly searchControl = new FormControl('', { nonNullable: true });
  readonly patients = signal<readonly PracticePatientDto[]>([]);
  readonly selectedPatient = signal<PracticePatientDto | null>(null);
  readonly patientPickerExpanded = signal(true);
  readonly patientSearchLoading = signal(false);
  readonly patientSearchError = signal<string | null>(null);
  readonly patientListMode = signal<PatientListMode>('recent');
  readonly searchedText = signal('');
  readonly patientFormOpen = signal(false);
  readonly patientFormPrefill = signal('');
  readonly patientRefreshing = signal(false);
  readonly mrsActionPending = signal(false);

  readonly locations = signal<readonly PracticeLocationResponse[]>([]);
  readonly selectedLocationId = signal('');
  readonly locationsLoading = signal(false);
  readonly locationsError = signal<string | null>(null);

  readonly dateChoice = signal<BookingDateChoice>('today');
  readonly todayDate = signal(todayDateKey());
  readonly tomorrowDate = signal(addDays(todayDateKey(), 1));
  readonly selectedDate = signal(todayDateKey());
  readonly otherDate = signal(addDays(todayDateKey(), 2));
  readonly maximumDate = signal(addDays(todayDateKey(), AVAILABILITY_HORIZON_DAYS - 1));
  /** Every free slot of the availability horizon for the selected patient and cabinet. */
  readonly horizonSlots = signal<readonly AvailabilitySlot[]>([]);
  readonly slots = computed(() =>
    this.horizonSlots().filter(
      (slot) => instantDateKey(slot.start, this.timezone()) === this.selectedDate(),
    ),
  );
  readonly selectedSlotKey = signal('');
  readonly slotsLoading = signal(false);
  readonly slotsError = signal<string | null>(null);
  readonly slotSelectionNotice = signal<string | null>(null);
  readonly availabilityValidatedForBooking = signal(false);
  readonly timezone = signal(SCHEDULING_TIMEZONE);

  readonly submitting = signal(false);
  readonly outcomeUnknown = signal(false);
  readonly bookingError = signal<string | null>(null);

  /** A patient is known: the selected practice patient, or the consultation's in follow-up mode. */
  readonly hasSubject = computed(() => this.followUp() !== null || this.selectedPatient() !== null);
  readonly subjectName = computed(() => {
    const context = this.followUp();
    if (context) return context.patientName;
    const patient = this.selectedPatient();
    return patient === null ? '' : this.patientName(patient);
  });
  readonly sheetTitle = computed(() => {
    const context = this.followUp();
    if (!context) return 'Nouveau rendez-vous';
    return context.mode === 'choose' ? 'Créneau du contrôle' : 'Rendez-vous de contrôle';
  });
  readonly sheetDescription = computed(() => {
    const context = this.followUp();
    if (!context) return 'Planifiez un créneau confirmé sans quitter le calendrier.';
    return context.mode === 'choose'
      ? 'Choisissez le créneau du contrôle : il sera réservé à la fin de la consultation.'
      : 'Le créneau choisi n’était plus libre. Choisissez-en un autre.';
  });

  readonly singleLocation = computed(() =>
    this.locations().length === 1 ? (this.locations()[0] ?? null) : null,
  );
  readonly selectedLocation = computed(
    () =>
      this.locations().find((location) => location.id === this.selectedLocationId()) ?? null,
  );
  readonly selectedSlot = computed(
    () => this.slots().find((slot) => slotKey(slot) === this.selectedSlotKey()) ?? null,
  );
  readonly selectedPatientReady = computed(() => isPatientReady(this.selectedPatient()));
  readonly selectedPatientRecordState = computed((): MedicalRecordState | null => {
    const patient = this.selectedPatient();
    return patient === null ? null : medicalRecordState(patient);
  });
  // An appointment is a scheduling fact: MRS readiness is enforced at consultation start.
  readonly canSubmit = computed(
    () =>
      this.hasSubject() &&
      this.selectedLocation() !== null &&
      this.selectedSlot() !== null &&
      this.availabilityValidatedForBooking() &&
      !this.slotsLoading() &&
      !this.locationsLoading(),
  );
  readonly footerActionLabel = computed(() => {
    if (this.outcomeUnknown()) return 'Vérifier le résultat';
    const context = this.followUp();
    if (context?.mode === 'choose') return 'Choisir ce créneau';
    if (context?.mode === 'book') return 'Planifier le contrôle';
    return 'Confirmer le rendez-vous';
  });
  /** Visible reason shown next to the primary action whenever it is disabled. */
  readonly submitBlockedReason = computed((): string | null => {
    if (this.submitting() || this.canSubmit()) return null;
    if (!this.hasSubject()) return 'Sélectionnez un patient pour continuer.';
    if (this.locationsLoading()) return 'Chargement de vos cabinets…';
    if (this.selectedLocation() === null) return 'Sélectionnez un cabinet actif.';
    if (this.slotsLoading()) return 'Chargement des créneaux disponibles…';
    if (this.slotsError() !== null) {
      return 'Les créneaux n’ont pas pu être chargés. Actualisez les disponibilités.';
    }
    if (this.selectedSlot() === null) return 'Choisissez un créneau pour confirmer.';
    return 'Les disponibilités doivent être actualisées avant de confirmer.';
  });

  constructor() {
    this.searchRequests
      .pipe(
        debounceTime(250),
        switchMap((request) => {
          if (request.query === null) return EMPTY;
          this.patientSearchLoading.set(true);
          this.patientSearchError.set(null);
          const searching = request.query.length >= PATIENT_SEARCH_MIN_LENGTH;
          return this.patientsApi
            .listPatients(
              searching
                ? { query: request.query, filter: 'ALL', limit: PATIENT_SEARCH_LIMIT }
                : { filter: 'ALL', limit: RECENT_PATIENTS_LIMIT },
            )
            .pipe(
              map((page): SearchResult => ({ request, page })),
              catchError(() => of<SearchResult>({ request, page: null })),
            );
        }),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(({ request, page }) => {
        if (!this.open() || request.generation !== this.openGeneration) return;
        this.patientSearchLoading.set(false);
        if (page === null) {
          this.patients.set([]);
          this.patientSearchError.set('La recherche de patients est indisponible. Réessayez.');
          return;
        }
        const searching = (request.query ?? '').length >= PATIENT_SEARCH_MIN_LENGTH;
        this.patientListMode.set(searching ? 'results' : 'recent');
        this.searchedText.set(searching ? (request.query ?? '') : '');
        this.patients.set(page.content);
      });

    this.searchControl.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((query) => this.queuePatientSearch(query));

    this.readinessPolls
      .pipe(
        switchMap((patientId) => (patientId === null ? EMPTY : this.readinessPoll(patientId))),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((patient) => this.applyPolledPatient(patient));

    effect(() => {
      const open = this.open();
      if (open && !this.wasOpen) this.initializeDraft();
      if (!open && this.wasOpen) this.cancelInFlightReads();
      this.wasOpen = open;
    });
  }

  dismiss(): void {
    if (this.submitting() || this.outcomeUnknown()) return;
    // Esc first collapses the inline patient form, then closes the drawer.
    if (this.patientFormOpen()) {
      this.closePatientForm();
      return;
    }
    this.openChange.emit(false);
  }

  /** Enter in the search box selects the first listed patient. */
  selectFirstResult(event: Event): void {
    event.preventDefault();
    const first = this.patients()[0];
    if (!this.patientSearchLoading() && first) this.selectPatient(first);
  }

  openPatientCreation(): void {
    if (this.submitting() || this.outcomeUnknown()) return;
    this.patientFormPrefill.set(this.searchControl.value.trim());
    this.patientFormOpen.set(true);
  }

  closePatientForm(): void {
    this.patientFormOpen.set(false);
    afterNextRender(() => document.getElementById('quick-booking-search')?.focus(), {
      injector: this.injector,
    });
  }

  selectPatient(patient: PracticePatientDto): void {
    if (this.submitting() || this.outcomeUnknown()) return;
    this.selectedPatient.set(patient);
    this.patientPickerExpanded.set(false);
    this.pendingMrsCommand = null;
    this.autoSelectFirstDay = true;
    this.resetBookingIntent();
    this.syncReadinessPolling(patient);
    this.loadSlots();
  }

  onPatientCreated(patient: PracticePatientDto): void {
    this.patientFormOpen.set(false);
    this.patients.update((patients) => [patient, ...patients.filter(({ id }) => id !== patient.id)]);
    this.selectPatient(patient);
    this.focusSlotStep();
  }

  changePatient(): void {
    if (this.submitting() || this.outcomeUnknown()) return;
    this.patientPickerExpanded.set(true);
    afterNextRender(() => document.getElementById('quick-booking-search')?.focus(), {
      injector: this.injector,
    });
  }

  selectDuplicate(patientId: string): void {
    this.patientFormOpen.set(false);
    this.autoSelectFirstDay = true;
    this.loadPatient(patientId);
    this.focusSlotStep();
  }

  refreshSelectedPatient(): void {
    const patient = this.selectedPatient();
    if (patient === null || this.patientRefreshing() || this.mrsActionPending()) return;
    this.loadPatient(patient.id);
  }

  retryMrsProvisioning(): void {
    const patient = this.selectedPatient();
    if (patient === null || this.mrsActionPending() || this.patientRefreshing()) return;
    if (this.pendingMrsCommand?.patientId !== patient.id) {
      this.pendingMrsCommand = { patientId: patient.id, idempotencyKey: newIdempotencyKey() };
    }
    const command = this.pendingMrsCommand;
    const generation = this.openGeneration;
    this.mrsActionPending.set(true);
    this.bookingError.set(null);
    this.patientsApi
      .reconcileMrsPatient(patient.id, command.idempotencyKey)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (generation !== this.openGeneration) return;
          // A completed reconciliation receipt is idempotent. A later explicit
          // retry is a new redrive intent and therefore needs a fresh key.
          this.pendingMrsCommand = null;
          this.mrsActionPending.set(false);
          // Readiness only: the doctor's cabinet and slot choice stay untouched.
          this.loadPatient(patient.id, false);
        },
        error: () => {
          if (generation !== this.openGeneration) return;
          this.mrsActionPending.set(false);
          this.bookingError.set(
            'La préparation du dossier n’a pas pu être relancée. Vous pouvez réessayer sans perdre ce brouillon.',
          );
        },
      });
  }

  selectLocation(locationId: string): void {
    if (
      this.submitting() ||
      this.outcomeUnknown() ||
      this.locationsLoading() ||
      !this.locations().some(({ id }) => id === locationId)
    ) {
      return;
    }
    this.selectedLocationId.set(locationId);
    this.autoSelectFirstDay = true;
    this.resetBookingIntent();
    this.loadSlots();
  }

  selectDateChoice(choice: BookingDateChoice): void {
    if (this.submitting() || this.outcomeUnknown()) return;
    this.autoSelectFirstDay = false;
    this.dateChoice.set(choice);
    const date =
      choice === 'today'
        ? todayDateKey()
        : choice === 'tomorrow'
          ? addDays(todayDateKey(), 1)
          : this.otherDate();
    this.changeDate(date);
  }

  setOtherDate(date: string | null): void {
    if (
      date === null ||
      this.submitting() ||
      this.outcomeUnknown() ||
      !isAllowedDate(date, this.maximumDate())
    ) {
      return;
    }
    this.autoSelectFirstDay = false;
    this.otherDate.set(date);
    this.dateChoice.set('other');
    this.changeDate(date);
  }

  selectSlot(key: string): void {
    if (
      this.submitting() ||
      this.outcomeUnknown() ||
      !this.horizonSlots().some((slot) => slotKey(slot) === key)
    ) {
      return;
    }
    this.selectedSlotKey.set(key);
    this.pendingBookingCommand = null;
    this.bookingError.set(null);
    this.slotSelectionNotice.set(null);
  }

  refreshSlots(): void {
    if (this.submitting() || this.outcomeUnknown()) return;
    this.loadSlots();
  }

  submit(): void {
    const context = this.followUp();
    if (context) {
      this.submitFollowUp(context);
      return;
    }
    const patient = this.selectedPatient();
    const location = this.selectedLocation();
    const slot = this.selectedSlot();
    if (
      patient === null ||
      location === null ||
      slot === null ||
      !this.availabilityValidatedForBooking() ||
      this.submitting()
    ) {
      return;
    }

    const fingerprint = `${patient.id}|${location.id}|${slot.start}|${slot.end}`;
    if (this.pendingBookingCommand?.fingerprint !== fingerprint) {
      if (this.outcomeUnknown()) return;
      this.pendingBookingCommand = {
        fingerprint,
        idempotencyKey: newIdempotencyKey(),
      };
    }
    const command = this.pendingBookingCommand;
    const generation = this.openGeneration;
    this.submitting.set(true);
    this.bookingError.set(null);
    this.patientsApi
      .createAppointment(
        patient.id,
        {
          practiceLocationId: location.id,
          startTime: slot.start,
          endTime: slot.end,
        },
        command.idempotencyKey,
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appointment) => {
          if (generation !== this.openGeneration) return;
          this.submitting.set(false);
          if (!isConfirmedAppointment(appointment, patient.id, slot)) {
            this.outcomeUnknown.set(true);
            this.bookingError.set(
              'La confirmation reçue est incompatible. Vérifiez le résultat avec la même commande.',
            );
            return;
          }
          this.outcomeUnknown.set(false);
          this.pendingBookingCommand = null;
          this.appointmentCreated.emit(appointment);
        },
        error: (failure: unknown) => {
          if (generation !== this.openGeneration) return;
          const error = normalizeHttpError(failure);
          const ambiguous = isAmbiguousMutationOutcome(failure);
          this.submitting.set(false);
          this.outcomeUnknown.set(ambiguous);
          if (ambiguous) {
            this.bookingError.set(
              'La réponse a été interrompue. Vérifiez le résultat : la même commande sera rejouée sans créer de doublon.',
            );
            return;
          }
          if (error.status === 409) {
            if (isDefinitiveSlotConflict(error.message)) {
              this.pendingBookingCommand = null;
              this.selectedSlotKey.set('');
              this.bookingError.set(
                'Ce créneau vient de changer. Les disponibilités ont été actualisées.',
              );
              this.loadSlots(false);
              return;
            }
            this.outcomeUnknown.set(true);
            this.bookingError.set(
              'La commande est encore en cours de vérification. Réutilisez la même commande avant de choisir un autre créneau.',
            );
            return;
          }
          if (error.status === 403 || error.status === 404) {
            this.pendingBookingCommand = null;
            this.bookingError.set('Ce patient ou ce cabinet n’est plus disponible pour la réservation.');
            return;
          }
          this.bookingError.set('Le rendez-vous n’a pas été créé. Réessayez dans un instant.');
        },
      });
  }

  private submitFollowUp(context: FollowUpBookingContext): void {
    const location = this.selectedLocation();
    const slot = this.selectedSlot();
    if (location === null || slot === null || !this.availabilityValidatedForBooking() || this.submitting()) return;
    const choice: FollowUpSlotChoice = {
      start: slot.start,
      end: slot.end,
      practiceLocationId: location.id,
      locationName: location.name,
    };
    if (context.mode === 'choose') {
      this.followUpSlotChosen.emit(choice);
      return;
    }
    const fingerprint = `${context.consultationId}|${location.id}|${slot.start}|${slot.end}`;
    if (this.pendingBookingCommand?.fingerprint !== fingerprint) {
      if (this.outcomeUnknown()) return;
      this.pendingBookingCommand = { fingerprint, idempotencyKey: newIdempotencyKey() };
    }
    const command = this.pendingBookingCommand;
    const generation = this.openGeneration;
    this.submitting.set(true);
    this.bookingError.set(null);
    this.consultationsApi
      .rebookFollowUp(context.consultationId,
        { start: choice.start, end: choice.end, practiceLocationId: choice.practiceLocationId },
        `follow-up:${command.idempotencyKey}`)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (outcome) => {
          if (generation !== this.openGeneration) return;
          this.submitting.set(false);
          this.outcomeUnknown.set(false);
          this.pendingBookingCommand = null;
          this.followUpBooked.emit(outcome);
        },
        error: (failure: unknown) => {
          if (generation !== this.openGeneration) return;
          const error = normalizeHttpError(failure);
          const ambiguous = isAmbiguousMutationOutcome(failure);
          this.submitting.set(false);
          this.outcomeUnknown.set(ambiguous);
          if (ambiguous) {
            this.bookingError.set(
              'La réponse a été interrompue. Vérifiez le résultat : la même commande sera rejouée sans créer de doublon.',
            );
            return;
          }
          this.pendingBookingCommand = null;
          const code = followUpErrorCode(failure);
          if (code === 'FOLLOW_UP_SLOT_UNAVAILABLE') {
            this.selectedSlotKey.set('');
            this.bookingError.set('Ce créneau vient de changer. Les disponibilités ont été actualisées.');
            this.loadSlots(false);
            return;
          }
          if (error.status === 400) {
            this.bookingError.set('Ce créneau ne peut pas être choisi pour le contrôle. Choisissez-en un autre.');
            return;
          }
          if (code === 'FOLLOW_UP_ALREADY_SCHEDULED') {
            this.bookingError.set('Le rendez-vous de contrôle est déjà planifié.');
            return;
          }
          if (error.status === 409 || error.status === 404 || error.status === 403) {
            this.bookingError.set('Ce rendez-vous de contrôle ne peut plus être planifié depuis cette consultation.');
            return;
          }
          this.bookingError.set('Le rendez-vous n’a pas été créé. Réessayez dans un instant.');
        },
      });
  }

  patientName(patient: PracticePatientDto): string {
    return `${patient.firstName} ${patient.lastName}`.trim();
  }

  patientDescription(patient: PracticePatientDto): string {
    const identity = patient.phone ?? patient.practiceIdentifier ?? 'Dossier de pratique';
    return patient.linkedOmniCareUserId === null ? identity : `${identity} · Lié à OmniCare`;
  }

  /** Badge shown only when the medical record is not ready; `null` when ready. */
  readinessLabel(patient: PracticePatientDto): string | null {
    switch (medicalRecordState(patient)) {
      case 'READY':
        return null;
      case 'FAILED':
        return 'Échec — Réessayer';
      case 'PREPARING':
        return 'En préparation';
    }
  }

  patientListTitle(): string {
    return this.patientListMode() === 'recent' ? 'Patients récents' : 'Résultats';
  }

  dateLabel(date: string): string {
    return formatDateKey(date, { day: 'numeric', month: 'long' });
  }

  selectedDateLongLabel(): string {
    return formatDateKey(this.selectedDate(), {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    });
  }

  slotTime(slot: AvailabilitySlot): string {
    return formatInstant(slot.start, this.timezone(), { hour: '2-digit', minute: '2-digit' });
  }

  slotEndTime(slot: AvailabilitySlot): string {
    return formatInstant(slot.end, this.timezone(), { hour: '2-digit', minute: '2-digit' });
  }

  private initializeDraft(): void {
    this.openGeneration += 1;
    this.slotsGeneration += 1;
    this.searchControl.setValue('', { emitEvent: false });
    this.patients.set([]);
    this.selectedPatient.set(null);
    this.patientPickerExpanded.set(true);
    this.patientSearchError.set(null);
    this.patientSearchLoading.set(false);
    this.patientFormOpen.set(false);
    this.patientFormPrefill.set('');
    this.patientListMode.set('recent');
    this.searchedText.set('');
    this.patientRefreshing.set(false);
    this.mrsActionPending.set(false);
    this.locations.set([]);
    this.selectedLocationId.set('');
    this.locationsError.set(null);
    this.locationsLoading.set(false);
    const today = todayDateKey();
    this.todayDate.set(today);
    this.tomorrowDate.set(addDays(today, 1));
    this.dateChoice.set('today');
    this.selectedDate.set(today);
    this.otherDate.set(addDays(today, 2));
    this.maximumDate.set(addDays(today, (this.followUp() ? FOLLOW_UP_HORIZON_DAYS : AVAILABILITY_HORIZON_DAYS) - 1));
    this.horizonSlots.set([]);
    this.autoSelectFirstDay = true;
    this.preselection = {
      start: this.preselectedStart(),
      practiceLocationId: this.preselectedPracticeLocationId(),
    };
    if (this.preselection.start) {
      const date = instantDateKey(this.preselection.start, SCHEDULING_TIMEZONE);
      if (isAllowedDate(date, this.maximumDate())) this.applyDate(date);
    }
    this.selectedSlotKey.set('');
    this.slotsLoading.set(false);
    this.slotsError.set(null);
    this.slotSelectionNotice.set(null);
    this.availabilityValidatedForBooking.set(false);
    this.timezone.set(SCHEDULING_TIMEZONE);
    this.submitting.set(false);
    this.outcomeUnknown.set(false);
    this.bookingError.set(null);
    this.pendingBookingCommand = null;
    this.pendingMrsCommand = null;
    this.stopReadinessPolling();
    this.loadLocations();
    if (this.followUp()) {
      this.patientPickerExpanded.set(false);
      return;
    }
    this.queuePatientSearch('');
    const preselectedPatientId = this.preselectedPatientId();
    if (preselectedPatientId) this.loadPatient(preselectedPatientId);
  }

  private cancelInFlightReads(): void {
    this.openGeneration += 1;
    this.slotsGeneration += 1;
    this.searchRequests.next({ generation: this.openGeneration, query: null });
    this.stopReadinessPolling();
  }

  /**
   * Polls the patient's MRS readiness: every 1.5 s for 20 s, then every 10 s in the
   * background, until READY or FAILED. Restarted per selected patient; stopped when the
   * drawer closes or another patient is selected.
   */
  private readinessPoll(patientId: string): Observable<PracticePatientDto> {
    const fastTicks = Math.floor(READINESS_FAST_WINDOW_MS / READINESS_FAST_POLL_MS);
    return concat(
      interval(READINESS_FAST_POLL_MS).pipe(take(fastTicks)),
      interval(READINESS_SLOW_POLL_MS),
    ).pipe(
      exhaustMap(() => this.patientsApi.getPatient(patientId).pipe(catchError(() => EMPTY))),
      takeWhile((patient) => medicalRecordState(patient) === 'PREPARING', true),
    );
  }

  private syncReadinessPolling(patient: PracticePatientDto | null): void {
    const shouldPoll =
      patient !== null && this.open() && medicalRecordState(patient) === 'PREPARING';
    const target = shouldPoll ? patient.id : null;
    if (target === this.polledPatientId) return;
    this.polledPatientId = target;
    this.readinessPolls.next(target);
  }

  private stopReadinessPolling(): void {
    this.polledPatientId = null;
    this.readinessPolls.next(null);
  }

  private applyPolledPatient(patient: PracticePatientDto): void {
    if (medicalRecordState(patient) !== 'PREPARING' && this.polledPatientId === patient.id) {
      this.polledPatientId = null;
    }
    if (!this.open() || this.selectedPatient()?.id !== patient.id) return;
    // Readiness never invalidates the booking draft: cabinet, date and slot are kept.
    this.selectedPatient.set(patient);
    this.patients.update((patients) =>
      patients.map((value) => (value.id === patient.id ? patient : value)),
    );
  }

  private queuePatientSearch(query: string): void {
    if (!this.open()) return;
    this.searchRequests.next({ generation: this.openGeneration, query: query.trim() });
  }

  private loadLocations(): void {
    const generation = this.openGeneration;
    this.locationsLoading.set(true);
    this.locationsError.set(null);
    this.locationsApi
      .list()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (locations) => {
          if (generation !== this.openGeneration) return;
          const activeLocations = locations.filter(({ active }) => active);
          this.locations.set(activeLocations);
          this.locationsLoading.set(false);
          const initial =
            activeLocations.find(({ id }) => id === this.preselection.practiceLocationId) ??
            activeLocations.find(({ primary }) => primary) ??
            activeLocations[0];
          if (initial) {
            this.selectedLocationId.set(initial.id);
            if (this.hasSubject()) this.loadSlots();
          } else {
            this.locationsError.set('Aucun cabinet actif n’est disponible.');
          }
        },
        error: () => {
          if (generation !== this.openGeneration) return;
          this.locationsLoading.set(false);
          this.locationsError.set('Impossible de charger vos cabinets actifs.');
        },
      });
  }

  private loadPatient(patientId: string, reloadSlots = true): void {
    const generation = this.openGeneration;
    this.patientRefreshing.set(true);
    this.bookingError.set(null);
    this.patientsApi
      .getPatient(patientId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (patient) => {
          if (generation !== this.openGeneration) return;
          this.patientRefreshing.set(false);
          this.selectedPatient.set(patient);
          this.patientPickerExpanded.set(false);
          this.patients.update((patients) => [
            patient,
            ...patients.filter(({ id }) => id !== patient.id),
          ]);
          this.syncReadinessPolling(patient);
          if (reloadSlots && this.selectedLocationId()) this.loadSlots();
        },
        error: () => {
          if (generation !== this.openGeneration) return;
          this.patientRefreshing.set(false);
          this.bookingError.set('Le dossier patient n’a pas pu être actualisé.');
        },
      });
  }

  private changeDate(date: string): void {
    if (date === this.selectedDate()) return;
    this.selectedDate.set(date);
    // The whole horizon is loaded already: changing day only filters it.
    this.selectedSlotKey.set('');
    this.pendingBookingCommand = null;
    this.bookingError.set(null);
    this.slotSelectionNotice.set(null);
  }

  /** Sets the selected date and the matching « Aujourd'hui / Demain / Autre date » choice. */
  private applyDate(date: string): void {
    const today = todayDateKey();
    this.selectedDate.set(date);
    if (date === today) {
      this.dateChoice.set('today');
    } else if (date === addDays(today, 1)) {
      this.dateChoice.set('tomorrow');
    } else {
      this.otherDate.set(date);
      this.dateChoice.set('other');
    }
  }

  private focusSlotStep(): void {
    afterNextRender(
      () => {
        const target = document.getElementById('quick-booking-date-section');
        target?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
        target?.focus({ preventScroll: true });
      },
      { injector: this.injector },
    );
  }

  private resetBookingIntent(): void {
    this.selectedSlotKey.set('');
    this.pendingBookingCommand = null;
    this.outcomeUnknown.set(false);
    this.bookingError.set(null);
    this.slotSelectionNotice.set(null);
    this.availabilityValidatedForBooking.set(false);
  }

  private loadSlots(clearBookingError = true): void {
    const patient = this.selectedPatient();
    const context = this.followUp();
    const locationId = this.selectedLocationId();
    if ((patient === null && context === null) || !locationId) {
      this.horizonSlots.set([]);
      this.slotsLoading.set(false);
      this.availabilityValidatedForBooking.set(false);
      return;
    }
    const patientId = patient?.id ?? null;
    const range = horizonRange(this.maximumDate());
    const generation = ++this.slotsGeneration;
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    this.availabilityValidatedForBooking.set(false);
    this.horizonSlots.set([]);
    if (clearBookingError) this.bookingError.set(null);
    const availability = context
      ? this.consultationsApi.followUpAvailability(context.consultationId, locationId, range.from, range.to)
      : this.patientsApi.getAppointmentAvailability(patientId ?? '', locationId, range.from, range.to);
    availability
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (
            generation !== this.slotsGeneration ||
            (context === null && patientId !== this.selectedPatient()?.id) ||
            locationId !== this.selectedLocationId()
          ) {
            return;
          }
          const timezone = response.timezone;
          // The server bounds the requested horizon; keep its slots in order.
          const horizon = [...response.slots].sort(
            (left, right) => Date.parse(left.start) - Date.parse(right.start),
          );
          this.timezone.set(timezone);
          this.horizonSlots.set(horizon);
          const preselectedKey = this.consumePreselection(horizon, timezone);
          if (preselectedKey === null && this.autoSelectFirstDay) {
            const onSelectedDay = horizon.some(
              (slot) => instantDateKey(slot.start, timezone) === this.selectedDate(),
            );
            const first = horizon[0];
            if (!onSelectedDay && first) this.applyDate(instantDateKey(first.start, timezone));
          }
          this.autoSelectFirstDay = false;
          const selectedKey = preselectedKey ?? this.selectedSlotKey();
          if (selectedKey && !this.slots().some((slot) => slotKey(slot) === selectedKey)) {
            this.selectedSlotKey.set('');
            this.pendingBookingCommand = null;
            this.slotSelectionNotice.set(
              'Le créneau sélectionné n’est plus disponible. Choisissez une nouvelle heure.',
            );
          } else if (preselectedKey === null) {
            this.slotSelectionNotice.set(null);
          }
          this.availabilityValidatedForBooking.set(true);
          this.slotsLoading.set(false);
        },
        error: () => {
          if (generation !== this.slotsGeneration) return;
          this.slotsLoading.set(false);
          this.availabilityValidatedForBooking.set(false);
          this.slotsError.set('Impossible de charger les créneaux disponibles.');
        },
      });
  }

  /** Applies a calendar-slot preselection once; returns the selected slot key, if any. */
  private consumePreselection(
    horizon: readonly AvailabilitySlot[],
    timezone: string,
  ): string | null {
    const start = this.preselection.start;
    if (!start) return null;
    this.preselection = { start: null, practiceLocationId: null };
    const match = horizon.find((slot) => sameInstant(slot.start, start));
    this.applyDate(instantDateKey(start, timezone));
    if (!match) {
      this.slotSelectionNotice.set(
        'Le créneau choisi dans le calendrier n’est plus disponible. Choisissez une autre heure.',
      );
      return null;
    }
    const key = slotKey(match);
    this.selectedSlotKey.set(key);
    return key;
  }
}

function isPatientReady(patient: PracticePatientDto | null): boolean {
  return (
    patient !== null &&
    patient.mrsReadiness === 'READY' &&
    patient.mrsProvisioned &&
    patient.mrsPatientId !== null
  );
}

function medicalRecordState(patient: PracticePatientDto): MedicalRecordState {
  if (isPatientReady(patient)) return 'READY';
  return patient.mrsReadiness === 'ACTION_REQUIRED' ? 'FAILED' : 'PREPARING';
}

function isConfirmedAppointment(
  appointment: PracticePatientAppointmentDto,
  patientId: string,
  slot: AvailabilitySlot,
): boolean {
  return (
    typeof appointment.id === 'string' &&
    appointment.id.length > 0 &&
    appointment.source === 'PRACTICE_PATIENT' &&
    appointment.subjectType === 'PRACTICE_PATIENT' &&
    appointment.practicePatientId === patientId &&
    appointment.status === 'CONFIRMED' &&
    sameInstant(appointment.startTime, slot.start) &&
    sameInstant(appointment.endTime, slot.end)
  );
}

function sameInstant(left: string, right: string): boolean {
  const leftTime = Date.parse(left);
  const rightTime = Date.parse(right);
  return !Number.isNaN(leftTime) && leftTime === rightTime;
}

/** Machine code of a follow-up command failure (`code` or `errorCode` in the problem body). */
function followUpErrorCode(failure: unknown): string | null {
  const body = (failure as { error?: unknown } | null)?.error;
  if (!body || typeof body !== 'object') return null;
  const record = body as Record<string, unknown>;
  const code = record['errorCode'] ?? record['code'];
  return typeof code === 'string' ? code : null;
}

function isDefinitiveSlotConflict(message: string): boolean {
  return message.trim().toLowerCase() === 'the requested time is no longer available';
}

function slotKey(slot: AvailabilitySlot): string {
  return `${slot.start}|${slot.end}`;
}

function newIdempotencyKey(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function todayDateKey(): string {
  return instantDateKey(new Date().toISOString(), SCHEDULING_TIMEZONE);
}

function addDays(date: string, days: number): string {
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

function isAllowedDate(date: string, maximumDate: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(date) && date >= todayDateKey() && date <= maximumDate;
}

/** Availability horizon: today (broad UTC margin) through the last bookable day. */
function horizonRange(maximumDate: string): { readonly from: string; readonly to: string } {
  return {
    from: `${addDays(todayDateKey(), -1)}T12:00:00.000Z`,
    to: `${addDays(maximumDate, 1)}T12:00:00.000Z`,
  };
}

function instantDateKey(instant: string, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date(instant));
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${value['year']}-${value['month']}-${value['day']}`;
}

function formatDateKey(date: string, options: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat('fr-TN', {
    timeZone: 'UTC',
    ...options,
  }).format(new Date(`${date}T12:00:00Z`));
}

function formatInstant(
  instant: string,
  timezone: string,
  options: Intl.DateTimeFormatOptions,
): string {
  return new Intl.DateTimeFormat('fr-TN', {
    timeZone: timezone,
    hour12: false,
    ...options,
  }).format(new Date(instant));
}
