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
import { AppointmentDto, AvailabilityRuleDto, DoctorStatsDto } from '../appointment-api.models';
import { AppointmentDetailPanel } from '../shared/appointment-detail-panel';
import { PatientSummaryPanel } from '../shared/patient-summary-panel';
import { BookingRequestDetailPanel } from '../scheduled-care/booking-request-detail-panel';
import { ScheduledAppointmentDetailPanel } from '../scheduled-care/scheduled-appointment-detail-panel';
import { ScheduledCareFacade } from '../scheduled-care/scheduled-care.facade';
import type { DoctorScheduledCareItem } from '../scheduled-care/scheduled-care.models';
import { formatScheduledInstant } from '../scheduled-care/scheduled-care-time';
import { ActiveConsultationStore } from '../active-consultation.store';

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
  private readonly activeConsultation = inject(ActiveConsultationStore);

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

  readonly noAvailability = computed(() => this.availabilityRules().length === 0);
  readonly pendingScheduledRequest = computed(
    () => this.scheduledCare.home()?.nextPendingRequest ?? null,
  );
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
    ];
  });

  readonly pendingAppointments = computed(() =>
    this.appointments().filter((a) => a.status === 'CONFIRMED' || a.status === 'IN_PROGRESS'),
  );

  constructor() {
    this.loadData();
    this.scheduledCare.loadHome();
  }

  openAptDetail(appointment: AppointmentDto): void {
    this.aptPanel().openWith(appointment);
  }

  onAppointmentUpdated(updated: AppointmentDto): void {
    this.appointments.update((list) => list.map((a) => (a.id === updated.id ? updated : a)));
    this.loadData();
  }

  openPatientDetail(patientId: string): void {
    this.patientPanel().openWith(patientId);
  }

  startConsultation(_appointmentId: string): void {
    void this.activeConsultation.refresh().then((active) => {
      if (active !== null) {
        void this.router.navigate(['/doctor', 'consultation', active.consultationId]);
      }
    });
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

  private todayRange(): { from: string; to: string } {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(start.getDate() + 1);
    return { from: start.toISOString(), to: end.toISOString() };
  }
}
