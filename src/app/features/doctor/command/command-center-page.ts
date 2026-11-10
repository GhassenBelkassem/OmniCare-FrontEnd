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

import { appointmentStatusLabel } from '../../../shared/ui/appointment-status';
import { AppointmentApiService } from '../appointment-api.service';
import type {
  AppointmentDto,
  AvailabilityRuleDto,
  DoctorStatsDto,
} from '../appointment-api.models';
import { ActiveConsultationStore } from '../active-consultation.store';
import type { ActiveConsultation } from '../active-consultation.models';
import { BookingRequestDetailPanel } from '../scheduled-care/booking-request-detail-panel';
import { ScheduledAppointmentDetailPanel } from '../scheduled-care/scheduled-appointment-detail-panel';
import { ScheduledCareApiService } from '../scheduled-care/scheduled-care-api.service';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { AppointmentDetailPanel } from '../shared/appointment-detail-panel';
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
  CommandCenterToCloseViewModel,
  CommandCenterViewModel,
} from './command-center-view.models';

@Component({
  selector: 'app-command-center-page',
  imports: [
    CommandCenterView,
    AppointmentDetailPanel,
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
  private readonly scheduledCareApi = inject(ScheduledCareApiService);
  /** Appointments of the last 30 days (through today): stale IN_PROGRESS and patient names. */
  readonly recentAgenda = signal<readonly DoctorScheduledCareItem[]>([]);
  readonly scheduledCare = inject(ScheduledCareFacade);
  readonly activeConsultation = inject(ActiveConsultationStore);
  readonly urgentCabinet = inject(UrgentCabinetClinicalStore);

  readonly aptPanel = viewChild.required<AppointmentDetailPanel>('aptPanel');
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
  /** Only a strictly future CONFIRMED appointment is « Prochain rendez-vous ». */
  readonly nextScheduledAppointment = computed(() => {
    const next = this.scheduledCare.home()?.nextConfirmedAppointment ?? null;
    return next !== null && isUpcomingConfirmed(next) ? next : null;
  });
  /** The active consultation, only when it started today. */
  readonly todayConsultation = computed(() => {
    const active = this.activeConsultation.active();
    return active !== null && isToday(active.startedAt) ? active : null;
  });
  readonly toClose = computed(() => this.toCloseView());
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
      {
        value: stats?.finished ?? 0,
        label: 'Terminees',
        icon: 'check-circle',
        route: '/doctor/history',
      },
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
    const nextAppointment = this.nextScheduledAppointment();
    const active = this.todayConsultation();
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
      greeting: 'Bonjour',
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
        clinical === null && (this.activeConsultation.loading() || this.urgentCabinet.loading()),
      clinicalError,
      clinicalRetryAction,
      clinical,
      clinicalStarting: this.activeConsultation.starting(),
      clinicalStartError: this.activeConsultation.startError(),
      toClose: this.toClose(),
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
        const appointment = this.nextScheduledAppointment();
        if (appointment?.appointmentId === action.appointmentId) {
          this.openScheduledAppointment(appointment);
        }
        return;
      }
      case 'CONTINUE_CONSULTATION':
        this.continueConsultation(action.consultationId);
        return;
      case 'CLOSE_CONSULTATION':
        // Closing is the consultation's own finish flow; never auto-completed here.
        void this.router.navigate(['/doctor', 'consultation', action.consultationId], {
          queryParams: { cloture: '1' },
        });
        return;
      case 'OPEN_STALE_APPOINTMENT': {
        const appointment = this.recentAgenda().find(
          (candidate) => candidate.appointmentId === action.appointmentId,
        );
        if (appointment) this.openScheduledAppointment(appointment);
        return;
      }
      case 'START_SCHEDULED': {
        const appointment = this.nextScheduledAppointment();
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
    this.appointments.update((list) =>
      list.map((item) => (item.id === updated.id ? updated : item)),
    );
    this.loadData();
  }

  async startScheduledConsultation(appointment: DoctorScheduledCareItem): Promise<void> {
    if (appointment.appointmentId === null || appointment.status !== 'CONFIRMED') return;
    const outcome = await this.activeConsultation.startScheduledAppointment(
      appointment.appointmentId,
      appointment.version,
    );
    if (outcome.kind === 'STARTED' || outcome.kind === 'RECOVERED') {
      await this.router.navigate(['/doctor', 'consultation', outcome.consultation.consultationId]);
    }
  }

  async startUrgentCabinetConsultation(commitment: UrgentCabinetClinicalCommitment): Promise<void> {
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
      await this.router.navigate(['/doctor', 'consultation', outcome.consultation.consultationId]);
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
      this.scheduledAppointmentPanel().openWith(appointment);
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
      statusCode: appointment.status,
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
      room: null,
      avatarTone: avatarTone(appointmentId),
      detailAction: {
        kind: 'OPEN_SCHEDULED_APPOINTMENT',
        appointmentId,
        href: `/doctor/calendar?appointmentId=${encodeURIComponent(appointmentId)}`,
      },
      startAction:
        appointment.status === 'CONFIRMED' ? { kind: 'START_SCHEDULED', appointmentId } : null,
    };
  }

  private clinicalView(
    active: ActiveConsultation | null,
    urgentReady: UrgentCabinetClinicalCommitment | null,
    urgentWaiting: UrgentCabinetClinicalCommitment | null,
    nextAppointment: DoctorScheduledCareItem | null,
  ): CommandCenterClinicalViewModel | null {
    if (active) {
      const patient = this.consultationPatientName(active);
      return {
        title: 'Consultation en cours',
        patient,
        initials: initials(patient),
        meta: `Démarrée à ${formatTime(active.startedAt)}`,
        reasonLabel: 'Informations patient',
        reason: 'Informations patient disponibles dans la consultation.',
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

  /** Patient name of a consultation, from the scheduled appointment it was started from. */
  private consultationPatientName(consultation: ActiveConsultation): string {
    if (consultation.sourceType === 'SCHEDULED_APPOINTMENT') {
      const appointment =
        this.recentAgenda().find((item) => item.appointmentId === consultation.sourceId) ??
        null;
      const name = appointment?.subject.displayName.trim();
      if (name) return name;
      const today = this.appointments().find((item) => item.id === consultation.sourceId);
      if (today?.patientName?.trim()) return today.patientName.trim();
    }
    return consultation.sourceType === 'SCHEDULED_APPOINTMENT'
      ? 'Patient en consultation'
      : 'Patient en consultation urgente';
  }

  /**
   * « À clôturer »: consultations or appointments still IN_PROGRESS from a previous day.
   * They are listed for the doctor to resume or close; nothing is auto-completed.
   */
  private toCloseView(): CommandCenterToCloseViewModel[] {
    const active = this.activeConsultation.active();
    const staleActive = active !== null && !isToday(active.startedAt) ? active : null;
    const rows: CommandCenterToCloseViewModel[] = [];
    const seen = new Set<string>();
    if (staleActive !== null) {
      const patient = this.consultationPatientName(staleActive);
      const href = `/doctor/consultation/${encodeURIComponent(staleActive.consultationId)}`;
      rows.push({
        id: staleActive.consultationId,
        patient,
        initials: initials(patient),
        startedLabel: `Démarrée le ${formatDate(staleActive.startedAt, undefined, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })} à ${formatTime(staleActive.startedAt)}`,
        resumeAction: { kind: 'CONTINUE_CONSULTATION', consultationId: staleActive.consultationId, href },
        closeAction: { kind: 'CLOSE_CONSULTATION', consultationId: staleActive.consultationId, href },
        detailAction: null,
        note: null,
      });
      if (staleActive.sourceType === 'SCHEDULED_APPOINTMENT') seen.add(staleActive.sourceId);
    }
    for (const item of this.recentAgenda()) {
      if (
        item.resourceType !== 'APPOINTMENT' ||
        item.appointmentId === null ||
        item.status !== 'IN_PROGRESS' ||
        isToday(item.start, item.timezone) ||
        new Date(item.start).getTime() > Date.now() ||
        seen.has(item.appointmentId)
      ) {
        continue;
      }
      if (active?.sourceType === 'SCHEDULED_APPOINTMENT' && active.sourceId === item.appointmentId) {
        continue;
      }
      const patient = item.subject.displayName.trim() || 'Patient non renseigné';
      rows.push({
        id: item.appointmentId,
        patient,
        initials: initials(patient),
        startedLabel: `Rendez-vous du ${formatDate(item.start, item.timezone, {
          weekday: 'short',
          day: 'numeric',
          month: 'short',
        })} à ${formatTime(item.start, item.timezone)}`,
        resumeAction: null,
        closeAction: null,
        detailAction: {
          kind: 'OPEN_STALE_APPOINTMENT',
          appointmentId: item.appointmentId,
          href: `/doctor/calendar?appointmentId=${encodeURIComponent(item.appointmentId)}`,
        },
        note: 'Aucune consultation ouverte pour ce rendez-vous.',
      });
    }
    return rows;
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
    this.loadRecentAgenda();
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

  private loadRecentAgenda(): void {
    const today = new Date();
    const from = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 30);
    const to = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
    this.scheduledCareApi.getDoctorScheduledCare(from.toISOString(), to.toISOString()).subscribe({
      next: (agenda) => this.recentAgenda.set(agenda.items),
      // Optional enrichment: the home stays usable without it.
      error: () => this.recentAgenda.set([]),
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

function initials(name: string): string {
  const parts = name.trim().split(/\s+/u).filter(Boolean);
  if (parts.length === 0) return 'PN';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toLocaleUpperCase('fr-FR') ?? '')
    .join('');
}

function avatarTone(identity: string): CommandCenterAvatarTone {
  const tones: readonly CommandCenterAvatarTone[] = ['mint', 'blue', 'rose'];
  const hash = Array.from(identity).reduce(
    (total, character) => total + character.codePointAt(0)!,
    0,
  );
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

function isUpcomingConfirmed(item: DoctorScheduledCareItem): boolean {
  return item.status === 'CONFIRMED' && new Date(item.start).getTime() > Date.now();
}

function isToday(instant: string, timeZone?: string): boolean {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  });
  return formatter.format(new Date(instant)) === formatter.format(new Date());
}
