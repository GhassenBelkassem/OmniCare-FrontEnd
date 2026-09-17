import { HttpErrorResponse } from '@angular/common/http';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { interval } from 'rxjs';

import { ApiErrorBody } from '../../core/auth/auth.models';
import { AuthTokenStore } from '../../core/auth/auth-token.store';
import { OcButton, OcSidebar, SidebarNavigationItem, SidebarUserProfile } from '../../shared/ui';
import {
  AcceptedOfferSummaryDto,
  AppointmentDto,
  BodyPartDto,
  DoctorDirectoryDto,
  PatientProfileDto,
  SlotDto,
  UrgentOfferDto,
  UrgentRequestCreateResponseDto,
  UrgentRequestDto,
} from './patient-api.models';
import { PatientApiService } from './patient-api.service';
import { RealtimeService } from '../../core/realtime/realtime.service';

type PatientTab = 'home' | 'doctors' | 'appointments' | 'urgent' | 'profile';
type DoctorMode = 'directory' | 'urgent';
type AppointmentPeriod = 'upcoming' | 'past' | 'all';
type AppointmentTone = 'urgent' | 'cancelled' | 'done' | 'in-progress' | 'booked';
type AppointmentBadge = 'urgent' | 'cabinet' | 'muted';
type AppointmentViewStatus =
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'CANCELLED'
  | 'COMPLETED'
  | 'NO_SHOW';
type UrgentPreference = 'HOME_VISIT' | 'CABINET_VISIT' | 'EITHER';
type DraftField = 'firstName' | 'lastName' | 'dateOfBirth' | 'gender' | 'preferredLanguage';
type DraftFlag = 'notificationMedications' | 'notificationAppointments' | 'notificationPassport';

interface PatientDoctor {
  readonly id: string;
  readonly name: string;
  readonly specialty: string | null;
  readonly distanceKm: number | null;
  readonly availableForUrgent: boolean;
}

interface PatientAppointment {
  readonly id: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly date: string;
  readonly timeLabel: string;
  readonly status: AppointmentViewStatus;
  readonly source: string;
  readonly notes: string;
  readonly quotedPriceTnd: number | null;
}

interface PatientUrgentOffer {
  readonly offerId: string;
  readonly doctorId: string;
  readonly doctorName: string;
  readonly status: string;
}

interface PatientUrgentRequest {
  readonly id: string;
  readonly status: string;
  readonly visitPreference: UrgentPreference | null;
  readonly notes: string | null;
  readonly offers: readonly PatientUrgentOffer[];
  readonly selectedOfferId: string | null;
}

interface ProfileDraft {
  readonly firstName: string;
  readonly lastName: string;
  readonly dateOfBirth: string;
  readonly gender: string;
  readonly preferredLanguage: string;
  readonly notificationMedications: boolean;
  readonly notificationAppointments: boolean;
  readonly notificationPassport: boolean;
}

const DEFAULT_LAT = 36.8065;
const DEFAULT_LNG = 10.1815;
const DEFAULT_RADIUS_KM = 20;
const URGENT_POLL_INTERVAL_MS = 30_000;

const BODY_PART_OPTIONS: readonly { readonly value: BodyPartDto; readonly label: string }[] = [
  { value: 'HEAD', label: 'Tete' },
  { value: 'NECK', label: 'Cou' },
  { value: 'CHEST', label: 'Poitrine' },
  { value: 'ABDOMEN', label: 'Ventre' },
  { value: 'BACK', label: 'Dos' },
  { value: 'LEFT_ARM', label: 'Bras gauche' },
  { value: 'RIGHT_ARM', label: 'Bras droit' },
  { value: 'LEFT_LEG', label: 'Jambe gauche' },
  { value: 'RIGHT_LEG', label: 'Jambe droite' },
  { value: 'FULL_BODY', label: 'Tout le corps' },
  { value: 'OTHER', label: 'Autre' },
];

@Component({
  selector: 'app-patient-page',
  imports: [FormsModule, OcButton, OcSidebar],
  templateUrl: './patient-page.html',
  styleUrl: './patient-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PatientPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(PatientApiService);
  private readonly tokens = inject(AuthTokenStore);
  private readonly realtime = inject(RealtimeService);
  private readonly destroyRef = inject(DestroyRef);

  readonly activeTab = signal<PatientTab>('home');
  readonly sidebarCollapsed = signal(false);
  readonly today = new Date();

  readonly mustChangePassword = this.tokens.user()?.mustChangePassword ?? false;
  readonly passwordChanged = signal(false);
  readonly locked = computed(() => this.mustChangePassword && !this.passwordChanged());

  readonly navigation: readonly SidebarNavigationItem[] = [
    { id: 'home', label: 'Accueil', icon: 'dashboard', route: '/patient?tab=home' },
    { id: 'doctors', label: 'Medecins', icon: 'team', route: '/patient?tab=doctors' },
    {
      id: 'appointments',
      label: 'Rendez-vous',
      icon: 'calendar',
      route: '/patient?tab=appointments',
    },
    { id: 'urgent', label: 'Urgence', icon: 'exclamation-circle', route: '/patient?tab=urgent' },
    { id: 'profile', label: 'Profil', icon: 'user', route: '/patient?tab=profile' },
  ];

  readonly doctorsLoading = signal(false);
  readonly doctorsError = signal<string | null>(null);
  readonly directoryLoading = signal(false);
  readonly directoryError = signal<string | null>(null);
  readonly appointmentsLoading = signal(false);
  readonly appointmentsError = signal<string | null>(null);
  readonly profileLoading = signal(false);
  readonly profileError = signal<string | null>(null);
  readonly slotsLoading = signal(false);
  readonly slotsError = signal<string | null>(null);
  readonly bookingSaving = signal(false);
  readonly urgentSending = signal(false);
  readonly profileSaving = signal(false);
  readonly passwordSaving = signal(false);

  readonly doctors = signal<readonly PatientDoctor[]>([]);
  readonly directoryDoctors = signal<readonly PatientDoctor[]>([]);
  readonly doctorMode = signal<DoctorMode>('directory');
  readonly appointmentDtos = signal<readonly AppointmentDto[]>([]);
  readonly profile = signal<PatientProfileDto | null>(null);
  readonly lastUrgentRequest = signal<PatientUrgentRequest | null>(null);
  private readonly doctorNames = signal<Readonly<Record<string, string>>>({});
  private previewKey = '';

  readonly sidebarProfile = computed<SidebarUserProfile>(() => {
    const profile = this.profile();
    const firstName = profile?.firstName ?? 'Patient';
    const lastName = profile?.lastName ?? '';
    const name = profile?.displayName ?? `${firstName} ${lastName}`.trim();
    return {
      initials: initialsFor(firstName, lastName),
      name: name || 'Patient OmniCare',
      context: 'Patient',
    };
  });

  readonly greeting = computed(() => this.sidebarProfile().name);
  readonly avatarInitials = computed(() => this.sidebarProfile().initials);

  readonly appointments = computed(() =>
    this.appointmentDtos().map((dto) => toPatientAppointment(dto, this.doctorNames())),
  );

  readonly doctorQuery = signal('');
  readonly doctorSpecialty = signal('');
  private readonly doctorsSource = computed(() =>
    this.doctorMode() === 'directory' ? this.directoryDoctors() : this.doctors(),
  );
  readonly specialties = computed(() =>
    [
      ...new Set(
        this.doctorsSource()
          .map((doctor) => doctor.specialty)
          .filter(isPresent),
      ),
    ].sort(),
  );
  readonly filteredDoctors = computed(() =>
    this.doctorsSource().filter((doctor) => {
      const term = this.doctorQuery().trim().toLocaleLowerCase();
      const matchesTerm =
        !term ||
        doctor.name.toLocaleLowerCase().includes(term) ||
        (doctor.specialty ?? '').toLocaleLowerCase().includes(term);
      const matchesSpecialty =
        !this.doctorSpecialty() || doctor.specialty === this.doctorSpecialty();
      return matchesTerm && matchesSpecialty;
    }),
  );

  readonly bookingDoctor = signal<PatientDoctor | null>(null);
  readonly bookingDate = signal<string>(nextSevenDays()[0]);
  readonly bookingSlot = signal<SlotDto | null>(null);
  readonly bookingNotes = signal('');
  readonly bookingMessage = signal<string | null>(null);
  readonly bookingError = signal<string | null>(null);
  readonly bookingDates = computed(() => nextSevenDays());
  readonly bookingSlots = signal<readonly SlotDto[]>([]);
  readonly visibleBookingSlots = computed(() =>
    this.bookingSlots().filter((slot) => isoDate(new Date(slot.start)) === this.bookingDate()),
  );

  readonly appointmentPeriod = signal<AppointmentPeriod>('upcoming');
  readonly filteredAppointments = computed(() => {
    const period = this.appointmentPeriod();
    const todayIso = isoDate(this.today);
    return this.appointments()
      .filter((item) => {
        if (period === 'upcoming') {
          return (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') &&
            item.date >= todayIso;
        }
        if (period === 'past') {
          const active =
            item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS';
          return !active || item.date < todayIso;
        }
        return true;
      })
      .sort((a, b) => (a.date + a.timeLabel).localeCompare(b.date + b.timeLabel));
  });

  readonly urgentLat = signal(String(DEFAULT_LAT));
  readonly urgentLng = signal(String(DEFAULT_LNG));
  readonly urgentPreference = signal<UrgentPreference>('HOME_VISIT');
  readonly urgentNotes = signal('');
  readonly urgentBodyParts = signal<readonly BodyPartDto[]>([]);
  readonly urgentPainLevel = signal<number | null>(null);
  readonly urgentSymptomsNotes = signal('');
  readonly urgentError = signal<string | null>(null);
  readonly locationDetecting = signal(false);
  readonly urgentSearchResults = signal<readonly PatientDoctor[]>([]);
  readonly urgentSearchLoading = signal(false);
  readonly urgentSearchError = signal<string | null>(null);
  readonly urgentSearched = signal(false);
  readonly acceptedOffers = signal<readonly AcceptedOfferSummaryDto[]>([]);
  readonly acceptedOffersLoading = signal(false);
  readonly acceptedOffersError = signal<string | null>(null);
  readonly offerSelectingId = signal<string | null>(null);

  readonly urgentPending = computed(
    () => this.lastUrgentRequest()?.offers.some((offer) => offer.status === 'PENDING') ?? false,
  );

  readonly urgentStatus = computed(() => {
    const request = this.lastUrgentRequest();
    if (request && this.urgentPending()) {
      return {
        title: 'Demande urgente en attente',
        message: `${request.offers.length} medecin(s) ont ete notifies de votre demande.`,
        action: 'En attente',
      };
    }
    if (request && request.status === 'PENDING' && this.acceptedOffers().length > 0) {
      return {
        title: 'Medecins disponibles',
        message: `${this.acceptedOffers().length} medecin(s) ont accepte votre demande. Choisissez-en un.`,
        action: 'A choisir',
      };
    }
    if (request && request.status === 'MATCHED') {
      return {
        title: 'Medecin choisi',
        message: 'Votre medecin a ete averti de votre choix.',
        action: 'Confirme',
      };
    }
    if (request) {
      return {
        title: 'Demande urgente terminee',
        message: 'Aucune offre en attente sur votre derniere demande.',
        action: 'Terminee',
      };
    }
    return {
      title: 'Aucune urgence en cours',
      message: "Envoyez une demande d'intervention urgente depuis le panneau Urgence.",
      action: 'Position partagee',
    };
  });

  readonly todaySubtitle = computed(() => {
    const date = new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(this.today);
    return `${capitalize(date)} - Patient a Tunis`;
  });

  readonly todayAppointments = computed(() => {
    const todayIso = isoDate(this.today);
    return this.appointments()
      .filter(
        (item) =>
          item.date === todayIso &&
          (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS'),
      )
      .sort((a, b) => a.timeLabel.localeCompare(b.timeLabel));
  });

  readonly weekDays = computed(() => {
    const todayIso = isoDate(this.today);
    return nextSevenDays().map((date) => {
      const count = this.appointments().filter(
        (item) =>
          item.date === date &&
          (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS'),
      ).length;
      const day = new Date(`${date}T00:00:00`);
      return {
        date,
        dayNumber: day.getDate(),
        label: new Intl.DateTimeFormat('fr-FR', { weekday: 'narrow' }).format(day),
        load: count === 0 ? 'none' : count >= 2 ? 'full' : 'normal',
        today: date === todayIso,
      };
    });
  });

  readonly stats = computed(() => {
    const todayIso = isoDate(this.today);
    const todayCount = this.appointments().filter(
      (item) =>
        item.date === todayIso &&
        (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS'),
    ).length;
    const upcoming = this.appointments().filter(
      (item) =>
        (item.status === 'CONFIRMED' || item.status === 'IN_PROGRESS') &&
        item.date > todayIso,
    ).length;
    const pendingUrgent =
      this.lastUrgentRequest()?.offers.filter((offer) => offer.status === 'PENDING').length ?? 0;
    return [
      { value: todayCount, label: "Rendez-vous aujourd'hui" },
      { value: upcoming, label: 'A venir' },
      { value: pendingUrgent, label: 'Urgences en cours', muted: true },
      { value: this.doctors().length, label: 'Medecins disponibles' },
    ];
  });

  readonly profileDraft = signal<ProfileDraft>({
    firstName: '',
    lastName: '',
    dateOfBirth: '',
    gender: '',
    preferredLanguage: 'fr',
    notificationMedications: true,
    notificationAppointments: true,
    notificationPassport: false,
  });
  readonly profileSaved = signal<string | null>(null);

  readonly passwordCurrent = signal('');
  readonly passwordNew = signal('');
  readonly passwordConfirm = signal('');
  readonly passwordMessage = signal<string | null>(null);
  readonly passwordError = signal<string | null>(null);

  constructor() {
    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (isPatientTab(tab)) this.activeTab.set(tab);
    });
    if (!this.locked()) {
      this.initialize();
      this.runUrgentPreview();
      // REST safety net (~2 min); WebSocket events provide responsiveness.
      interval(URGENT_POLL_INTERVAL_MS)
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.pollAvailableDoctors());
      this.realtime.appointmentEvents$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe(() => this.loadAppointments());
      this.realtime.urgentEvents$
        .pipe(takeUntilDestroyed(this.destroyRef))
        .subscribe((event) => {
          const data = event.data as { requestId?: string };
          if (data.requestId !== this.lastUrgentRequest()?.id) return;
          if (
            event.name === 'OFFER_ACCEPTED' ||
            event.name === 'REQUEST_MATCHED' ||
            event.name === 'REQUEST_EXPIRED' ||
            event.name === 'REQUEST_CANCELLED'
          ) {
            this.refreshUrgent();
          }
        });
    }
  }

  private initialize(): void {
    this.loadProfile();
    this.loadDoctors();
    this.loadDirectory();
    this.loadAppointments();
  }

  setTab(tab: PatientTab): void {
    if (this.locked()) return;
    this.activeTab.set(tab);
    if (tab === 'urgent') this.runUrgentPreview();
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
  }

  setDoctorMode(mode: DoctorMode): void {
    this.doctorMode.set(mode);
    if (mode === 'urgent') this.loadDoctors();
  }

  refreshAll(): void {
    this.loadProfile();
    this.loadDoctors();
    this.loadDirectory();
    this.loadAppointments();
  }

  loadProfile(): void {
    this.profileLoading.set(true);
    this.profileError.set(null);
    this.api
      .profile()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profile.set(profile);
          this.profileDraft.set(draftFromProfile(profile));
          this.profileLoading.set(false);
        },
        error: (error) => {
          this.profileError.set(messageFrom(error, 'Impossible de charger votre profil.'));
          this.profileLoading.set(false);
        },
      });
  }

  loadDoctors(): void {
    this.doctorsLoading.set(true);
    this.doctorsError.set(null);
    this.api
      .availableDoctors(DEFAULT_LAT, DEFAULT_LNG, DEFAULT_RADIUS_KM, 'EITHER')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dtos) => {
          const mapped = dtos.map(toPatientDoctor);
          this.updateDoctorNames(mapped);
          this.doctors.set(mapped);
          this.doctorsLoading.set(false);
        },
        error: (error) => {
          this.doctorsError.set(
            messageFrom(error, 'Impossible de charger les medecins disponibles.'),
          );
          this.doctorsLoading.set(false);
        },
      });
  }

  loadDirectory(): void {
    this.directoryLoading.set(true);
    this.directoryError.set(null);
    this.api
      .doctors()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dtos) => {
          const mapped = dtos.map(toDirectoryDoctor);
          this.updateDoctorNames(mapped);
          this.directoryDoctors.set(mapped);
          this.directoryLoading.set(false);
        },
        error: (error) => {
          this.directoryError.set(
            messageFrom(error, 'Impossible de charger l annuaire des medecins.'),
          );
          this.directoryLoading.set(false);
        },
      });
  }

  loadAppointments(): void {
    this.appointmentsLoading.set(true);
    this.appointmentsError.set(null);
    const { from, to } = appointmentsRange();
    this.api
      .appointments(from, to)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (appointments) => {
          this.appointmentDtos.set(appointments);
          this.appointmentsLoading.set(false);
        },
        error: (error) => {
          this.appointmentsError.set(messageFrom(error, 'Impossible de charger vos rendez-vous.'));
          this.appointmentsLoading.set(false);
        },
      });
  }

  updateDoctorQuery(event: Event): void {
    this.doctorQuery.set((event.target as HTMLInputElement).value);
  }

  startBooking(doctor: PatientDoctor): void {
    this.bookingDoctor.set(doctor);
    this.bookingDate.set(nextSevenDays()[0]);
    this.bookingSlot.set(null);
    this.bookingNotes.set('');
    this.bookingMessage.set(null);
    this.bookingError.set(null);
    this.loadSlots();
  }

  closeBooking(): void {
    this.bookingDoctor.set(null);
    this.bookingSlot.set(null);
    this.bookingSlots.set([]);
    this.bookingError.set(null);
  }

  selectBookingDate(date: string): void {
    this.bookingDate.set(date);
    this.bookingSlot.set(null);
    this.loadSlots();
  }

  selectBookingSlot(slot: SlotDto): void {
    this.bookingSlot.set(slot);
  }

  loadSlots(): void {
    const doctor = this.bookingDoctor();
    const date = this.bookingDate();
    if (!doctor) {
      this.bookingSlots.set([]);
      return;
    }
    this.slotsLoading.set(true);
    this.slotsError.set(null);
    const from = new Date(`${date}T00:00:00`);
    const to = addDays(from, 7);
    this.api
      .slots(doctor.id, from.toISOString(), to.toISOString())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (slots) => {
          this.bookingSlots.set(slots);
          this.slotsLoading.set(false);
        },
        error: (error) => {
          this.slotsError.set(messageFrom(error, 'Creneaux indisponibles pour ce medecin.'));
          this.slotsLoading.set(false);
        },
      });
  }

  bookAppointment(): void {
    const doctor = this.bookingDoctor();
    const slot = this.bookingSlot();
    this.bookingError.set(null);
    if (!doctor || !slot) {
      this.bookingError.set('Selectionnez un creneau avant de confirmer.');
      return;
    }
    this.bookingSaving.set(true);
    this.api
      .book({
        doctorId: doctor.id,
        startTime: slot.start,
        endTime: slot.end,
        notes: this.bookingNotes().trim() || null,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.bookingSaving.set(false);
          this.bookingMessage.set(
            `Rendez-vous confirme le ${this.shortDateLabel(this.bookingDate())} a ${formatInstantTime(slot.start)} avec ${doctor.name}.`,
          );
          this.closeBooking();
          this.appointmentPeriod.set('upcoming');
          this.loadAppointments();
          this.setTab('appointments');
        },
        error: (error) => {
          this.bookingSaving.set(false);
          this.bookingError.set(messageFrom(error, 'Reservation impossible. Reessayez.'));
        },
      });
  }

  cancelAppointment(id: string): void {
    this.api
      .cancelAppointment(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.loadAppointments(),
        error: () => this.appointmentsError.set('Annulation impossible. Reessayez.'),
      });
  }

  searchUrgentDoctors(): void {
    this.urgentSearchError.set(null);
    const latitude = Number(this.urgentLat());
    const longitude = Number(this.urgentLng());
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      this.urgentSearchError.set('Latitude invalide (entre -90 et 90).');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      this.urgentSearchError.set('Longitude invalide (entre -180 et 180).');
      return;
    }
    this.previewKey = `${latitude}|${longitude}|${this.urgentPreference()}`;
    this.urgentSearchLoading.set(true);
    this.api
      .availableDoctors(latitude, longitude, DEFAULT_RADIUS_KM, this.urgentPreference())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dtos) => {
          const mapped = dtos.map(toPatientDoctor);
          this.updateDoctorNames(mapped);
          this.urgentSearchResults.set(mapped);
          this.urgentSearched.set(true);
          this.urgentSearchLoading.set(false);
        },
        error: (error) => {
          this.urgentSearchError.set(messageFrom(error, 'Recherche impossible. Reessayez.'));
          this.urgentSearchLoading.set(false);
        },
      });
  }

  updateUrgentPreference(preference: UrgentPreference): void {
    this.urgentPreference.set(preference);
    this.previewKey = '';
    this.runUrgentPreview();
  }

  detectLocation(): void {
    if (this.locationDetecting()) return;
    this.urgentError.set(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      this.urgentError.set(
        'Geolocalisation indisponible. Saisissez les coordonnees manuellement.',
      );
      return;
    }
    this.locationDetecting.set(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        this.locationDetecting.set(false);
        this.urgentLat.set(position.coords.latitude.toFixed(6));
        this.urgentLng.set(position.coords.longitude.toFixed(6));
        this.previewKey = '';
        this.runUrgentPreview();
      },
      () => {
        this.locationDetecting.set(false);
        this.urgentError.set(
          'Impossible de detecter votre position. Saisissez les coordonnees manuellement.',
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  private runUrgentPreview(): void {
    if (this.activeTab() !== 'urgent') return;
    const key = `${this.urgentLat()}|${this.urgentLng()}|${this.urgentPreference()}`;
    if (key === this.previewKey) return;
    this.searchUrgentDoctors();
  }

  sendUrgent(): void {
    this.urgentError.set(null);
    const latitude = Number(this.urgentLat());
    const longitude = Number(this.urgentLng());
    if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) {
      this.urgentError.set('Latitude invalide (entre -90 et 90).');
      return;
    }
    if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) {
      this.urgentError.set('Longitude invalide (entre -180 et 180).');
      return;
    }
    if (!this.urgentSearched()) {
      this.urgentError.set("Recherchez d'abord les medecins disponibles pres de chez vous.");
      return;
    }
    if (this.urgentSearchResults().length === 0) {
      this.urgentError.set(
        'Aucun medecin disponible pres de chez vous. La demande ne peut pas etre envoyee.',
      );
      return;
    }
    this.urgentSending.set(true);
    const bodyParts = this.urgentBodyParts();
    const painLevel = this.urgentPainLevel();
    const symptomsNotes = this.urgentSymptomsNotes().trim();
    const hasSymptoms = bodyParts.length > 0 || painLevel !== null || symptomsNotes.length > 0;
    this.api
      .createUrgentRequest({
        patientLatitude: latitude,
        patientLongitude: longitude,
        visitPreference: this.urgentPreference(),
        notes: this.urgentNotes().trim(),
        ...(hasSymptoms
          ? {
              symptoms: {
                bodyParts: bodyParts.length > 0 ? bodyParts : null,
                painLevel,
                notes: symptomsNotes || null,
              },
            }
          : {}),
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.urgentSending.set(false);
          this.lastUrgentRequest.set(toPatientUrgent(response, this.doctorNames()));
          this.urgentNotes.set('');
          this.urgentBodyParts.set([]);
          this.urgentPainLevel.set(null);
          this.urgentSymptomsNotes.set('');
          this.loadDoctors();
          this.loadAcceptedOffers();
        },
        error: (error) => {
          this.urgentSending.set(false);
          this.urgentError.set(messageFrom(error, "La demande n'a pas pu etre envoyee."));
        },
      });
  }

  loadAcceptedOffers(): void {
    const request = this.lastUrgentRequest();
    if (!request) {
      this.acceptedOffers.set([]);
      return;
    }
    if (this.acceptedOffersLoading()) return;
    this.acceptedOffersLoading.set(true);
    this.acceptedOffersError.set(null);
    this.api
      .urgentOffers(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (offers) => {
          this.acceptedOffers.set(offers);
          this.acceptedOffersLoading.set(false);
        },
        error: () => {
          this.acceptedOffersLoading.set(false);
          this.acceptedOffersError.set(
            'Impossible de charger les medecins ayant accepte votre demande.',
          );
        },
      });
  }

  selectOffer(offerId: string): void {
    const request = this.lastUrgentRequest();
    if (!request || this.offerSelectingId()) return;
    this.offerSelectingId.set(offerId);
    this.acceptedOffersError.set(null);
    this.api
      .selectDoctor(request.id, offerId)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.offerSelectingId.set(null);
          this.lastUrgentRequest.set(fromUrgentRequestDto(dto, this.doctorNames()));
          void this.router.navigate(['/patient', 'urgent-request', request.id, 'tracking']);
        },
        error: (error) => {
          this.offerSelectingId.set(null);
          this.acceptedOffersError.set(messageFrom(error, 'Impossible de confirmer votre choix.'));
        },
      });
  }

  openUrgentTracking(id: string): void {
    void this.router.navigate(['/patient', 'urgent-request', id, 'tracking']);
  }

  refreshUrgent(): void {
    const request = this.lastUrgentRequest();
    if (!request) return;
    this.api
      .urgentRequest(request.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dto) => {
          this.lastUrgentRequest.set(fromUrgentRequestDto(dto, this.doctorNames()));
          this.loadAcceptedOffers();
        },
        error: () => this.urgentError.set('Statut de la demande indisponible.'),
      });
  }

  resetUrgentForm(): void {
    this.urgentNotes.set('');
    this.urgentError.set(null);
    this.lastUrgentRequest.set(null);
    this.acceptedOffers.set([]);
    this.acceptedOffersError.set(null);
    this.urgentSearchResults.set([]);
    this.urgentSearchError.set(null);
    this.urgentSearched.set(false);
    this.previewKey = '';
  }

  private pollAvailableDoctors(): void {
    if (this.activeTab() === 'urgent') {
      if (this.urgentSearched()) this.refreshUrgentResults();
      if (this.lastUrgentRequest()) this.loadAcceptedOffers();
    } else if (this.activeTab() === 'doctors' && this.doctorMode() === 'urgent') {
      this.refreshDoctors();
    }
  }

  private refreshUrgentResults(): void {
    if (this.urgentSearchLoading()) return;
    this.api
      .availableDoctors(
        Number(this.urgentLat()),
        Number(this.urgentLng()),
        DEFAULT_RADIUS_KM,
        this.urgentPreference(),
      )
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dtos) => {
          const mapped = dtos.map(toPatientDoctor);
          this.updateDoctorNames(mapped);
          this.urgentSearchResults.set(mapped);
        },
        error: () => undefined,
      });
  }

  private refreshDoctors(): void {
    if (this.doctorsLoading()) return;
    this.api
      .availableDoctors(DEFAULT_LAT, DEFAULT_LNG, DEFAULT_RADIUS_KM, 'EITHER')
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (dtos) => {
          const mapped = dtos.map(toPatientDoctor);
          this.updateDoctorNames(mapped);
          this.doctors.set(mapped);
        },
        error: () => undefined,
      });
  }

  updateDraft(field: DraftField, value: string): void {
    this.profileDraft.update((draft) => ({ ...draft, [field]: value }));
  }

  updateDraftFlag(field: DraftFlag, event: Event): void {
    const checked = (event.target as HTMLInputElement).checked;
    this.profileDraft.update((draft) => ({ ...draft, [field]: checked }));
  }

  saveProfile(): void {
    this.profileSaving.set(true);
    this.profileError.set(null);
    this.profileSaved.set(null);
    const draft = this.profileDraft();
    this.api
      .updateProfile({
        firstName: draft.firstName.trim() || null,
        lastName: draft.lastName.trim() || null,
        dateOfBirth: draft.dateOfBirth || null,
        gender: draft.gender || null,
        preferredLanguage: draft.preferredLanguage,
        notificationMedications: draft.notificationMedications,
        notificationAppointments: draft.notificationAppointments,
        notificationPassport: draft.notificationPassport,
      })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (profile) => {
          this.profileSaving.set(false);
          this.profile.set(profile);
          this.profileDraft.set(draftFromProfile(profile));
          this.profileSaved.set('Profil mis a jour.');
        },
        error: (error) => {
          this.profileSaving.set(false);
          this.profileError.set(messageFrom(error, 'Enregistrement impossible. Reessayez.'));
        },
      });
  }

  changePassword(): void {
    this.passwordError.set(null);
    this.passwordMessage.set(null);
    const current = this.passwordCurrent();
    const next = this.passwordNew();
    const confirmation = this.passwordConfirm();
    if (!current) {
      this.passwordError.set('Indiquez votre mot de passe actuel.');
      return;
    }
    if (next.length < 12) {
      this.passwordError.set('Le nouveau mot de passe doit contenir au moins 12 caracteres.');
      return;
    }
    if (next !== confirmation) {
      this.passwordError.set('La confirmation ne correspond pas au nouveau mot de passe.');
      return;
    }
    this.passwordSaving.set(true);
    this.api
      .changePassword({ currentPassword: current, newPassword: next })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.passwordSaving.set(false);
          this.passwordMessage.set('Mot de passe mis a jour.');
          this.passwordCurrent.set('');
          this.passwordNew.set('');
          this.passwordConfirm.set('');
          if (this.mustChangePassword) {
            this.passwordChanged.set(true);
            this.initialize();
          }
        },
        error: (error) => {
          this.passwordSaving.set(false);
          this.passwordError.set(messageFrom(error, 'Changement de mot de passe impossible.'));
        },
      });
  }

  doctorInitials(doctor: PatientDoctor): string {
    return initialsFor(doctor.name.replace('Dr ', ''), '');
  }

  doctorDistanceLabel(doctor: PatientDoctor): string {
    return doctor.distanceKm === null ? '' : `${doctor.distanceKm.toLocaleString('fr-FR')} km`;
  }

  dateLabel(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(new Date(`${iso}T00:00:00`));
  }

  shortDateLabel(iso: string): string {
    return new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric' }).format(
      new Date(`${iso}T00:00:00`),
    );
  }

  dateDay(iso: string): number {
    return new Date(`${iso}T00:00:00`).getDate();
  }

  slotTimeLabel(value: string): string {
    return formatInstantTime(value);
  }

  visitPreferenceLabel(preference: string | null): string {
    if (preference === 'HOME_VISIT') return 'A domicile';
    if (preference === 'CABINET_VISIT') return 'Au cabinet';
    if (preference === 'EITHER') return 'Indifferent';
    return 'Non renseignee';
  }

  appointmentBadge(item: PatientAppointment): string {
    if (item.status === 'CANCELLED') return 'Annule';
    if (item.status === 'COMPLETED') return 'Termine';
    if (item.status === 'IN_PROGRESS') return 'En cours';
    if (item.status === 'NO_SHOW') return 'Absent';
    if (item.source.toUpperCase() === 'URGENT') return 'Urgence';
    return 'Confirme';
  }

  appointmentBadgeClass(item: PatientAppointment): AppointmentBadge {
    if (
      item.status === 'CANCELLED' ||
      item.status === 'COMPLETED' ||
      item.status === 'NO_SHOW'
    ) {
      return 'muted';
    }
    if (item.source.toUpperCase() === 'URGENT' || item.status === 'IN_PROGRESS') return 'urgent';
    return 'cabinet';
  }

  appointmentTone(item: PatientAppointment): AppointmentTone {
    if (item.status === 'CANCELLED') return 'cancelled';
    if (item.status === 'COMPLETED') return 'done';
    if (item.status === 'IN_PROGRESS') return 'in-progress';
    if (item.status === 'NO_SHOW') return 'cancelled';
    if (item.source.toUpperCase() === 'URGENT') return 'urgent';
    return 'booked';
  }

  bodyPartOptions(): readonly { readonly value: BodyPartDto; readonly label: string }[] {
    return BODY_PART_OPTIONS;
  }

  bodyPartLabel(value: BodyPartDto): string {
    return BODY_PART_OPTIONS.find((option) => option.value === value)?.label ?? value;
  }

  toggleBodyPart(value: BodyPartDto): void {
    this.urgentBodyParts.update((current) =>
      current.includes(value) ? current.filter((part) => part !== value) : [...current, value],
    );
  }

  setPainLevel(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.urgentPainLevel.set(Number.isFinite(value) ? value : null);
  }

  priceLabel(price: number | null): string {
    return price === null ? '' : `${price.toLocaleString('fr-FR')} TND`;
  }

  private updateDoctorNames(doctors: readonly PatientDoctor[]): void {
    const next = { ...this.doctorNames() };
    for (const doctor of doctors) {
      if (!next[doctor.id]) next[doctor.id] = doctor.name;
    }
    this.doctorNames.set(next);
  }
}

function isPatientTab(value: string | null): value is PatientTab {
  return (
    value === 'home' ||
    value === 'doctors' ||
    value === 'appointments' ||
    value === 'urgent' ||
    value === 'profile'
  );
}

function toPatientDoctor(dto: AvailableDoctorDtoLike): PatientDoctor {
  return {
    id: dto.doctorId,
    name: sanitizeDoctorName(dto.name),
    specialty: dto.specialty,
    distanceKm: dto.distanceKm,
    availableForUrgent: true,
  };
}

interface AvailableDoctorDtoLike {
  readonly doctorId: string;
  readonly name: string;
  readonly specialty: string | null;
  readonly distanceKm: number;
}

function toDirectoryDoctor(dto: DoctorDirectoryDto): PatientDoctor {
  return {
    id: dto.doctorId,
    name: sanitizeDoctorName(dto.displayName),
    specialty: dto.specialty,
    distanceKm: null,
    availableForUrgent: dto.availableForUrgent,
  };
}

function toPatientAppointment(
  dto: AppointmentDto,
  names: Readonly<Record<string, string>>,
): PatientAppointment {
  const start = new Date(dto.startTime);
  return {
    id: dto.id,
    doctorId: dto.doctorId,
    doctorName: names[dto.doctorId] ?? 'Docteur',
    date: isoDate(start),
    timeLabel: formatInstantTime(dto.startTime),
    status: appointmentStatus(dto.status),
    source: dto.source,
    notes: dto.notes ?? 'Consultation',
    quotedPriceTnd: dto.quotedPriceTnd ?? null,
  };
}

function appointmentStatus(value: string): AppointmentViewStatus {
  const normalized = value.toUpperCase();
  if (normalized === 'CANCELLED') return 'CANCELLED';
  if (normalized === 'COMPLETED') return 'COMPLETED';
  if (normalized === 'IN_PROGRESS') return 'IN_PROGRESS';
  if (normalized === 'NO_SHOW') return 'NO_SHOW';
  return 'CONFIRMED';
}

function toPatientUrgent(
  response: UrgentRequestCreateResponseDto,
  names: Readonly<Record<string, string>>,
): PatientUrgentRequest {
  return {
    id: response.request.id,
    status: response.request.status,
    visitPreference: response.request.visitPreference,
    notes: response.request.notes,
    offers: response.offers.map((offer) => toPatientOffer(offer, names)),
    selectedOfferId: response.request.selectedOfferId,
  };
}

function fromUrgentRequestDto(
  dto: UrgentRequestDto,
  names: Readonly<Record<string, string>>,
): PatientUrgentRequest {
  return {
    id: dto.id,
    status: dto.status,
    visitPreference: dto.visitPreference,
    notes: dto.notes,
    offers: dto.offers.map((offer) => toPatientOffer(offer, names)),
    selectedOfferId: dto.selectedOfferId,
  };
}

function toPatientOffer(
  offer: UrgentOfferDto,
  names: Readonly<Record<string, string>>,
): PatientUrgentOffer {
  return {
    offerId: offer.offerId,
    doctorId: offer.doctorId,
    doctorName: names[offer.doctorId] ?? 'Docteur',
    status: offer.status,
  };
}

function draftFromProfile(profile: PatientProfileDto): ProfileDraft {
  return {
    firstName: profile.firstName ?? '',
    lastName: profile.lastName ?? '',
    dateOfBirth: profile.dateOfBirth ?? '',
    gender: profile.gender ?? '',
    preferredLanguage: profile.preferredLanguage ?? 'fr',
    notificationMedications: profile.notificationMedications,
    notificationAppointments: profile.notificationAppointments,
    notificationPassport: profile.notificationPassport,
  };
}

const GENERIC_DOCTOR_NAMES = new Set(['Doctor', 'Médecin', 'Medecin', 'Docteur']);

function sanitizeDoctorName(name: string): string {
  if (!name || GENERIC_DOCTOR_NAMES.has(name.trim())) return 'Docteur';
  return name;
}

function initialsFor(firstName: string, lastName: string): string {
  const initials = `${firstName.charAt(0)}${lastName.charAt(0)}`
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  return initials || 'P';
}

function formatInstantTime(value: string): string {
  return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(
    new Date(value),
  );
}

function isoDate(value: Date): string {
  return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value);
  next.setDate(value.getDate() + days);
  return next;
}

function nextSevenDays(): readonly string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, index) => isoDate(addDays(today, index)));
}

function appointmentsRange(): { from: string; to: string } {
  const now = new Date();
  const from = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), -60);
  const to = addDays(new Date(now.getFullYear(), now.getMonth(), now.getDate()), 60);
  return { from: from.toISOString(), to: to.toISOString() };
}

function messageFrom(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const body = error.error as ApiErrorBody | null;
    return body?.message ?? fallback;
  }
  return fallback;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function isPresent(value: string | null): value is string {
  return value !== null && value.length > 0;
}
