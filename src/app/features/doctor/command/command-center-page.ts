import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router } from '@angular/router';
import { forkJoin, interval, switchMap, catchError, of } from 'rxjs';

import {
  OcButton,
  OcCard,
  OcMetricCard,
  OcEmptyState,
  OcAvatar,
  OcStatusBadge,
} from '../../../shared/ui';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { AppointmentApiService } from '../appointment-api.service';
import { DoctorUrgentApiService } from '../doctor-urgent-api.service';
import {
  AppointmentDto,
  AvailabilityRuleDto,
  DoctorStatsDto,
  UrgentOfferDto,
} from '../appointment-api.models';
import { AppointmentDetailPanel } from '../shared/appointment-detail-panel';
import { UrgentRequestDetailPanel } from '../shared/urgent-request-detail-panel';
import { PatientSummaryPanel } from '../shared/patient-summary-panel';
import { UrgentAcceptedStore } from '../urgent-accepted.store';
import { BookingRequestDetailPanel } from '../scheduled-care/booking-request-detail-panel';
import { ScheduledAppointmentDetailPanel } from '../scheduled-care/scheduled-appointment-detail-panel';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { formatScheduledInstant } from '../scheduled-care/scheduled-care-time';

const URGENT_POLL_INTERVAL_MS = 15_000;

@Component({
  selector: 'app-command-center-page',
  imports: [
    NzIconModule,
    OcButton,
    OcCard,
    OcMetricCard,
    OcEmptyState,
    OcAvatar,
    OcStatusBadge,
    AppointmentDetailPanel,
    UrgentRequestDetailPanel,
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
  private readonly urgentApi = inject(DoctorUrgentApiService);
  private readonly acceptedStore = inject(UrgentAcceptedStore);
  readonly scheduledCare = inject(ScheduledCareFacade);
  private readonly destroyRef = inject(DestroyRef);

  readonly aptPanel = viewChild.required<AppointmentDetailPanel>('aptPanel');
  readonly urgentPanel = viewChild.required<UrgentRequestDetailPanel>('urgentPanel');
  readonly patientPanel = viewChild.required<PatientSummaryPanel>('patientPanel');
  readonly scheduledRequestPanel =
    viewChild.required<BookingRequestDetailPanel>('scheduledRequestPanel');
  readonly scheduledAppointmentPanel =
    viewChild.required<ScheduledAppointmentDetailPanel>('scheduledAppointmentPanel');

  readonly loading = signal(false);
  readonly error = signal<string | null>(null);
  readonly appointments = signal<readonly AppointmentDto[]>([]);
  readonly todayStats = signal<DoctorStatsDto | null>(null);

  readonly urgentOffers = signal<readonly UrgentOfferDto[]>([]);
  readonly urgentLoading = signal(true);
  readonly urgentError = signal<string | null>(null);

  readonly availabilityRules = signal<readonly AvailabilityRuleDto[]>([]);

  readonly noAvailability = computed(() => this.availabilityRules().length === 0);
  readonly pendingScheduledRequest = computed(() => this.scheduledCare.home()?.nextPendingRequest ?? null);
  readonly nextScheduledAppointment = computed(
    () => this.scheduledCare.home()?.nextConfirmedAppointment ?? null,
  );

  readonly stats = computed(() => {
    const s = this.todayStats();
    return [
      { value: s?.consultations ?? 0, label: "Consultations aujourd'hui", icon: 'medicine-box' },
      { value: s?.upcoming ?? 0, label: 'A venir', icon: 'clock-circle' },
      { value: s?.finished ?? 0, label: 'Terminees', icon: 'check-circle' },
      {
        value: this.scheduledCare.home()?.pendingRequestCount ?? 0,
        label: 'Demandes planifiées',
        icon: 'inbox',
      },
      { value: this.urgentOffers().length, label: 'Demandes urgentes', icon: 'exclamation-circle' },
    ];
  });

  readonly pendingAppointments = computed(() =>
    this.appointments().filter((a) => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS'),
  );

  readonly urgentCount = computed(() => this.urgentOffers().length);

  constructor() {
    this.loadData();
    this.scheduledCare.loadHome();
    this.startUrgentPolling();
  }

  openAptDetail(appointment: AppointmentDto): void {
    this.aptPanel().openWith(appointment);
  }

  onAppointmentUpdated(updated: AppointmentDto): void {
    this.appointments.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
    this.loadData();
  }

  openUrgentDetail(offer: UrgentOfferDto): void {
    this.urgentPanel().openWith(offer);
  }

  openPatientDetail(patientId: string): void {
    this.patientPanel().openWith(patientId);
  }

  startConsultation(appointmentId: string): void {
    void this.router.navigate(['/doctor', 'consultation', appointmentId]);
  }

  appointmentStatusLabel(status: AppointmentDto['status']): string {
    switch (status) {
      case 'CONFIRMED':
        return 'En attente';
      case 'IN_PROGRESS':
        return 'En cours';
      case 'CANCELLED':
        return 'Annule';
      case 'COMPLETED':
        return 'Termine';
      case 'NO_SHOW':
        return 'Absent';
      default:
        return status;
    }
  }

  appointmentStatusOc(
    status: AppointmentDto['status'],
  ): 'pending' | 'confirmed' | 'cancelled' | 'in-progress' {
    switch (status) {
      case 'CONFIRMED':
        return 'pending';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'COMPLETED':
        return 'confirmed';
      case 'CANCELLED':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  patientName(patientId: string, appointment?: AppointmentDto): string {
    if (appointment?.patientName) return appointment.patientName;
    return patientId;
  }

  appointmentTime(apt: AppointmentDto): string {
    const start = new Date(apt.startTime);
    return new Intl.DateTimeFormat('fr-FR', { hour: '2-digit', minute: '2-digit' }).format(start);
  }

  appointmentDate(apt: AppointmentDto): string {
    const start = new Date(apt.startTime);
    return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: 'short' }).format(start);
  }

  scheduledTime(record: DoctorScheduledCareItem): string {
    return formatScheduledInstant(record.start, record.timezone, {
      weekday: 'short',
      year: undefined,
    });
  }

  openScheduledRequest(request: DoctorScheduledCareItem): void {
    if (request.requestId) this.scheduledRequestPanel().openWith(request.requestId);
  }

  openScheduledAppointment(appointment: DoctorScheduledCareItem): void {
    if (appointment.appointmentId) {
      this.scheduledAppointmentPanel().openWith(appointment.appointmentId);
    }
  }

  trackByAppointmentId(_index: number, appointment: AppointmentDto): string {
    return appointment.id;
  }

  goTo(path: string): void {
    void this.router.navigate([path]);
  }

  goToSchedule(): void {
    void this.router.navigate(['/doctor/settings'], { queryParams: { tab: 'schedule' } });
  }

  trackByOfferId(_index: number, offer: UrgentOfferDto): string {
    return offer.offerId;
  }

  retryUrgent(): void {
    this.urgentError.set(null);
    this.refreshUrgentOffers();
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
        this.error.set('Impossible de charger les donnees du jour.');
        this.loading.set(false);
      },
    });
  }

  private startUrgentPolling(): void {
    this.urgentLoading.set(true);
    interval(URGENT_POLL_INTERVAL_MS)
      .pipe(
        switchMap(() =>
          this.urgentApi.incoming().pipe(catchError(() => of([] as readonly UrgentOfferDto[]))),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((offers) => {
        this.mergeIncomingOffers(offers);
        this.urgentLoading.set(false);
      });

    this.refreshUrgentOffers();
  }

  private refreshUrgentOffers(): void {
    this.urgentApi.incoming().subscribe({
      next: (offers) => {
        this.mergeIncomingOffers(offers);
        this.urgentLoading.set(false);
      },
      error: () => {
        this.urgentLoading.set(false);
        this.urgentError.set('Impossible de recuperer les demandes urgentes.');
      },
    });
  }

  private mergeIncomingOffers(incoming: readonly UrgentOfferDto[]): void {
    this.urgentOffers.update((current) => {
      const freshAccepted = incoming.filter((o) => o.status === 'ACCEPTED');
      const optimisticAccepted = current.filter(
        (o) => o.status === 'ACCEPTED' && !freshAccepted.some((a) => a.offerId === o.offerId),
      );
      const pending = incoming.filter((o) => o.status === 'PENDING');
      return [...freshAccepted, ...optimisticAccepted, ...pending];
    });
  }

  onUrgentAccepted(offer: UrgentOfferDto): void {
    this.acceptedStore.add(offer);
    this.urgentOffers.update((offers) =>
      offers.map((o) => (o.offerId === offer.offerId ? { ...o, status: 'ACCEPTED' as const } : o)),
    );
  }

  private todayRange(): { from: string; to: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
}
