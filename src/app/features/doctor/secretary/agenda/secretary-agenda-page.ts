import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';

import {
  OcButton,
  OcConfirmDialog,
  OcDialog,
  OcEmptyState,
  OcPageHeader,
  OcStatus,
  OcStatusBadge,
} from '../../../../shared/ui';
import { AppointmentDto, SlotDto } from '../../appointment-api.models';
import { SecretaryAgendaApiService } from '../secretary-agenda-api.service';
import { secretaryErrorMessage } from '../secretary-page-utils';

/**
 * The whole of a secretary's workspace: the delegating doctor's agenda for one
 * day, with the reschedule and cancel actions their permissions may allow.
 *
 * The page deliberately does not attempt to gate actions on permissions. The
 * contract exposes no endpoint that tells a secretary what they were granted,
 * so hiding a button would be guesswork; the backend is authoritative and its
 * refusal is surfaced verbatim.
 */
@Component({
  selector: 'app-secretary-agenda-page',
  imports: [
    OcButton,
    OcConfirmDialog,
    OcDialog,
    OcEmptyState,
    OcPageHeader,
    OcStatusBadge,
  ],
  templateUrl: './secretary-agenda-page.html',
  styleUrl: './secretary-agenda-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SecretaryAgendaPage {
  private readonly api = inject(SecretaryAgendaApiService);

  readonly day = signal(todayIso());
  readonly appointments = signal<readonly AppointmentDto[]>([]);
  readonly loading = signal(true);
  readonly loadError = signal<string | null>(null);
  readonly notice = signal<string | null>(null);
  readonly actionError = signal<string | null>(null);
  readonly actingOn = signal<string | null>(null);

  readonly rescheduling = signal<AppointmentDto | null>(null);
  readonly slots = signal<readonly SlotDto[]>([]);
  readonly slotsLoading = signal(false);
  readonly selectedSlot = signal<SlotDto | null>(null);
  readonly dialogError = signal<string | null>(null);

  readonly cancelTarget = signal<AppointmentDto | null>(null);

  /** Guards against stacking list requests: one page load sends exactly one request. */
  private readonly inFlight = signal(false);

  readonly dayLabel = computed(() => this.formatDay(this.day()));
  readonly hasAppointments = computed(() => this.appointments().length > 0);

  constructor() {
    this.load();
  }

  load(): void {
    if (this.inFlight()) return;
    this.inFlight.set(true);
    this.loading.set(true);
    this.loadError.set(null);
    this.api.list(this.day()).subscribe({
      next: (appointments) => {
        this.appointments.set(appointments);
        this.loading.set(false);
        this.inFlight.set(false);
      },
      error: (error: unknown) => {
        this.appointments.set([]);
        this.loadError.set(secretaryErrorMessage(error));
        this.loading.set(false);
        this.inFlight.set(false);
      },
    });
  }

  shiftDay(days: number): void {
    const next = new Date(`${this.day()}T00:00:00`);
    next.setDate(next.getDate() + days);
    this.day.set(toIsoDate(next));
    this.load();
  }

  goToToday(): void {
    this.day.set(todayIso());
    this.load();
  }

  openReschedule(appointment: AppointmentDto): void {
    this.actionError.set(null);
    this.rescheduling.set(appointment);
    this.selectedSlot.set(null);
    this.dialogError.set(null);
    this.slots.set([]);
    this.slotsLoading.set(true);

    this.api.listSlots(appointment.doctorId, this.day()).subscribe({
      next: (slots) => {
        this.slots.set(
          slots.filter((slot) => !overlapsCurrentSlot(slot, appointment)),
        );
        this.slotsLoading.set(false);
      },
      error: (error: unknown) => {
        this.dialogError.set(secretaryErrorMessage(error));
        this.slotsLoading.set(false);
      },
    });
  }

  closeReschedule(): void {
    if (this.actingOn() !== null) return;
    this.rescheduling.set(null);
    this.selectedSlot.set(null);
  }

  confirmReschedule(): void {
    const appointment = this.rescheduling();
    const slot = this.selectedSlot();
    if (appointment === null || slot === null || this.actingOn() !== null) return;

    this.actingOn.set(appointment.id);
    this.dialogError.set(null);
    this.api.reschedule(appointment.id, slot.start, slot.end).subscribe({
      next: () => {
        this.actingOn.set(null);
        this.rescheduling.set(null);
        this.selectedSlot.set(null);
        this.notice.set('Appointment rescheduled.');
        this.load();
      },
      error: (error: unknown) => {
        this.actingOn.set(null);
        this.dialogError.set(secretaryErrorMessage(error));
      },
    });
  }

  requestCancel(appointment: AppointmentDto): void {
    this.actionError.set(null);
    this.cancelTarget.set(appointment);
  }

  closeCancel(): void {
    if (this.actingOn() !== null) return;
    this.cancelTarget.set(null);
  }

  confirmCancel(): void {
    const appointment = this.cancelTarget();
    if (appointment === null || this.actingOn() !== null) return;

    this.actingOn.set(appointment.id);
    this.actionError.set(null);
    this.api.cancel(appointment.id).subscribe({
      next: () => {
        this.actingOn.set(null);
        this.cancelTarget.set(null);
        this.notice.set('Appointment cancelled.');
        this.load();
      },
      error: (error: unknown) => {
        this.actingOn.set(null);
        this.cancelTarget.set(null);
        this.actionError.set(secretaryErrorMessage(error));
      },
    });
  }

  isActingOn(id: string): boolean {
    return this.actingOn() === id;
  }

  patientLabel(appointment: AppointmentDto): string {
    return appointment.patientName ?? 'Patient';
  }

  timeRange(appointment: AppointmentDto): string {
    return `${this.formatTime(appointment.startTime)} - ${this.formatTime(appointment.endTime)}`;
  }

  statusTone(status: string): OcStatus {
    switch (status) {
      case 'CONFIRMED':
        return 'confirmed';
      case 'IN_PROGRESS':
        return 'in-progress';
      case 'COMPLETED':
        return 'completed';
      case 'CANCELLED':
      case 'NO_SHOW':
        return 'cancelled';
      default:
        return 'pending';
    }
  }

  statusLabel(status: string): string {
    return status.replaceAll('_', ' ').toLowerCase();
  }

  canAct(appointment: AppointmentDto): boolean {
    return appointment.status === 'CONFIRMED';
  }

  protected formatTime(value: string): string {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', {
      hour: '2-digit',
      minute: '2-digit',
    }).format(parsed);
  }

  protected formatDay(value: string): string {
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat('fr-FR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(parsed);
  }
}

/** Hides the appointment's own slot so it cannot be "moved" onto itself. */
function overlapsCurrentSlot(slot: SlotDto, appointment: AppointmentDto): boolean {
  return slot.start === appointment.startTime && slot.end === appointment.endTime;
}

function toIsoDate(date: Date): string {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function todayIso(): string {
  return toIsoDate(new Date());
}