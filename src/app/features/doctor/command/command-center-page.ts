import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { forkJoin } from 'rxjs';

import { AppointmentApiService } from '../appointment-api.service';
import type { AppointmentDto, AvailabilityRuleDto, DoctorStatsDto } from '../appointment-api.models';
import { ActiveConsultationStore } from '../active-consultation.store';
import type { ActiveConsultation } from '../active-consultation.models';
import { BookingRequestDetailPanel } from '../scheduled-care/booking-request-detail-panel';
import { ScheduledAppointmentDetailPanel } from '../scheduled-care/scheduled-appointment-detail-panel';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { AppointmentDetailPanel } from '../shared/appointment-detail-panel';
import { PatientSummaryPanel } from '../shared/patient-summary-panel';
import { UrgentCabinetClinicalStore } from '../urgent-cabinet-clinical.store';
import type { UrgentCabinetClinicalCommitment } from '../urgent-cabinet-clinical.models';
import { CommandCenterView } from './command-center-view';
import type {
  CommandCenterAction,
  CommandCenterAppointmentState,
  CommandCenterAppointmentViewModel,
  CommandCenterAvatarTone,
  CommandCenterClinicalViewModel,
  CommandCenterNextAppointmentViewModel,
  CommandCenterRequestViewModel,
  CommandCenterViewModel,
} from './command-center-view.models';

@Component({
  selector: 'app-command-center-page',
  imports: [
    CommandCenterView,
    AppointmentDetailPanel,
    PatientSummaryPanel,
    BookingRequestDetailPanel,
    ScheduledAppointmentDetailPanel,
  ],
  templateUrl: './command-center-page.html',
  styleUrl: './command-center-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CommandCenterPage {
  private readonly router = inject(Router);
  private readonly api = inject(AppointmentApiService);
  readonly scheduledCare = inject(ScheduledCareFacade);
  readonly activeConsultation = inject(ActiveConsultationStore);
  readonly urgentCabinet = inject(UrgentCabinetClinicalStore);

  readonly aptPanel = viewChild.required<AppointmentDetailPanel>('aptPanel');
  readonly patientPanel = viewChild.required<PatientSummaryPanel>('patientPanel');
  readonly scheduledRequestPanel =
    viewChild.required<BookingRequestDetailPanel>('scheduledRequestPanel');
  readonly scheduledAppointmentPanel = viewChild.required<ScheduledAppointmentDetailPanel>(
    'scheduledAppointmentPanel',
  );

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly appointments = signal<readonly AppointmentDto[]>([]);
  readonly todayStats = signal<DoctorStatsDto | null>(null);
  readonly availabilityRules = signal<readonly AvailabilityRuleDto[]>([]);

  readonly pendingScheduledRequest = computed(
    () => this.scheduledCare.home()?.nextPendingRequest ?? null,
  );
  readonly nextScheduledAppointment = computed(
    () => this.scheduledCare.home()?.nextConfirmedAppointment ?? null,
  );
  readonly stats = computed(() => {
    const stats = this.todayStats();
    return [
      {
        value: stats?.consultations ?? 0,
        label: "Consultations aujourd'hui",
        icon: 'medicine-box',
        route: null,
      },
      { value: stats?.upcoming ?? 0, label: 'A venir', icon: 'clock-circle', route: null },
      { value: stats?.finished ?? 0, label: 'Terminees', icon: 'check-circle', route: '/doctor/history' },
      {
        value: this.scheduledCare.home()?.pendingRequestCount ?? 0,
        label: 'Demandes planifiées',
        icon: 'inbox',
        route: null,
      },
    ] as const;
  });

  readonly pendingAppointments = computed(() =>
    this.appointments().filter(
      (appointment) => appointment.status === 'CONFIRMED' || appointment.status === 'IN_PROGRESS',
    ),
  );

  readonly viewModel = computed<CommandCenterViewModel>(() => {
    const home = this.scheduledCare.home();
    const pendingRequest = home?.nextPendingRequest ?? null;
    const nextAppointment = home?.nextConfirmedAppointment ?? null;
    const active = this.activeConsultation.active();
    const urgentReady = this.urgentCabinet.actionable();
    const urgentWaiting = this.urgentCabinet.waiting();
    const clinical = this.clinicalView(active, urgentReady, urgentWaiting, nextAppointment);
    const clinicalError = clinical
      ? null
      : (this.activeConsultation.error() ?? this.urgentCabinet.error());
    const clinicalRetryAction = this.activeConsultation.error()
      ? ({ kind: 'RETRY_ACTIVE_CONSULTATION' } as const)
      : this.urgentCabinet.error()
        ? ({ kind: 'RETRY_URGENT_CABINET' } as const)
        : null;
    const availability = this.availabilityPresentation();

    return {
      fixtureNote: null,
      greeting: 'Bonjour, Dr Ben Salah',
      dateLabel: formatDate(new Date(), undefined, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }),
      appointmentCount: this.appointments().length,
      pendingRequestCount: home?.pendingRequestCount ?? 0,
      dayLoading: this.loading(),
      dayError: this.error(),
      appointments: this.pendingAppointments().map((appointment) =>
        this.appointmentView(appointment),
      ),
      scheduledCareLoading: this.scheduledCare.homeLoading(),
      scheduledCareError: this.scheduledCare.homeError(),
      pendingRequests: pendingRequest ? [this.requestView(pendingRequest)] : [],
      nextAppointment: nextAppointment ? this.nextAppointmentView(nextAppointment) : null,
      clinicalLoading:
        clinical === null &&
        (this.activeConsultation.loading() || this.urgentCabinet.loading()),
      clinicalError,
      clinicalRetryAction,
      clinical,
      clinicalStarting: this.activeConsultation.starting(),
      clinicalStartError: this.activeConsultation.startError(),
      availabilityState: availability.state,
      availabilityTitle: availability.title,
      availabilityDescription: availability.description,
    };
  });

  constructor() {
    this.loadData();
    this.scheduledCare.loadHome();
    void this.activeConsultation.refresh();
    void this.urgentCabinet.refresh();
  }

  handleViewAction(action: CommandCenterAction): void {
    switch (action.kind) {
      case 'NAVIGATE':
        void this.router.navigateByUrl(action.href);
        return;
      case 'OPEN_APPOINTMENT': {
        const appointment = this.appointments().find((item) => item.id === action.appointmentId);
        if (appointment) this.openAptDetail(appointment);
        return;
      }
      case 'OPEN_REQUEST': {
        const request = this.scheduledCare.home()?.nextPendingRequest;
        if (request?.requestId === action.requestId) this.openScheduledRequest(request);
        return;
      }
      case 'OPEN_SCHEDULED_APPOINTMENT': {
        const appointment = this.scheduledCare.home()?.nextConfirmedAppointment;
        if (appointment?.appointmentId === action.appointmentId) {
          this.openScheduledAppointment(appointment);
        }
        return;
      }
      case 'CONTINUE_CONSULTATION':
        this.continueConsultation(action.consultationId);
        return;
      case 'START_SCHEDULED': {
        const appointment = this.scheduledCare.home()?.nextConfirmedAppointment;
        if (appointment?.appointmentId === action.appointmentId) {
          void this.startScheduledConsultation(appointment);
        }
        return;
      }
      case 'START_URGENT': {
        const commitment = this.urgentCabinet.actionable();
        if (commitment?.commitmentId === action.commitmentId) {
          void this.startUrgentCabinetConsultation(commitment);
        }
        return;
      }
      case 'RETRY_DAY':
        this.loadData();
        return;
      case 'RETRY_SCHEDULED_CARE':
        this.scheduledCare.loadHome();
        return;
      case 'RETRY_ACTIVE_CONSULTATION':
        void this.activeConsultation.refresh();
        return;
      case 'RETRY_URGENT_CABINET':
        void this.urgentCabinet.refresh();
        return;
    }
  }

  openAptDetail(appointment: AppointmentDto): void {
    this.aptPanel().openWith(appointment);
  }

  onAppointmentUpdated(updated: AppointmentDto): void {
    this.appointments.update((list) => list.map((item) => (item.id === updated.id ? updated : item)));
    this.loadData();
  }

  async startScheduledConsultation(appointment: DoctorScheduledCareItem): Promise<void> {
    if (appointment.appointmentId === null || appointment.status !== 'CONFIRMED') return;
    const outcome = await this.activeConsultation.startScheduledAppointment(
      appointment.appointmentId,
      appointment.version,
    );
    if (outcome.kind === 'STARTED' || outcome.kind === 'RECOVERED') {
      await this.router.navigate([
        '/doctor',
        'consultation',
        outcome.consultation.consultationId,
      ]);
    }
  }

  async startUrgentCabinetConsultation(
    commitment: UrgentCabinetClinicalCommitment,
  ): Promise<void> {
    if (
      !commitment.clinicalStartReady ||
      !commitment.allowedActions.includes('START_CONSULTATION')
    ) {
      return;
    }
    const outcome = await this.activeConsultation.startUrgentCabinet(
      commitment.commitmentId,
      commitment.revision,
    );
    await this.urgentCabinet.refresh();
    if (outcome.kind === 'STARTED' || outcome.kind === 'RECOVERED') {
      await this.router.navigate([
        '/doctor',
        'consultation',
        outcome.consultation.consultationId,
      ]);
    }
  }

  continueConsultation(consultationId: string): void {
    void this.router.navigate(['/doctor', 'consultation', consultationId]);
  }

  openScheduledRequest(request: DoctorScheduledCareItem): void {
    if (request.requestId) this.scheduledRequestPanel().openWith(request.requestId);
  }

  openScheduledAppointment(appointment: DoctorScheduledCareItem): void {
    if (appointment.appointmentId) {
      this.scheduledAppointmentPanel().openWith(appointment.appointmentId);
    }
  }

  private appointmentView(appointment: AppointmentDto): CommandCenterAppointmentViewModel {
    const patient = appointment.patientName?.trim() || 'Patient non renseigné';
    return {
      id: appointment.id,
      time: formatTime(appointment.startTime),
      patient,
      initials: initials(patient),
      reason: appointment.notes?.trim() || 'Consultation',
      state: appointmentState(appointment.status),
      status: appointmentStatusLabel(appointment.status),
      avatarTone: avatarTone(appointment.id),
      action: {
        kind: 'OPEN_APPOINTMENT',
        appointmentId: appointment.id,
        href: `/doctor/calendar?appointmentId=${encodeURIComponent(appointment.id)}`,
      },
    };
  }

  private requestView(request: DoctorScheduledCareItem): CommandCenterRequestViewModel {
    const patient = request.subject.displayName.trim() || 'Patient non renseigné';
    const requestId = request.requestId ?? '';
    return {
      id: requestId,
      patient,
      initials: initials(patient),
      reason: request.subject.relationship?.trim() || 'Patient',
      date: formatDate(request.start, request.timezone, {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
      }),
      time: formatTime(request.start, request.timezone),
      avatarTone: avatarTone(requestId),
      action: {
        kind: 'OPEN_REQUEST',
        requestId,
        href: `/doctor/requests?requestId=${encodeURIComponent(requestId)}`,
      },
    };
  }

  private nextAppointmentView(
    appointment: DoctorScheduledCareItem,
  ): CommandCenterNextAppointmentViewModel {
    const patient = appointment.subject.displayName.trim() || 'Patient non renseigné';
    const appointmentId = appointment.appointmentId ?? '';
    return {
      patient,
      initials: initials(patient),
      reason: 'Motif non renseigné',
      date: isToday(appointment.start, appointment.timezone)
        ? 'Aujourd’hui'
        : formatDate(appointment.start, appointment.timezone, {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
          }),
      timeRange: `${formatTime(appointment.start, appointment.timezone)} – ${formatTime(appointment.end, appointment.timezone)}`,
      location: appointment.cabinet.name.trim() || 'Cabinet non renseigné',
      room: 'Salle non renseignée',
      avatarTone: avatarTone(appointmentId),
      detailAction: {
        kind: 'OPEN_SCHEDULED_APPOINTMENT',
        appointmentId,
        href: `/doctor/calendar?appointmentId=${encodeURIComponent(appointmentId)}`,
      },
      startAction:
        appointment.status === 'CONFIRMED'
          ? { kind: 'START_SCHEDULED', appointmentId }
          : null,
    };
  }

  private clinicalView(
    active: ActiveConsultation | null,
    urgentReady: UrgentCabinetClinicalCommitment | null,
    urgentWaiting: UrgentCabinetClinicalCommitment | null,
    nextAppointment: DoctorScheduledCareItem | null,
  ): CommandCenterClinicalViewModel | null {
    if (active) {
      return {
        title: 'Consultation en cours',
        patient: 'Consultation en cours',
        initials: 'EC',
        meta: `Épisode ${active.consultationId}`,
        reasonLabel: 'Informations patient',
        reason: 'Non disponibles dans la projection active autorisée.',
        avatarTone: 'mint',
        primaryLabel: 'Continuer la consultation',
        primaryAction: {
          kind: 'CONTINUE_CONSULTATION',
          consultationId: active.consultationId,
          href: `/doctor/consultation/${encodeURIComponent(active.consultationId)}`,
        },
        secondaryLabel: null,
        secondaryAction: null,
        statusLabel: null,
      };
    }

    if (urgentReady) {
      return {
        title: 'Urgence au cabinet prête',
        patient: 'Patient arrivé au cabinet',
        initials: 'UC',
        meta: 'Responsabilité urgente confirmée',
        reasonLabel: 'Contexte clinique',
        reason: 'Les détails restent protégés dans le parcours d’urgence.',
        avatarTone: 'rose',
        primaryLabel: 'Démarrer la consultation',
        primaryAction: { kind: 'START_URGENT', commitmentId: urgentReady.commitmentId },
        secondaryLabel: null,
        secondaryAction: null,
        statusLabel: 'Prête à démarrer manuellement',
      };
    }

    if (urgentWaiting) {
      return {
        title: 'Responsabilité urgente',
        patient: 'Patient arrivé au cabinet',
        initials: 'UC',
        meta: 'Responsabilité urgente confirmée',
        reasonLabel: 'État',
        reason: 'Terminez la consultation en cours puis actualisez.',
        avatarTone: 'rose',
        primaryLabel: null,
        primaryAction: null,
        secondaryLabel: null,
        secondaryAction: null,
        statusLabel: 'En attente · aucun démarrage automatique',
      };
    }

    if (nextAppointment?.appointmentId) {
      const patient = nextAppointment.subject.displayName.trim() || 'Patient non renseigné';
      return {
        title: 'Rendez-vous à démarrer',
        patient,
        initials: initials(patient),
        meta: nextAppointment.cabinet.name.trim() || 'Cabinet non renseigné',
        reasonLabel: 'Motif de consultation',
        reason: 'Motif non renseigné',
        avatarTone: avatarTone(nextAppointment.appointmentId),
        primaryLabel: 'Démarrer la consultation',
        primaryAction: {
          kind: 'START_SCHEDULED',
          appointmentId: nextAppointment.appointmentId,
        },
        secondaryLabel: 'Voir les détails',
        secondaryAction: {
          kind: 'OPEN_SCHEDULED_APPOINTMENT',
          appointmentId: nextAppointment.appointmentId,
          href: `/doctor/calendar?appointmentId=${encodeURIComponent(nextAppointment.appointmentId)}`,
        },
        statusLabel: null,
      };
    }

    return null;
  }

  private availabilityPresentation(): {
    readonly state: CommandCenterViewModel['availabilityState'];
    readonly title: string;
    readonly description: string;
  } {
    if (this.loading()) {
      return {
        state: 'loading',
        title: 'Synchronisation du planning',
        description: 'Chargement des disponibilités…',
      };
    }
    if (this.error()) {
      return {
        state: 'error',
        title: 'Planning indisponible',
        description: 'Les disponibilités n’ont pas pu être chargées.',
      };
    }
    if (this.availabilityRules().length === 0) {
      return {
        state: 'warning',
        title: 'Disponibilités à configurer',
        description: 'Aucun créneau de consultation n’est configuré.',
      };
    }
    return {
      state: 'ready',
      title: 'Planning à jour',
      description: 'Vos disponibilités de consultation sont configurées.',
    };
  }

  private loadData(): void {
    this.loading.set(true);
    this.error.set(null);
    const { from, to } = this.todayRange();
    forkJoin({
      stats: this.api.todayStats(),
      appointments: this.api.listAppointments(from, to),
      rules: this.api.listRules(),
    }).subscribe({
      next: ({ stats, appointments, rules }) => {
        this.todayStats.set(stats);
        this.appointments.set(appointments);
        this.availabilityRules.set(rules);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Impossible de charger les données du jour.');
        this.loading.set(false);
      },
    });
  }

  private todayRange(): { readonly from: string; readonly to: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
}

function appointmentState(status: AppointmentDto['status']): CommandCenterAppointmentState {
  switch (status) {
    case 'COMPLETED':
      return 'completed';
    case 'IN_PROGRESS':
      return 'active';
    case 'CONFIRMED':
      return 'confirmed';
    default:
      return 'upcoming';
  }
}

function appointmentStatusLabel(status: AppointmentDto['status']): string {
  switch (status) {
    case 'CONFIRMED':
      return 'En attente';
    case 'IN_PROGRESS':
      return 'En cours';
    case 'CANCELLED':
      return 'Annulé';
    case 'COMPLETED':
      return 'Terminé';
    case 'NO_SHOW':
      return 'Absent';
    default:
      return status;
  }
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return 'PN';
  return parts.slice(0, 2).map((part) => part[0]?.toLocaleUpperCase('fr-FR') ?? '').join('');
}

function avatarTone(identity: string): CommandCenterAvatarTone {
  const tones: readonly CommandCenterAvatarTone[] = ['mint', 'blue', 'rose'];
  const hash = Array.from(identity).reduce((total, character) => total + character.codePointAt(0)!, 0);
  return tones[hash % tones.length] ?? 'mint';
}

function formatTime(instant: string, timeZone?: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone,
  }).format(new Date(instant));
}

function formatDate(
  instant: Date | string,
  timeZone: string | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const value = new Intl.DateTimeFormat('fr-FR', { ...options, timeZone }).format(
    typeof instant === 'string' ? new Date(instant) : instant,
  );
  return value.length === 0 ? value : value[0].toLocaleUpperCase('fr-FR') + value.slice(1);
}

function isToday(instant: string, timeZone: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });
  return formatter.format(new Date(instant)) === formatter.format(new Date());
}
